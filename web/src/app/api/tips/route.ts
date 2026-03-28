import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_TIPS_PER_DAY = 5;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Internal Server Error";
}

/**
 * GET /api/tips
 * Returns all active tips, ordered by creation date desc.
 * Used by the TipsTicker component in the advocate dashboard.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: tips, error } = await supabase
      .from("advocate_tips")
      .select("id, content, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tips: tips || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/**
 * POST /api/tips
 * Adds a new tip. Admin only.
 * Enforces max 5 active tips per calendar day.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Auth guard
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

    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Enforce max 5 tips per day (using today's date in IST)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { count } = await supabase
      .from("advocate_tips")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString());

    if ((count ?? 0) >= MAX_TIPS_PER_DAY) {
      return NextResponse.json(
        { error: `You can only add up to ${MAX_TIPS_PER_DAY} tips per day. Come back tomorrow!` },
        { status: 429 }
      );
    }

    const { data, error } = await supabase
      .from("advocate_tips")
      .insert({ content: content.trim(), is_active: true })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ tip: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/**
 * PATCH /api/tips
 * Toggle is_active for a tip. Admin only.
 */
export async function PATCH(req: Request) {
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

    const { id, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { error } = await supabase
      .from("advocate_tips")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/tips
 * Deletes a tip. Admin only.
 */
export async function DELETE(req: Request) {
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

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { error } = await supabase.from("advocate_tips").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
