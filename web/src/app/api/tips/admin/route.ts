import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Internal Server Error";
}

/**
 * GET /api/tips/admin
 * Returns ALL tips (active + inactive) for the admin panel.
 * Admin only.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: tips, error } = await supabase
      .from("advocate_tips")
      .select("id, content, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ tips: tips || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
