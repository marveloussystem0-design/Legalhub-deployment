'use client';

import { useEffect, useState } from "react";

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

export default function AdminDraftRequestsClient() {
  const [requests, setRequests] = useState<DraftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingToRequestId, setReplyingToRequestId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRequests() {
      setLoading(true);
      try {
        const response = await fetch("/api/draft-requests", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load draft requests.");
        if (active) {
          setRequests(payload.requests || []);
        }
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Failed to load draft requests.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRequests();

    return () => {
      active = false;
    };
  }, []);

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

      setRequests((current) =>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Draft Requests</h1>
        <p className="mt-2 text-sm text-gray-600">
          Pro advocates can request custom drafts here. Reply from this panel to continue the thread.
        </p>
      </div>

      {status && (
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {status}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Loading draft requests...
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          No draft requests yet.
        </div>
      )}

      {!loading &&
        requests.map((request) => (
          <div key={request.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{request.subject}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Opened on {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {request.status}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {request.draft_request_messages.map((message) => (
                <div key={message.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">
                  <p>{message.message}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={replyDrafts[request.id] || ""}
                onChange={(e) =>
                  setReplyDrafts((current) => ({ ...current, [request.id]: e.target.value }))
                }
                placeholder="Reply to advocate"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-500"
              />
              <button
                type="button"
                onClick={() => sendReply(request.id)}
                disabled={replyingToRequestId === request.id}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-70"
              >
                {replyingToRequestId === request.id ? "Sending..." : "Reply"}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
