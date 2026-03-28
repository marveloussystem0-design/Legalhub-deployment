'use client';

import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { removeParticipantFromCase } from '@/app/dashboard/advocate/cases/actions';

interface RemoveParticipantButtonProps {
  caseId: string;
  userId: string;
  role: string;
  label: string;
}

export default function RemoveParticipantButton({
  caseId,
  userId,
  role,
  label,
}: RemoveParticipantButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Remove ${label} from this case?`)) return;

    setLoading(true);
    try {
      const result = await removeParticipantFromCase(caseId, userId, role);
      if (result.error) {
        alert(`Error: ${result.error}`);
        return;
      }

      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Unexpected error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs font-medium"
      title="Remove participant"
    >
      <UserMinus className="h-3.5 w-3.5" />
      {loading ? 'Removing...' : 'Remove'}
    </button>
  );
}
