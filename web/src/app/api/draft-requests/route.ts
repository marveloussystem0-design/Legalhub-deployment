import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEffectiveSubscription } from "@/lib/billing/access";

type DraftRequestPayload = {
  subject?: string;
  message?: string;
};

type DraftRequestRow = {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
  draft_request_messages: Array<{
    id: string;
    sender_id: string;
    message: string;
    created_at: string;
  }>;
};

async function getProfileRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role || null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getProfileRole(supabase, user.id);
    if (role !== "advocate" && role !== "admin") {
      return NextResponse.json({ requests: [] });
    }

    let query = admin
      .from("draft_requests")
      .select(
        "id, subject, status, created_at, updated_at, draft_request_messages(id, sender_id, message, created_at)"
      )
      .order("updated_at", { ascending: false });

    if (role === "advocate") {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const requests = (data || []).map((request) => {
      const typed = request as unknown as DraftRequestRow;
      return {
        ...typed,
        draft_request_messages: [...(typed.draft_request_messages || [])].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      };
    });

    return NextResponse.json({ requests, role });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load draft requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();
    const service = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getProfileRole(supabase, user.id);
    if (role !== "advocate") {
      return NextResponse.json({ error: "Only advocates can create requests." }, { status: 403 });
    }

    const subscription = await getEffectiveSubscription(admin, user.id);
    if (subscription.effectivePlan !== "pro") {
      return NextResponse.json(
        { error: "Custom draft request desk is available only for Pro advocates." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as DraftRequestPayload;
    const subject = (body.subject || "").trim();
    const message = (body.message || "").trim();

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
    }

    const { data: requestRow, error: requestError } = await admin
      .from("draft_requests")
      .insert({
        user_id: user.id,
        subject,
        status: "open",
      })
      .select("id, subject, status, created_at, updated_at")
      .single();

    if (requestError || !requestRow) {
      return NextResponse.json({ error: requestError?.message || "Request creation failed." }, { status: 500 });
    }

    const { error: messageError } = await admin.from("draft_request_messages").insert({
      request_id: requestRow.id,
      sender_id: user.id,
      message,
    });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    if (admins && admins.length > 0) {
      await service.from("notifications").insert(
        admins.map((adminUser) => ({
          user_id: adminUser.id,
          title: "New Pro Draft Request",
          message: subject,
          type: "info",
          category: "admin",
          metadata: {
            kind: "draft_request",
            draft_request_id: requestRow.id,
            from_user_id: user.id,
          },
          is_read: false,
          push_sent: false,
        }))
      );
    }

    return NextResponse.json({
      request: {
        ...requestRow,
        draft_request_messages: [
          {
            id: "initial",
            sender_id: user.id,
            message,
            created_at: requestRow.created_at,
          },
        ],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create draft request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

