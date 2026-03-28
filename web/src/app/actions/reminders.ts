
'use server'

import { createClient } from '@supabase/supabase-js'
import { getHearingDate } from "@/lib/utils/date";

type HearingLite = {
  hearing_date: string | null;
  hearing_type?: string | null;
};

type EcourtsCaseLite = {
  last_synced_at: string | null;
};

type CaseRow = {
  id: string;
  case_number: string | null;
  next_hearing_date: string | null;
  title: string | null;
  created_by: string | null;
  case_hearings: HearingLite[] | null;
  ecourts_cases?: EcourtsCaseLite[] | EcourtsCaseLite | null;
};

type ParticipantRow = {
  user_id: string;
  role: string;
};

export async function checkUpcomingHearings() {
  // Use service role key for cron jobs (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Use IST dates for comparison
  const dateStrToday = getHearingDate(today) || ''
  const dateStrTomorrow = getHearingDate(tomorrow) || ''

  console.log(`🔔 [Cron] Checking hearings for Today (${dateStrToday}) and Tomorrow (${dateStrTomorrow})...`)

  // 1. Fetch ALL cases with their hearings
  const { data: cases, error } = await supabase
    .from('cases')
    .select(`
      id, 
      case_number, 
      next_hearing_date, 
      title,
      case_hearings (
        hearing_date,
        hearing_type
      )
    `)

  console.log(`[DEBUG] Cases fetched:`, cases?.length)
  console.log(`[DEBUG] Error:`, error)

  if (error) {
    console.error('❌ [Cron] Failed to fetch cases:', error)
    return { success: false, error: error.message }
  }

  if (!cases || cases.length === 0) {
    console.log('✅ [Cron] No cases found.')
    return { success: true, count: 0 }
  }

  // Filter cases that have hearings today or tomorrow
  const casesWithUpcomingHearings = (cases as CaseRow[]).filter(c => {
    // Check case_hearings first
    const upcomingFromHearings = c.case_hearings?.some(
      h => {
        const hDate = getHearingDate(h.hearing_date);
        return hDate === dateStrToday || hDate === dateStrTomorrow;
      }
    );
    
    if (upcomingFromHearings) return true;
    
    // Fall back to next_hearing_date
    const nextDate = getHearingDate(c.next_hearing_date);
    return nextDate === dateStrToday || nextDate === dateStrTomorrow;
  });

  if (casesWithUpcomingHearings.length === 0) {
    console.log('✅ [Cron] No upcoming hearings found.')
    return { success: true, count: 0 }
  }

  console.log(`Found ${casesWithUpcomingHearings.length} cases with upcoming hearings.`)

  let notificationCount = 0

  // 2. Iterate and create notifications
  for (const c of casesWithUpcomingHearings) {
    // Determine the effective hearing date
    const hearingFromTable = c.case_hearings?.find(
      h => {
        const hDate = getHearingDate(h.hearing_date);
        return hDate === dateStrToday || hDate === dateStrTomorrow;
      }
    );
    
    const effectiveHearingDate = hearingFromTable 
        ? getHearingDate(hearingFromTable.hearing_date) 
        : getHearingDate(c.next_hearing_date);
    
    if (!effectiveHearingDate) continue;

    // Find users linked to this case — include their role for targeted messaging
    const { data: participants } = await supabase
        .from('case_participants')
        .select('user_id, role')
        .eq('case_id', c.id)

    if (!participants || participants.length === 0) {
        continue;
    }

    const isToday = effectiveHearingDate === dateStrToday
    const timeLabel = isToday ? 'TODAY' : 'TOMORROW'

    for (const p of participants) {
        const isClient = p.role === 'client'

        // Role-specific title and message
        const title = isClient
            ? `Hearing ${timeLabel}: ${c.case_number}`
            : `Hearing Reminder: ${c.case_number}`

        const message = isClient
            ? `Your legal matter "${c.title || c.case_number}" has a hearing ${timeLabel} (${effectiveHearingDate}). Contact your advocate for details.`
            : `Your case ${c.title || c.case_number} is listed for hearing ${timeLabel} (${effectiveHearingDate}).`

        // Role-specific deep-link
        const link = isClient
            ? `/cases/${c.id}`
            : `/dashboard/advocate/cases/${c.id}`

        // Check for duplicate for this user + case + date
        const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', p.user_id)
            .eq('type', 'hearing_reminder')
            .contains('metadata', { case_id: c.id, hearing_date: effectiveHearingDate })
            .single()

        if (!existing) {
            const { error: insertError } = await supabase.from('notifications').insert({
                user_id: p.user_id,
                type: 'hearing_reminder',
                category: 'hearing',
                title,
                message,
                is_read: false,
                push_sent: false,
                metadata: {
                    case_id: c.id,
                    hearing_date: effectiveHearingDate,
                    participant_role: p.role,
                    link
                }
            })

            if (!insertError) {
                notificationCount++
            } else {
                console.error(`❌ [Cron] Failed to insert notification for user ${p.user_id}:`, insertError)
            }
        }
    }
  }

  console.log(`✅ [Cron] Processed ${casesWithUpcomingHearings.length} cases, sent ${notificationCount} new notifications.`)
  return { success: true, count: notificationCount }
}

