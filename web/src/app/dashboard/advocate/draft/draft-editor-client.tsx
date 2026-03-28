'use client';

import { useEffect, useMemo, useState } from "react";
import { Download, FilePlus2, FileText, MessageSquareQuote, Printer, RotateCcw, Save, Share2, Trash2, X } from "lucide-react";
import DocumentEditor from "@/components/editor/document-editor";
import { draftTemplates } from "./templates";

type FieldKey = (typeof draftTemplates)[number]["fields"][number]["key"];
type FieldValues = Record<string, string>;

type UserTemplate = {
  id: string;
  title: string;
  category: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

type DraftRequestMessage = {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type DraftRequest = {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
  draft_request_messages: DraftRequestMessage[];
};

type CombinedTemplate = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  content: string;
  fields: Array<{ key: string; label: string }>;
  source: "system" | "user";
};

type DraftEditorClientProps = {
  allowedTemplateIds?: string[];
  planType?: "basic" | "medium" | "pro";
  canCreateTemplates?: boolean;
  canRequestCustomDraft?: boolean;
  currentUserId?: string;
};

const FIELD_DEFINITIONS = draftTemplates.flatMap((template) => template.fields).filter(
  (field, index, list) => index === list.findIndex((candidate) => candidate.key === field.key)
);

const DEFAULT_VALUES = FIELD_DEFINITIONS.reduce((acc, field) => {
  acc[field.key] = "";
  return acc;
}, {} as FieldValues);

function formatPlaceholderLabel(key: string) {
  return key
    .replace(/\s+/g, "_")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function extractPlaceholderFields(template: string) {
  const matches = Array.from(template.matchAll(/\[([^\[\]]+)\]/g));
  const uniqueFields = new Map<string, { key: string; label: string; rawToken: string }>();

  for (const match of matches) {
    const rawToken = (match[1] || "").trim();
    if (!rawToken) continue;

    const normalizedKey = rawToken
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalizedKey) continue;
    if (uniqueFields.has(normalizedKey)) continue;

    uniqueFields.set(normalizedKey, {
      key: normalizedKey,
      label: formatPlaceholderLabel(rawToken),
      rawToken,
    });
  }

  return Array.from(uniqueFields.values());
}

function applyFieldValues(
  template: string,
  values: FieldValues,
  fields: Array<{ key: string; label: string; rawToken?: string }>
) {
  return fields.reduce((content, field) => {
    const rawValue = values[field.key];
    const fallbackPlaceholder = `[${field.rawToken || field.key}]`;
    const replacement = (typeof rawValue === "string" ? rawValue.trim() : "") || fallbackPlaceholder;
    const candidateTokens = new Set([
      field.key,
      field.key.toLowerCase(),
      field.key.replace(/_/g, " "),
      field.key.replace(/_/g, " ").toLowerCase(),
      field.rawToken || "",
      (field.rawToken || "").toLowerCase(),
    ]);

    let nextContent = content;
    for (const token of candidateTokens) {
      const trimmedToken = token.trim();
      if (!trimmedToken) continue;
      const placeholder = `[${trimmedToken}]`;
      nextContent = nextContent.split(placeholder).join(replacement);
    }

    return nextContent;
  }, template);
}

export default function DraftEditorClient({
  allowedTemplateIds,
  planType,
  canCreateTemplates = false,
  canRequestCustomDraft = false,
  currentUserId,
}: DraftEditorClientProps) {
  const visibleSystemTemplates = useMemo(() => {
    if (!allowedTemplateIds) return draftTemplates;
    const allowed = new Set(allowedTemplateIds);
    return draftTemplates.filter((doc) => allowed.has(doc.id));
  }, [allowedTemplateIds]);

  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [draftRequests, setDraftRequests] = useState<DraftRequest[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [fieldValues, setFieldValues] = useState<FieldValues>(DEFAULT_VALUES);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [isCreateWindowOpen, setIsCreateWindowOpen] = useState(false);
  const [requestSubject, setRequestSubject] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingCurrentDraft, setIsSavingCurrentDraft] = useState(false);
  const [isDeletingCurrentDraft, setIsDeletingCurrentDraft] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [replyingToRequestId, setReplyingToRequestId] = useState<string | null>(null);

  const combinedTemplates = useMemo<CombinedTemplate[]>(() => {
    const systemTemplates: CombinedTemplate[] = visibleSystemTemplates.map((template) => ({
      id: template.id,
      title: template.title,
      subtitle: template.subtitle,
      description: template.description,
      content: template.content,
      fields: template.fields.map((field) => ({ key: field.key, label: field.label })),
      source: "system",
    }));

    const personalTemplates: CombinedTemplate[] = userTemplates.map((template) => ({
      id: template.id,
      title: template.title,
      subtitle: "Personal template",
      description: template.category ? `Category: ${template.category}` : "Created by you",
      content: template.content,
      fields: planType === "basic" ? [] : extractPlaceholderFields(template.content),
      source: "user",
    }));

    return [...systemTemplates, ...personalTemplates];
  }, [userTemplates, visibleSystemTemplates]);

  useEffect(() => {
    if (!canCreateTemplates) return;

    let active = true;

    async function loadTemplates() {
      setIsLoadingTemplates(true);
      try {
        const response = await fetch("/api/draft-templates", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load templates.");
        if (active) {
          setUserTemplates(payload.templates || []);
        }
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Failed to load templates.");
        }
      } finally {
        if (active) {
          setIsLoadingTemplates(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      active = false;
    };
  }, [canCreateTemplates]);

  useEffect(() => {
    if (!canRequestCustomDraft) return;

    let active = true;

    async function loadRequests() {
      setIsLoadingRequests(true);
      try {
        const response = await fetch("/api/draft-requests", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load draft requests.");
        if (active) {
          setDraftRequests(payload.requests || []);
        }
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Failed to load draft requests.");
        }
      } finally {
        if (active) {
          setIsLoadingRequests(false);
        }
      }
    }

    void loadRequests();

    return () => {
      active = false;
    };
  }, [canRequestCustomDraft]);

  useEffect(() => {
    if (!combinedTemplates.length) {
      setSelectedDocId("");
      setContent("");
      return;
    }

    if (!selectedDocId || !combinedTemplates.some((doc) => doc.id === selectedDocId)) {
      setSelectedDocId(combinedTemplates[0].id);
    }
  }, [combinedTemplates, selectedDocId]);

  const selectedDoc = combinedTemplates.find((doc) => doc.id === selectedDocId) || combinedTemplates[0];

  useEffect(() => {
    if (!selectedDoc) return;

    if (selectedDoc.fields.length === 0) {
      setContent(selectedDoc.content);
      return;
    }

    setContent(applyFieldValues(selectedDoc.content, fieldValues, selectedDoc.fields));
  }, [fieldValues, selectedDoc]);

  if (!combinedTemplates.length && !canCreateTemplates) {
    return (
      <div className="space-y-6 font-sans">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Draft</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Draft templates are not available in your current plan.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">Template access locked</p>
          <p className="mt-2 text-sm text-amber-800">
            Your current plan is <span className="font-bold uppercase">{planType || "basic"}</span>. Upgrade to Medium or Pro to access draft templates.
          </p>
        </div>
      </div>
    );
  }

  function handleTemplateChange(docId: string) {
    setSelectedDocId(docId);
    setStatus(null);
  }

  function handleFieldChange(key: string, value: string) {
    const nextValues = { ...fieldValues, [key]: value };
    setFieldValues(nextValues);
  }

  function resetTemplate() {
    if (!selectedDoc) return;
    setFieldValues(DEFAULT_VALUES);
    setContent(selectedDoc.content);
    setStatus(null);
  }

  function getDocumentFileName() {
    return `${(selectedDoc?.title || "draft").toLowerCase().replace(/\s+/g, "-")}.doc`;
  }

  const currentUserDraft =
    selectedDoc?.source === "user"
      ? userTemplates.find((template) => template.id === selectedDoc.id) || null
      : null;

  function buildWordHtml() {
    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <title>${selectedDoc?.title || "Draft"}</title>
          <style>
            body { font-family: "Times New Roman", serif; font-size: 14pt; line-height: 1.5; margin: 24mm 18mm; color: #111827; }
            h1, h2, h3, p { margin: 0 0 12px 0; }
            ol { margin: 0 0 12px 24px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `;
  }

  async function downloadWordDocument() {
    const blob = new Blob(["\ufeff", buildWordHtml()], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDocumentFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Word document downloaded.");
  }

  async function shareDraft() {
    const blob = new Blob(["\ufeff", buildWordHtml()], {
      type: "application/msword",
    });
    const file = new File([blob], getDocumentFileName(), {
      type: "application/msword",
    });

    try {
      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          title: selectedDoc?.title || "Draft",
          text: `${selectedDoc?.title || "Draft"} draft`,
          files: [file],
        });
        setStatus("Draft shared successfully.");
        return;
      }

      await navigator.clipboard.writeText(content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      setStatus("Sharing is not available here. Draft text was copied to clipboard.");
    } catch {
      setStatus("Unable to share the draft from this browser.");
    }
  }

  function printDraft() {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setStatus("Unable to open print preview.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedDoc?.title || "Draft"}</title>
          <style>
            body { font-family: "Times New Roman", serif; font-size: 14pt; line-height: 1.5; margin: 18mm; color: #111827; }
            h1, h2, h3, p { margin: 0 0 12px 0; }
            ol { margin: 0 0 12px 24px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setStatus("Print preview opened.");
  }

  async function savePersonalTemplate() {
    if (!templateTitle.trim() || !templateContent.trim()) {
      setStatus("Template title and content are required.");
      return;
    }

    setIsSavingTemplate(true);
    try {
      const response = await fetch("/api/draft-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: templateTitle,
          category: templateCategory,
          content: templateContent,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create template.");

      const template = payload.template as UserTemplate;
      setUserTemplates((current) => [template, ...current]);
      setSelectedDocId(template.id);
      setTemplateTitle("");
      setTemplateCategory("");
      setTemplateContent("");
      setIsCreateWindowOpen(false);
      setStatus("Personal template created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create template.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function saveCurrentDraft() {
    if (!currentUserDraft) return;

    setIsSavingCurrentDraft(true);
    try {
      const response = await fetch("/api/draft-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentUserDraft.id,
          title: currentUserDraft.title,
          category: currentUserDraft.category || "",
          content,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save draft.");

      const updatedTemplate = payload.template as UserTemplate;
      setUserTemplates((current) =>
        current.map((template) => (template.id === updatedTemplate.id ? updatedTemplate : template))
      );
      setStatus("Draft saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save draft.");
    } finally {
      setIsSavingCurrentDraft(false);
    }
  }

  async function deleteCurrentDraft() {
    if (!currentUserDraft) return;

    setIsDeletingCurrentDraft(true);
    try {
      const response = await fetch(`/api/draft-templates?id=${currentUserDraft.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to delete draft.");

      const nextTemplates = userTemplates.filter((template) => template.id !== currentUserDraft.id);
      setUserTemplates(nextTemplates);
      setSelectedDocId(nextTemplates[0]?.id || visibleSystemTemplates[0]?.id || "");
      setStatus("Draft deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete draft.");
    } finally {
      setIsDeletingCurrentDraft(false);
    }
  }

  async function createDraftRequest() {
    if (!requestSubject.trim() || !requestMessage.trim()) {
      setStatus("Request subject and message are required.");
      return;
    }

    setIsCreatingRequest(true);
    try {
      const response = await fetch("/api/draft-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: requestSubject,
          message: requestMessage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create draft request.");

      setDraftRequests((current) => [payload.request as DraftRequest, ...current]);
      setRequestSubject("");
      setRequestMessage("");
      setStatus("Draft request sent to admin.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create draft request.");
    } finally {
      setIsCreatingRequest(false);
    }
  }

  async function sendReply(requestId: string) {
    const message = (replyDrafts[requestId] || "").trim();
    if (!message) return;

    setReplyingToRequestId(requestId);
    try {
      const response = await fetch(`/api/draft-requests/${requestId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to send reply.");

      setDraftRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                draft_request_messages: [...request.draft_request_messages, payload.message],
              }
            : request
        )
      );
      setReplyDrafts((current) => ({ ...current, [requestId]: "" }));
      setStatus("Reply sent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send reply.");
    } finally {
      setReplyingToRequestId(null);
    }
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Draft</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            {planType === "basic"
              ? "Basic plan includes a plain drafting workspace where you can create and save your own drafts."
              : "Medium and Pro advocates can use templates and personal drafts. Pro also gets a direct draft request desk with admin."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {currentUserDraft && (
            <>
              <button
                type="button"
                onClick={saveCurrentDraft}
                disabled={isSavingCurrentDraft}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-70"
              >
                <Save className="h-4 w-4" />
                {isSavingCurrentDraft ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={deleteCurrentDraft}
                disabled={isDeletingCurrentDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:opacity-70"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingCurrentDraft ? "Deleting..." : "Delete Draft"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={resetTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700"
          >
            <RotateCcw className="h-4 w-4" />
            Restore Template
          </button>
        </div>
      </div>

      {status && (
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {status}
        </div>
      )}

      {canCreateTemplates && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FilePlus2 className="h-5 w-5 text-teal-700" />
                <h3 className="text-lg font-bold text-gray-900">
                  {planType === "basic" ? "Personal Draft Creation" : "Personal Draft Creation"}
                </h3>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {planType === "basic"
                  ? "Open a dedicated window to write and save your own drafts like a simple word processor."
                  : "Open a dedicated window to create your own reusable draft. Use placeholders like `[CLIENT_NAME]`."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isLoadingTemplates && <span className="text-xs text-gray-500">Loading your drafts...</span>}
              <button
                type="button"
                onClick={() => setIsCreateWindowOpen(true)}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                New Personal Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {canCreateTemplates && isCreateWindowOpen && (
        <div className="rounded-2xl border border-teal-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-teal-100 px-5 py-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Create Personal Draft</h3>
              <p className="mt-1 text-sm text-gray-600">
                Draft normally in the editor below. Any text inside square brackets will become a detected placeholder after saving.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateWindowOpen(false)}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
              aria-label="Close create personal draft window"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Draft Title
                    </span>
                    <input
                      type="text"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      placeholder="For example: Private Complaint Draft"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Category
                    </span>
                    <input
                      type="text"
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value)}
                      placeholder="For example: Criminal"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-500"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">{planType === "basic" ? "Drafting tip" : "Placeholder tip"}</p>
                <p className="mt-2">
                  {planType === "basic"
                    ? "Write and format your draft normally. Basic drafts are saved as simple editable documents."
                    : "Type placeholders inside square brackets like `[PETITIONER_NAME]`, `[COURT_NAME]`, `[CASE_NO]`. After saving, the system will detect them automatically."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={savePersonalTemplate}
                  disabled={isSavingTemplate}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-70"
                >
                  {isSavingTemplate ? "Saving..." : "Save Personal Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateWindowOpen(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="min-h-[72vh] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
              <DocumentEditor
                content={templateContent}
                onUpdate={setTemplateContent}
                editable
                isLegalFormat
                showStampPlaceholder={false}
                legalPageClassName="pt-[22mm] pl-[24mm] pr-[24mm] pb-[28mm]"
              />
            </div>
          </div>
        </div>
      )}

      {canRequestCustomDraft && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-900">Pro Draft Request Desk</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Request a custom draft from admin and continue the conversation in-thread.
          </p>

          <div className="mt-4 grid gap-3">
            <input
              type="text"
              value={requestSubject}
              onChange={(e) => setRequestSubject(e.target.value)}
              placeholder="Request subject"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-slate-500"
            />
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={4}
              placeholder="Describe what draft you need"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-slate-500"
            />
            <button
              type="button"
              onClick={createDraftRequest}
              disabled={isCreatingRequest}
              className="w-fit rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-70"
            >
              {isCreatingRequest ? "Sending..." : "Send Request"}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-slate-900">Request Threads</p>
            {isLoadingRequests && <p className="text-xs text-slate-500">Loading request threads...</p>}
            {!isLoadingRequests && draftRequests.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No draft requests yet.
              </div>
            )}
            {draftRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{request.subject}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {request.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {request.draft_request_messages.map((message) => {
                    const ownMessage = currentUserId === message.sender_id;
                    return (
                      <div
                        key={message.id}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          ownMessage ? "bg-teal-50 text-teal-900" : "bg-gray-50 text-gray-800"
                        }`}
                      >
                        <p>{message.message}</p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={replyDrafts[request.id] || ""}
                    onChange={(e) =>
                      setReplyDrafts((current) => ({ ...current, [request.id]: e.target.value }))
                    }
                    placeholder="Reply to admin"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => sendReply(request.id)}
                    disabled={replyingToRequestId === request.id}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-70"
                  >
                    {replyingToRequestId === request.id ? "Sending..." : "Reply"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadWordDocument}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          <Download className="h-4 w-4" />
          Download Word
        </button>
        <button
          type="button"
          onClick={shareDraft}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        <button
          type="button"
          onClick={printDraft}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Document Format</label>
              <select
                value={selectedDocId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-500"
              >
                {combinedTemplates.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} {doc.source === "user" ? "(Personal)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedDoc && (
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white p-2 text-teal-700 shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-teal-900">{selectedDoc.title}</h3>
                    <p className="mt-1 text-xs font-medium text-teal-700">{selectedDoc.subtitle}</p>
                    <p className="mt-2 text-sm text-teal-900/80">{selectedDoc.description}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedDoc?.source === "system" && selectedDoc.fields.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-900">Essential Details</p>
                <div className="space-y-3">
                  {selectedDoc.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                        {field.label}
                      </span>
                      <input
                        type="text"
                        value={fieldValues[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={`[${field.key}]`}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {planType !== "basic" && selectedDoc?.source === "user" && selectedDoc.fields.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-900">Detected Placeholders</p>
                <div className="space-y-3">
                  {selectedDoc.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                        {field.label}
                      </span>
                      <input
                        type="text"
                        value={fieldValues[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={`[${field.key}]`}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {planType === "basic" ? "How to create and save a draft" : "How to create a new personal draft"}
              </p>
              <p className="mt-2">
                {planType === "basic"
                  ? "Open the personal draft window, write the document, save it, then pick it from the format list and continue editing anytime."
                  : "Open the personal draft window, write the document, save it, then pick it from the format list and edit it like any other draft."}
              </p>
            </div>
          </div>

          <div className="min-h-[78vh] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
            <DocumentEditor
              content={content}
              onUpdate={setContent}
              editable
              isLegalFormat
              showStampPlaceholder={false}
              legalPageClassName="pt-[22mm] pl-[24mm] pr-[24mm] pb-[28mm]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
