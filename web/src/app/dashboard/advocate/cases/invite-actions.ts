'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { NotificationService } from '@/lib/services/notifications'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { normalizePhone } from '@/lib/phone'

export async function inviteClientToCase(caseId: string, phone: string) {
  const supabase = await createClient()
  // Use service role to bypass RLS (avoids infinite recursion in case_participants policy)
  const adminSupabase = createServiceRoleClient()

  // 1. Get current user (Inviter)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Validate phone number (basic check)
  const normalized = normalizePhone(phone)
  if (normalized.digits.length < 10) return { error: 'Please enter a valid phone number' }

  try {
    type ClientRow = { user_id: string; full_name: string | null }
    type ProfileCandidate = { id: string; full_name: string | null; phone?: string | null; role?: string | null }

    const pickBestClientMatch = async (
      profileRows: ProfileCandidate[]
    ): Promise<{ id: string; full_name: string | null } | null> => {
      if (profileRows.length === 0) return null

      const { data: clientRows, error: clientLookupError } = await adminSupabase
        .from('clients')
        .select('user_id, full_name')
        .in('user_id', profileRows.map((row) => row.id))

      if (clientLookupError) throw clientLookupError

      const clientMap = new Map((clientRows || []).map((row: ClientRow) => [row.user_id, row.full_name ?? null]))

      const preferredProfile =
        profileRows.find((row) => clientMap.has(row.id)) ||
        profileRows.find((row) => row.role === 'client') ||
        null

      if (!preferredProfile) return null

      return {
        id: preferredProfile.id,
        full_name: clientMap.get(preferredProfile.id) ?? preferredProfile.full_name ?? null
      }
    }

    const ensureProfileRow = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
      const { data: authData } = await adminSupabase.auth.admin.getUserById(userId)
      const authUser = authData?.user
      const metadata = (authUser?.user_metadata as Record<string, unknown> | null) || null
      const metadataPhone = typeof metadata?.phone === 'string' ? metadata.phone : null
      const metadataRole = typeof metadata?.role === 'string' ? metadata.role : 'client'
      const metadataFullName = typeof metadata?.full_name === 'string' ? metadata.full_name : null

      const candidates: Array<Record<string, unknown>> = [
        {
          id: userId,
          email: authUser?.email ?? null,
          phone: authUser?.phone ?? metadataPhone,
          role: metadataRole,
          full_name: metadataFullName
        },
        {
          id: userId,
          email: authUser?.email ?? null,
          role: metadataRole,
          full_name: metadataFullName
        },
        {
          id: userId,
          email: authUser?.email ?? null,
          full_name: metadataFullName
        },
        {
          id: userId
        }
      ]

      let lastErr: { message?: string } | null = null
      for (const row of candidates) {
        const { error } = await adminSupabase
          .from('profiles')
          .upsert(row, { onConflict: 'id' })
        if (!error) return { ok: true }
        lastErr = error
        // Keep trying with smaller payload for schema compatibility.
        if (error.code !== '42703' && error.code !== '23502') break
      }

      return { ok: false, error: lastErr?.message || 'Failed to ensure profile row' }
    }

    // 2. Check if a user with this phone already exists in profiles
    // We search by phone column in profiles. 
    // Ensure 'phone' column exists in profiles and is unique/indexed.
    const { data: profileMatches, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, phone, role')
      .in('phone', normalized.candidates)

    if (profileErr) throw profileErr

    let existingProfile: { id: string; full_name: string | null } | null =
      await pickBestClientMatch(profileMatches || [])

    // Final fallback: check Supabase Auth users (phone or metadata phone).
    if (!existingProfile) {
      const authUsers: Array<{
        id: string;
        phone?: string | null;
        user_metadata?: Record<string, unknown> | null;
      }> = [];

      let page = 1;
      const perPage = 200;
      while (page <= 5) {
        const { data: listed, error: listErr } = await adminSupabase.auth.admin.listUsers({
          page,
          perPage
        });
        if (listErr) throw listErr;

        const users = listed?.users || [];
        authUsers.push(
          ...users.map((u) => ({
            id: u.id,
            phone: u.phone,
            user_metadata: (u.user_metadata as Record<string, unknown> | null) || null
          }))
        );

        if (users.length < perPage) break;
        page += 1;
      }

      const matchedAuthUsers = authUsers.filter((u) => {
        const phoneCandidates = [
          u.phone,
          typeof u.user_metadata?.phone === 'string' ? u.user_metadata.phone : null
        ].filter(Boolean) as string[];

        return phoneCandidates.some((p) => normalizePhone(p).national10 === normalized.national10);
      });

      if (matchedAuthUsers.length > 0) {
        const matchedIds = matchedAuthUsers.map((matchedUser) => matchedUser.id)
        const [{ data: matchedProfiles }, { data: matchedClients }] = await Promise.all([
          adminSupabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', matchedIds),
          adminSupabase
            .from('clients')
            .select('user_id, full_name')
            .in('user_id', matchedIds)
        ]);

        const clientMap = new Map((matchedClients || []).map((row: ClientRow) => [row.user_id, row.full_name ?? null]))
        const profileMap = new Map((matchedProfiles || []).map((row: ProfileCandidate) => [row.id, row]))
        const matchedAuthUser =
          matchedAuthUsers.find((matchedUser) => clientMap.has(matchedUser.id)) ||
          matchedAuthUsers.find((matchedUser) => {
            const role = typeof matchedUser.user_metadata?.role === 'string'
              ? matchedUser.user_metadata.role
              : profileMap.get(matchedUser.id)?.role
            return role === 'client'
          }) ||
          null

        if (matchedAuthUser) {
          const matchedProfile = profileMap.get(matchedAuthUser.id)
          existingProfile = {
            id: matchedAuthUser.id,
            full_name: clientMap.get(matchedAuthUser.id) ?? matchedProfile?.full_name ?? null
          }
        }
      }
    }

    if (existingProfile) {
      if (existingProfile.id === user.id) {
        return { error: 'That phone number belongs to your own advocate account. Please use the client account phone or invite link flow.' }
      }

      const ensureResult = await ensureProfileRow(existingProfile.id)
      if (!ensureResult.ok) return { error: ensureResult.error || 'Failed to prepare user for case participation' }

      // 3A. User exists -> Add to participants immediately using service role (bypasses RLS)
      const { error: partError } = await adminSupabase
        .from('case_participants')
        .insert({
          case_id: caseId,
          user_id: existingProfile.id,
          role: 'client'
        })
      
      if (partError) {
        if (partError.code === '23505') return { error: 'User is already a participant in this case' }
        throw partError
      }

      const { data: confirmedClientParticipant, error: confirmParticipantError } = await adminSupabase
        .from('case_participants')
        .select('user_id')
        .eq('case_id', caseId)
        .eq('user_id', existingProfile.id)
        .eq('role', 'client')
        .maybeSingle()

      if (confirmParticipantError) throw confirmParticipantError

      // Notify the client immediately that they've been added to the case
      if (confirmedClientParticipant?.user_id) {
        try {
        const { data: caseData } = await adminSupabase
          .from('cases')
          .select('title, case_number')
          .eq('id', caseId)
          .maybeSingle()

        const caseLabel = caseData?.title || caseData?.case_number || 'a case'

        await NotificationService.send({
          user_id: existingProfile.id,
          type: 'case_added',
          category: 'admin',
          title: '📁 You\'ve been added to a case',
          message: `Your advocate has added you to "${caseLabel}". Open the app to view your case details.`,
          metadata: {
            case_id: caseId,
            link: `/cases/${caseId}`,
            participant_role: 'client',
            recipient_user_id: existingProfile.id
          }
        })
        } catch (notifErr) {
          // Non-fatal: log but don't block success response
          console.error('⚠️ Failed to send case-added notification:', notifErr)
        }
      }

      revalidatePath(`/dashboard/advocate/cases/${caseId}`)
      return { success: `Added ${existingProfile.full_name || phone} to case`, type: 'added' as const }
    } else {
      // 3B. User does not exist -> Create a unique invite token
      const inviteToken = randomUUID()
      const { error: inviteError } = await adminSupabase
        .from('case_invites')
        .insert({
          case_id: caseId,
          phone: normalized.canonical,
          role: 'client',
          invited_by: user.id,
          token: inviteToken,
        })

      if (inviteError) throw inviteError

      // Generate the invite link for sharing
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000')
      if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
      const inviteLink = `${baseUrl}/invite/${inviteToken}`

      revalidatePath(`/dashboard/advocate/cases/${caseId}`)
      return { 
        success: `Invite link created! Share it via WhatsApp or SMS.`, 
        type: 'invited' as const,
        inviteLink,
        phone: normalized.canonical,
      }
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to invite client'
    console.error('Invite error:', err)
    return { error: message }
  }
}
