import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEffectiveSubscription } from "@/lib/billing/access";

type MessagePayload = {
  message?: string;
};

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const admin = await createAdminClient();
    const service = createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;
    if (role !== "advocate" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: requestRow } = await admin
      .from("draft_requests")
      .select("id, user_id, subject")
      .eq("id", id)
      .maybeSingle();

    if (!requestRow) {
      return NextResponse.json({ error: "Draft request not found" }, { status: 404 });
    }

    if (role === "advocate") {
      if (requestRow.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const subscription = await getEffectiveSubscription(admin, user.id);
      if (subscription.effectivePlan !== "pro") {
        return NextResponse.json(
          { error: "Only Pro advocates can continue custom draft chat." },
          { status: 403 }
        );
      }
    }

    const body = (await req.json()) as MessagePayload;
    const message = (body.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: insertedMessage, error } = await admin
      .from("draft_request_messages")
      .insert({
        request_id: id,
        sender_id: user.id,
        message,
      })
      .select("id, sender_id, message, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await admin
      .from("draft_requests")
      .update({ updated_at: now })
      .eq("id", id);

    if (role === "advocate") {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await service.from("notifications").insert(
          admins.map((adminUser) => ({
            user_id: adminUser.id,
            title: "Draft Request Follow-up",
            message: requestRow.subject,
            type: "info",
            category: "admin",
            metadata: {
              kind: "draft_request_message",
              draft_request_id: id,
              from_user_id: user.id,
            },
            is_read: false,
            push_sent: false,
          }))
        );
      }
    } else {
      await service.from("notifications").insert({
        user_id: requestRow.user_id,
        title: "Admin replied to your draft request",
        message: requestRow.subject,
        type: "info",
        category: "admin",
        metadata: {
          kind: "draft_request_message",
          draft_request_id: id,
          from_user_id: user.id,
        },
        is_read: false,
        push_sent: false,
      });
    }

    return NextResponse.json({ message: insertedMessage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