/**
 * Queues sync reminder notifications for cases whose hearing is TODAY
 * but haven't been synced since that hearing.
 * Called by the same /api/cron/reminders endpoint.
 * Push is delivered at 7:30 PM IST by /api/cron/process-notifications.
 */
export async function checkSyncOverdueCases() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = new Date()
  const dateStrToday = getHearingDate(today) || ''

  console.log(`🔔 [Cron] Checking sync-overdue cases for today (${dateStrToday})...`)

  // Fetch cases with today's hearing date and their ecourts sync info
  const { data: cases, error } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      next_hearing_date,
      created_by,
      case_hearings (
        hearing_date
      ),
      ecourts_cases (
        last_synced_at
      )
    `)

  if (error) {
    console.error('❌ [Cron] Failed to fetch cases for sync check:', error)
    return { success: false, error: error.message }
  }

  if (!cases || cases.length === 0) {
    return { success: true, count: 0 }
  }

  // Filter: cases that have a hearing TODAY and haven't been synced since
  const overdueToday = (cases as CaseRow[]).filter(c => {
    // Check if any hearing is today
    const hasHearingToday =
      c.case_hearings?.some(h => getHearingDate(h.hearing_date) === dateStrToday) ||
      getHearingDate(c.next_hearing_date) === dateStrToday

    if (!hasHearingToday) return false

    // Check if synced after today
    const ecourtsData = Array.isArray(c.ecourts_cases) ? c.ecourts_cases[0] : c.ecourts_cases
    const lastSynced = ecourtsData?.last_synced_at
    if (!lastSynced) return true // Never synced

    const lastSyncedDate = lastSynced.split('T')[0]
    return dateStrToday > lastSyncedDate // Today's hearing not yet synced
  })

  if (overdueToday.length === 0) {
    console.log('✅ [Cron] No sync-overdue cases for today.')
    return { success: true, count: 0 }
  }

  console.log(`Found ${overdueToday.length} cases needing sync reminder.`)

  let reminderCount = 0

  for (const c of overdueToday) {
    // Only notify advocates — sync is an advocate action, not relevant to clients
    const advocateIds = new Set<string>()
    if (c.created_by) advocateIds.add(c.created_by)

    const { data: participants } = await supabase
      .from('case_participants')
      .select('user_id, role')
      .eq('case_id', c.id)

    participants
      ?.filter((p: ParticipantRow) => p.role !== 'client')
      .forEach((p: ParticipantRow) => advocateIds.add(p.user_id))

    for (const userId of advocateIds) {
      // Deduplicate: skip if sync_reminder already sent for this case + date
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'sync_reminder')
        .contains('metadata', { case_id: c.id, hearing_date: dateStrToday })
        .single()

      if (!existing) {
        const { error: insertError } = await supabase.from('notifications').insert({
          user_id: userId,
          type: 'sync_reminder',
          category: 'hearing', // Picked up by process-notifications cron at 7:30 PM
          title: `Sync Required: ${c.case_number}`,
          message: `Your case "${c.title || c.case_number}" had a hearing today (${dateStrToday}). Please sync eCourts to get the latest outcome and next date.`,
          metadata: {
            case_id: c.id,
            hearing_date: dateStrToday,
            link: `/dashboard/advocate/cases/${c.id}`
          },
          is_read: false,
          push_sent: false
        })

        if (!insertError) {
          reminderCount++
        } else {
          console.error(`❌ [Cron] Failed to insert sync reminder for user ${userId}:`, insertError)
        }
      }
    }
  }

  console.log(`✅ [Cron] Queued ${reminderCount} sync reminder notifications (push at 7:30 PM IST).`)
  return { success: true, count: reminderCount }
}
