import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/lib/services/notifications";
import { NextResponse } from "next/server";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Internal Server Error";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    // Parse request body
    const { title, body, target_audience } = await request.json();

    // Validate input
    if (!title || !body || !target_audience) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["all", "advocates", "clients"].includes(target_audience)) {
      return NextResponse.json(
        { error: "Invalid target_audience" },
        { status: 400 },
      );
    }

    // Use centralized NotificationService for the broadcast
    const result = await NotificationService.broadcast({
      title,
      body,
      target_audience: target_audience as "all" | "advocates" | "clients",
      sent_by: user.id
    });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      recipient_count: result.recipient_count,
      push_count: result.push_count
    });

  } catch (error: unknown) {
    console.error("Broadcast notification error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
