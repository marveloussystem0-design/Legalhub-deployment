"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateCaseTitleAction(caseId: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const trimmedTitle = title.trim();

  const { data: accessRows, error: accessError } = await supabase
    .from("case_participants")
    .select("case_id")
    .eq("case_id", caseId)
    .eq("user_id", user.id)
    .limit(1);

  if (accessError) {
    console.error("Error checking case access:", accessError);
    return { success: false, error: "Failed to verify case access" };
  }

  const { data: ownedCase, error: ownedCaseError } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (ownedCaseError) {
    console.error("Error checking owned case access:", ownedCaseError);
    return { success: false, error: "Failed to verify case access" };
  }

  if (!accessRows?.length && !ownedCase) {
    return { success: false, error: "You do not have access to this case" };
  }

  let error = null;

  if (trimmedTitle) {
    const result = await supabase
      .from("case_user_preferences")
      .upsert(
        {
          case_id: caseId,
          user_id: user.id,
          display_title: trimmedTitle,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "case_id,user_id" }
      );
    error = result.error;
  } else {
    const result = await supabase
      .from("case_user_preferences")
      .delete()
      .eq("case_id", caseId)
      .eq("user_id", user.id);
    error = result.error;
  }

  if (error) {
    console.error("Error updating case title:", error);
    return { success: false, error: "Failed to update case title" };
  }

  revalidatePath(`/dashboard/advocate/cases/${caseId}`);
  revalidatePath("/dashboard/advocate");
  revalidatePath("/dashboard/advocate/cases");
  revalidatePath("/dashboard/advocate/search");

  return { success: true };
}
