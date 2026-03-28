import { NotificationService } from "@/lib/services/notifications";
import { NextResponse } from "next/server";

/**
 * Daily Notification Queue Processor
 *
 * Called twice per day:
 * - 7:00 PM IST (?date=tomorrow) => Evening push: "Hearing TOMORROW"
 * - 8:30 AM IST (?date=today) => Morning push: "Hearing TODAY"
 *
 * Security: Requires CRON_SECRET environment variable.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: "Cron job not configured" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const dateTarget: "today" | "tomorrow" = dateParam === "today" ? "today" : "tomorrow";

    console.log(`[Cron] Processing ${dateTarget} notification queue...`);

    const result = await NotificationService.processQueue(dateTarget);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to process notifications", details: result.error },
        { status: 500 }
      );
    }

    console.log(`[Cron] Sent ${result.processed} notifications, skipped ${result.duplicates} duplicates`);

    return NextResponse.json({
      success: true,
      date_target: dateTarget,
      processed: result.processed,
      duplicates: result.duplicates,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error", message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
