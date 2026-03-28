import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getEffectiveSubscription } from "@/lib/billing/access";

type CreateTemplatePayload = {
  title?: string;
  category?: string;
  content?: string;
};

type UpdateTemplatePayload = {
  id?: string;
  title?: string;
  category?: string;
  content?: string;
};

async function getRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
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

    const role = await getRole(supabase, user.id);
    if (role !== "advocate") {
      return NextResponse.json({ templates: [] });
    }

    const subscription = await getEffectiveSubscription(admin, user.id);
    if (subscription.effectivePlan === "basic") {
      return NextResponse.json({ templates: [] });
    }

    const { data, error } = await supabase
      .from("draft_templates")
      .select("id, title, category, content, created_at, updated_at")
      .eq("created_by", user.id)
      .eq("is_system", false)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getRole(supabase, user.id);
    if (role !== "advocate") {
      return NextResponse.json({ error: "Only advocates can create templates" }, { status: 403 });
    }

    const subscription = await getEffectiveSubscription(admin, user.id);
    const body = (await req.json()) as CreateTemplatePayload;
    const title = (body.title || "").trim();
    const category = (body.category || "").trim();
    const content = (body.content || "").trim();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("draft_templates")
      .insert({
        title,
        category: category || null,
        content,
        is_system: false,
        created_by: user.id,
      })
      .select("id, title, category, content, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as UpdateTemplatePayload;
    const id = (body.id || "").trim();
    const title = (body.title || "").trim();
    const category = (body.category || "").trim();
    const content = (body.content || "").trim();

    if (!id || !title || !content) {
      return NextResponse.json({ error: "Id, title and content are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("draft_templates")
      .update({
        title,
        category: category || null,
        content,
      })
      .eq("id", id)
      .eq("created_by", user.id)
      .eq("is_system", false)
      .select("id, title, category, content, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = (searchParams.get("id") || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Template id is required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("draft_templates")
      .delete()
      .eq("id", id)
      .eq("created_by", user.id)
      .eq("is_system", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
