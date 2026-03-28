import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { normalizePhone } from '@/lib/phone';
import { NotificationService } from '@/lib/services/notifications';

interface InvitePayload {
  caseId?: string;
  phone?: string;
  action?: 'lookup_or_invite' | 'add_existing';
  userId?: string;
}

type ClientRow = { user_id: string; full_name: string | null };
type ProfileCandidate = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  role?: string | null;
};

async function pickBestClientMatch(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  profileRows: ProfileCandidate[]
) {
  if (profileRows.length === 0) return null;

  const { data: clientRows, error: clientLookupError } = await admin
    .from('clients')
    .select('user_id, full_name')
    .in('user_id', profileRows.map((row) => row.id));

  if (clientLookupError) throw clientLookupError;

  const clientMap = new Map((clientRows || []).map((row: ClientRow) => [row.user_id, row.full_name ?? null]));
  const preferredProfile =
    profileRows.find((row) => clientMap.has(row.id)) ||
    profileRows.find((row) => row.role === 'client') ||
    null;

  if (!preferredProfile) return null;

  return {
    id: preferredProfile.id,
    full_name: clientMap.get(preferredProfile.id) ?? preferredProfile.full_name ?? null,
    phone: preferredProfile.phone ?? null,
    email: preferredProfile.email ?? null
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    const user = token
      ? (await supabase.auth.getUser(token)).data.user
      : (await supabase.auth.getUser()).data.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as InvitePayload;
    const caseId = payload.caseId;
    const phone = payload.phone;
    const action = payload.action || 'lookup_or_invite';
    const userId = payload.userId;
    if (!caseId || !phone) {
      return NextResponse.json(
        { error: 'caseId and phone are required' },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    if (normalized.digits.length < 10) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 }
      );
    }

    // Authorization: inviter must own the case or be advocate participant.
    const [{ data: ownedCase }, { data: participant }] = await Promise.all([
      admin
        .from('cases')
        .select('id')
        .eq('id', caseId)
        .eq('created_by', user.id)
        .maybeSingle(),
      admin
        .from('case_participants')
        .select('id')
        .eq('case_id', caseId)
        .eq('user_id', user.id)
        .eq('role', 'advocate')
        .maybeSingle()
    ]);

    if (!ownedCase && !participant) {
      return NextResponse.json(
        { error: 'You do not have permission to invite for this case' },
        { status: 403 }
      );
    }

    const ensureProfileRow = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
      const { data: authData } = await admin.auth.admin.getUserById(userId);
      const authUser = authData?.user;
      const metadata = (authUser?.user_metadata as Record<string, unknown> | null) || null;
      const metadataPhone = typeof metadata?.phone === 'string' ? metadata.phone : null;
      const metadataRole = typeof metadata?.role === 'string' ? metadata.role : 'client';
      const metadataFullName = typeof metadata?.full_name === 'string' ? metadata.full_name : null;

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
      ];

      let lastErr: { code?: string; message?: string } | null = null;
      for (const row of candidates) {
        const { error } = await admin
          .from('profiles')
          .upsert(row, { onConflict: 'id' });
        if (!error) return { ok: true };
        lastErr = error;
        if (error.code !== '42703' && error.code !== '23502') break;
      }

      return { ok: false, error: lastErr?.message || 'Failed to ensure profile row' };
    };

    // Existing registered profile -> return candidate card first.
    const { data: profileMatches, error: profileErr } = await admin
      .from('profiles')
      .select('id, full_name, phone, email, role')
      .in('phone', normalized.candidates)

    if (profileErr) {
      return NextResponse.json(
        { error: profileErr.message || 'Failed to lookup profile' },
        { status: 500 }
      );
    }

    let existingProfile:
      | { id: string; full_name: string | null; phone: string | null; email: string | null }
      | null = await pickBestClientMatch(admin, profileMatches || []);

    if (!existingProfile) {
      const authUsers: Array<{
        id: string;
        phone?: string | null;
        email?: string | null;
        user_metadata?: Record<string, unknown> | null;
      }> = [];

      let page = 1;
      const perPage = 200;
      while (page <= 5) {
        const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
          page,
          perPage
        });

        if (listErr) {
          return NextResponse.json(
            { error: listErr.message || 'Failed to lookup auth users' },
            { status: 500 }
          );
        }

        const users = listed?.users || [];
        authUsers.push(
          ...users.map((u) => ({
            id: u.id,
            phone: u.phone,
            email: u.email,
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
        const matchedIds = matchedAuthUsers.map((matchedUser) => matchedUser.id);
        const [{ data: matchedProfiles }, { data: matchedClients }] = await Promise.all([
          admin
            .from('profiles')
            .select('id, full_name, role')
            .in('id', matchedIds),
          admin
            .from('clients')
            .select('user_id, full_name')
            .in('user_id', matchedIds)
        ]);

        const clientMap = new Map((matchedClients || []).map((row: ClientRow) => [row.user_id, row.full_name ?? null]));
        const profileMap = new Map(
          (matchedProfiles || []).map((row: Pick<ProfileCandidate, 'id' | 'full_name' | 'role'>) => [row.id, row])
        );
        const matchedAuthUser =
          matchedAuthUsers.find((matchedUser) => clientMap.has(matchedUser.id)) ||
          matchedAuthUsers.find((matchedUser) => {
            const role = typeof matchedUser.user_metadata?.role === 'string'
              ? matchedUser.user_metadata.role
              : profileMap.get(matchedUser.id)?.role;
            return role === 'client';
          }) ||
          null;

        if (matchedAuthUser) {
          const matchedProfile = profileMap.get(matchedAuthUser.id);
          existingProfile = {
            id: matchedAuthUser.id,
            full_name: clientMap.get(matchedAuthUser.id) ?? matchedProfile?.full_name ?? null,
            phone: (matchedAuthUser.phone as string | null) ?? null,
            email: (matchedAuthUser.email as string | null) ?? null
          };
        }
      }
    }

    if (existingProfile) {
      if (existingProfile.id === user.id) {
        return NextResponse.json(
          { error: 'That phone number belongs to your own advocate account. Please use the client account phone or invite link flow.' },
          { status: 400 }
        );
      }

      const ensureResult = await ensureProfileRow(existingProfile.id);
      if (!ensureResult.ok) {
        return NextResponse.json(
          { error: ensureResult.error || 'Failed to prepare user for case participation' },
          { status: 500 }
        );
      }

      if (action === 'add_existing') {
        if (!userId || userId !== existingProfile.id) {
          return NextResponse.json(
            { error: 'Invalid selected user' },
            { status: 400 }
          );
        }

        const { data: existingParticipant, error: existingParticipantError } = await admin
          .from('case_participants')
          .select('id')
          .eq('case_id', caseId)
          .eq('user_id', existingProfile.id)
          .eq('role', 'client')
          .maybeSingle();

        if (existingParticipantError) {
          return NextResponse.json(
            { error: existingParticipantError.message || 'Failed to check existing participant' },
            { status: 500 }
          );
        }

        let addErr = null;
        if (!existingParticipant) {
          const insertResult = await admin
            .from('case_participants')
            .insert({
              case_id: caseId,
              user_id: existingProfile.id,
              role: 'client'
            });
          addErr = insertResult.error;
        }

        if (addErr) {
          return NextResponse.json(
            { error: addErr.message || 'Failed to add participant' },
            { status: 500 }
          );
        }

        const { data: confirmedClientParticipant, error: confirmParticipantError } = await admin
          .from('case_participants')
          .select('user_id')
          .eq('case_id', caseId)
          .eq('user_id', existingProfile.id)
          .eq('role', 'client')
          .maybeSingle();

        if (confirmParticipantError) {
          return NextResponse.json(
            { error: confirmParticipantError.message || 'Failed to verify participant' },
            { status: 500 }
          );
        }

        // Notify the client immediately that they've been added to the case
        if (confirmedClientParticipant?.user_id) {
          try {
          const { data: caseData } = await admin
            .from('cases')
            .select('title, case_number')
            .eq('id', caseId)
            .maybeSingle();

          const caseLabel = caseData?.title || caseData?.case_number || 'a case';

          await NotificationService.send({
            user_id: existingProfile.id,
            type: 'case_added',
            category: 'admin',
            title: "📁 You've been added to a case",
            message: `Your advocate has added you to "${caseLabel}". Open the app to view your case details.`,
            metadata: {
              case_id: caseId,
              link: `/cases/${caseId}`,
              participant_role: 'client',
              recipient_user_id: existingProfile.id
            }
          });
          } catch (notifErr) {
            // Non-fatal: log but don't block success
            console.error('⚠️ Failed to send case-added notification:', notifErr);
          }
        }

        return NextResponse.json({
          success: `Added ${existingProfile.full_name || normalized.canonical} to case`,
          type: 'added'
        });
      }

      const maskedPhone = existingProfile.phone
        ? String(existingProfile.phone).replace(/^(.{2}).+(.{2})$/, '$1******$2')
        : null;
      const maskedEmail = existingProfile.email
        ? String(existingProfile.email).replace(/^(.{2}).+(@.+)$/, '$1***$2')
        : null;

      return NextResponse.json({
        type: 'existing_found',
        candidate: {
          id: existingProfile.id,
          full_name: existingProfile.full_name || 'Existing User',
          phone: maskedPhone,
          email: maskedEmail
        }
      });
    }

    if (action === 'add_existing') {
      return NextResponse.json(
        { error: 'No existing client found for this phone' },
        { status: 404 }
      );
    }

    // New user -> create invite token.
    const inviteToken = randomUUID();
    const { error: inviteErr } = await admin
      .from('case_invites')
      .insert({
        case_id: caseId,
        phone: normalized.canonical,
        role: 'client',
        invited_by: user.id,
        token: inviteToken
      });

    if (inviteErr) {
      return NextResponse.json(
        { error: inviteErr.message || 'Failed to create invite' },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000');
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL is not configured' },
        { status: 500 }
      );
    }
    const inviteLink = `${baseUrl}/invite/${inviteToken}`;

    return NextResponse.json({
      success: 'Invite link created',
      type: 'invited',
      inviteLink,
      phone: normalized.canonical
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to invite client';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
