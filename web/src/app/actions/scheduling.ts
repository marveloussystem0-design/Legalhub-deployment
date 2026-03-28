'use server';

import { createClient } from '@/utils/supabase/server';

type HearingCaseLink = {
  case_id: string;
  cases:
    | {
        title: string | null;
        created_by: string | null;
      }
    | Array<{
        title?: string | null;
        created_by?: string | null;
      }>
    | null;
};

type TodayHearingCaseLink = {
  case_id: string;
  cases:
    | {
        created_by: string | null;
      }
    | Array<{
        created_by?: string | null;
      }>
    | null;
};

type HearingRecord = {
  id: string;
  cnr_number: string | null;
  case_number: string | null;
  next_hearing_date: string | null;
  court_name: string | null;
  case_ecourts_links: HearingCaseLink[];
};

type TodayHearingRecord = {
  id: string;
  next_hearing_date: string | null;
  case_ecourts_links: TodayHearingCaseLink[];
};

function getLinkedCase(link: HearingCaseLink) {
  if (Array.isArray(link.cases)) return link.cases[0] ?? null;
  return link.cases;
}

function getTodayLinkedCase(link: TodayHearingCaseLink) {
  if (Array.isArray(link.cases)) return link.cases[0] ?? null;
  return link.cases;
}

type NotificationPayload = {
  user_id: string;
  title: string;
  message: string;
  type: 'info';
  category: 'hearing';
  is_read: boolean;
  metadata: {
    hearing_date: string;
    case_id: string;
    type: 'tomorrow_hearing';
  };
};

type WarningNotificationPayload = {
  user_id: string;
  title: string;
  message: string;
  type: 'warning';
  category: 'hearing';
  is_read: boolean;
  metadata: {
    hearing_date: string;
    case_id: string;
    type: 'today_hearing';
  };
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Run Daily Check for Tomorrow's Hearings (Scheduled for 7:00 PM)
 */
export async function checkTomorrowHearings() {
  const supabase = await createClient();
  const summary = { notificationsSent: 0, errors: [] as string[] };

  try {
    // 1. Calculate Tomorrow's Date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`[Scheduler] Checking hearings for Tomorrow: ${tomorrowStr}`);

    // 2. Find cases with hearings tomorrow
    // Join with ecourts_cases to get date, and case_ecourts_links -> cases -> created_by/participants to find users
    const { data: hearings, error } = await supabase
      .from('ecourts_cases')
      .select(`
        id,
        cnr_number,
        case_number,
        next_hearing_date,
        court_name,
        case_ecourts_links!inner (
          case_id,
          cases (
            title,
            created_by
          )
        )
      `)
      .eq('next_hearing_date', tomorrowStr);

    if (error) throw error;

    if (!hearings || hearings.length === 0) {
      console.log(`[Scheduler] No hearings found for tomorrow.`);
      return { success: true, message: 'No hearings found for tomorrow', ...summary };
    }

    // 3. Create Notifications
    const notificationsToInsert: NotificationPayload[] = [];

    for (const record of (hearings as HearingRecord[])) {
      if (!record.case_ecourts_links || record.case_ecourts_links.length === 0) continue;

      // In a real app, we might handle multiple links/users. 
      // For MVP, notifying the creator of the linked case.
      for (const link of record.case_ecourts_links) {
        const linkedCase = getLinkedCase(link);
        const userId = linkedCase?.created_by;
        const caseTitle = linkedCase?.title || record.case_number;

        if (userId) {
          notificationsToInsert.push({
            user_id: userId,
            title: `Hearing Tomorrow: ${caseTitle}`,
            message: `You have a hearing for ${caseTitle} tomorrow at ${record.court_name}`, // Improved message
            type: 'info',
            category: 'hearing', // New field
            is_read: false,
            metadata: { // New metadata field
                hearing_date: tomorrowStr,
                case_id: link.case_id,
                type: 'tomorrow_hearing'
            }
          });
        }
      }
    }

    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications') // Unified table
        .insert(notificationsToInsert);

      if (insertError) throw insertError;
      summary.notificationsSent = notificationsToInsert.length;
    }

    console.log(`[Scheduler] Sent ${summary.notificationsSent} notifications for tomorrow.`);
    return { success: true, ...summary };

  } catch (err: unknown) {
    console.error('[Scheduler Update Error]', err);
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Run Daily Check for Today's Hearings (Scheduled for 7:00 AM)
 */
export async function checkTodayHearings() {
  const supabase = await createClient();
  const summary = { notificationsSent: 0 };

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    console.log(`[Scheduler] Checking hearings for Today: ${todayStr}`);

    // Query for hearings today
    const { data: hearings, error } = await supabase
      .from('ecourts_cases')
      .select(`
        id,
        next_hearing_date,
        case_ecourts_links!inner (
          case_id,
          cases (created_by)
        )
      `)
      .eq('next_hearing_date', todayStr);

    if (error) throw error;

    const notificationsToInsert: WarningNotificationPayload[] = [];
    
    if (hearings && hearings.length > 0) {
       for (const record of hearings as TodayHearingRecord[]) {
         for (const link of record.case_ecourts_links) {
           const linkedCase = getTodayLinkedCase(link);
           const userId = linkedCase?.created_by;
           if (userId) {
             notificationsToInsert.push({
               user_id: userId,
               title: 'Hearing Today',
               message: 'You have a hearing scheduled for today.',
               type: 'warning', // Warning for immediate attention
               category: 'hearing',
               is_read: false,
               metadata: {
                   hearing_date: todayStr,
                   case_id: link.case_id,
                   type: 'today_hearing'
               }
             });
           }
         }
       }
    }

    if (notificationsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications') // Unified table
          .insert(notificationsToInsert);
          
        if (insertError) throw insertError;
        summary.notificationsSent = notificationsToInsert.length;
    }

    return { success: true, ...summary };

  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) };
  }
}
