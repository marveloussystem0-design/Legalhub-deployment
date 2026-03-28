'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

type SelectableCase = {
  id: string;
  title: string | null;
  case_number: string | null;
  status: string | null;
  updated_at: string | null;
};

type StatusResponse = {
  selectionRequired: boolean;
  requiredSelectionCount: number;
  selectableCases: SelectableCase[];
  error?: string;
};

export default function SubscriptionDowngradeGuard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StatusResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/subscription/status', { cache: 'no-store' });
        const data = (await res.json()) as StatusResponse;
        if (!res.ok) throw new Error(data.error || 'Failed to load subscription status');
        setPayload(data);
        if (data.selectionRequired) {
          const initial = new Set(
            (data.selectableCases || [])
              .sort((a, b) => (new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()))
              .slice(0, data.requiredSelectionCount)
              .map((row) => row.id)
          );
          setSelectedIds(initial);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load subscription status');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const requiredCount = payload?.requiredSelectionCount || 30;
  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount === requiredCount && !saving;

  const sortedCases = useMemo(
    () =>
      (payload?.selectableCases || []).slice().sort((a, b) => {
        const aTs = new Date(a.updated_at || 0).getTime();
        const bTs = new Date(b.updated_at || 0).getTime();
        return bTs - aTs;
      }),
    [payload?.selectableCases]
  );

  const toggleCase = (caseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else if (next.size < requiredCount) {
        next.add(caseId);
      }
      return next;
    });
  };

  const saveSelection = async () => {
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/subscription/downgrade/select-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepCaseIds: Array.from(selectedIds) }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to save case selection');
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save case selection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking subscription status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
        {error}
      </div>
    );
  }

  if (!payload?.selectionRequired) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Downgrade Action Required</h3>
          <p className="text-xs text-amber-800 mt-1">
            Your plan is now Basic. Select exactly {requiredCount} cases to keep. Other cases will be removed from your workspace.
          </p>
          <p className="text-xs text-amber-900 font-semibold mt-2">
            Selected: {selectedCount} / {requiredCount}
          </p>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-amber-200 bg-white">
        {sortedCases.map((row) => {
          const checked = selectedIds.has(row.id);
          return (
            <label key={row.id} className="flex items-start gap-3 px-3 py-2 border-b border-amber-100 last:border-b-0 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCase(row.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-800">
                <span className="font-medium">{row.title || row.case_number || 'Untitled Case'}</span>
                {row.case_number ? <span className="text-xs text-gray-500 ml-2">({row.case_number})</span> : null}
              </span>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={saveSelection}
        className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save 30 Cases'}
      </button>
    </div>
  );
}
