"use client";

import { useState, useEffect, useTransition } from "react";
import { Lightbulb, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertTriangle } from "lucide-react";

type Tip = {
  id: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

const MAX_DAILY = 5;

export default function AdminTipsPage() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Count today's tips
  const todayStr = new Date().toLocaleDateString("en-CA");
  const todayCount = tips.filter(
    (t) => new Date(t.created_at).toLocaleDateString("en-CA") === todayStr
  ).length;
  const atLimit = todayCount >= MAX_DAILY;

  const fetchTips = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tips/admin");
      const data = await res.json();
      if (data.tips) setTips(data.tips);
      else setError(data.error || "Failed to load tips");
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTips(); }, []);

  const handleAdd = () => {
    if (!newContent.trim() || atLimit) return;
    setAddError(null);
    startTransition(async () => {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to add tip");
        return;
      }
      setNewContent("");
      await fetchTips();
    });
  };

  const handleToggle = async (tip: Tip) => {
    await fetch("/api/tips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tip.id, is_active: !tip.is_active }),
    });
    await fetchTips();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tip?")) return;
    await fetch("/api/tips", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchTips();
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Lightbulb className="h-7 w-7 text-amber-500" />
          Daily Tips
        </h1>
        <p className="text-gray-500 mt-1">
          Tips are shown to all advocates in the amber ticker bar. Max{" "}
          <strong>{MAX_DAILY} tips per day</strong>.
        </p>
      </div>

      {/* Add Tip Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Add New Tip</h2>

        {atLimit && (
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            Daily limit of {MAX_DAILY} tips reached. You can add more tomorrow.
          </div>
        )}

        {addError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            {addError}
          </p>
        )}

        <div className="flex gap-3">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newContent.length <= 200 && handleAdd()}
            placeholder="Write a practical legal tip for advocates..."
            disabled={atLimit || isPending}
            className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-sm disabled:opacity-50 disabled:bg-gray-50 transition-colors ${
                newContent.length > 200 
                ? "border-red-500 focus:ring-red-400 bg-red-50" 
                : "border-gray-200 focus:ring-amber-400"
            }`}
          />
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || atLimit || isPending || newContent.length > 200}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Tip
          </button>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className={newContent.length > 200 ? "text-red-600" : "text-gray-400"}>
              {newContent.length} / 200 characters
            </span>
            {newContent.length > 200 && (
              <span className="text-red-500 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" /> Tip is too long
              </span>
            )}
          </div>
          <p className={`text-xs font-medium ${atLimit ? "text-red-500" : "text-gray-500"}`}>
            {todayCount}/{MAX_DAILY} tips added today
          </p>
        </div>
      </div>

      {/* Tips List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">All Tips</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-10">{error}</p>
        ) : tips.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No tips yet.</p>
            <p className="text-sm">Add a tip above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tips.map((tip) => {
              const isToday =
                new Date(tip.created_at).toLocaleDateString("en-CA") === todayStr;
              return (
                <div
                  key={tip.id}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Status indicator */}
                  <div
                    className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      tip.is_active ? "bg-green-400" : "bg-gray-300"
                    }`}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium break-all ${
                        tip.is_active ? "text-gray-900" : "text-gray-400 line-through"
                      }`}
                    >
                      {tip.content}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tip.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isToday && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">
                          Today
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(tip)}
                      title={tip.is_active ? "Deactivate" : "Activate"}
                      className="text-gray-400 hover:text-amber-600 transition-colors"
                    >
                      {tip.is_active ? (
                        <ToggleRight className="h-6 w-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-300" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(tip.id)}
                      title="Delete tip"
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
