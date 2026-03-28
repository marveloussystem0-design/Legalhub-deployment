import DraftEditorClient from "./draft-editor-client";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveSubscription } from "@/lib/billing/access";
import { createAdminClient } from "@/utils/supabase/server";
import { draftTemplates } from "./templates";

export const dynamic = "force-dynamic";

export default async function AdvocateDraftPage() {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <DraftEditorClient allowedTemplateIds={[]} planType="basic" />;
  }

  const subscription = await getEffectiveSubscription(
    admin,
    user.id
  );

  let allowedTemplateIds: string[] = [];
  if (subscription.effectivePlan === "medium") {
    allowedTemplateIds = draftTemplates
      .filter((template) => (template.tier ?? "minimal") === "minimal")
      .map((template) => template.id);
  } else if (subscription.effectivePlan === "pro") {
    allowedTemplateIds = draftTemplates.map((template) => template.id);
  }

  return (
    <DraftEditorClient
      allowedTemplateIds={allowedTemplateIds}
      planType={subscription.effectivePlan}
      canCreateTemplates
      canRequestCustomDraft={subscription.effectivePlan === "pro"}
      currentUserId={user.id}
    />
  );
}
