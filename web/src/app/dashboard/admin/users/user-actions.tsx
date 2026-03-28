'use client';

import { CheckCircle, Trash2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { verifyUser, unverifyUser, deleteUser } from "./actions";

interface UserActionsProps {
  userId: string;
  isVerified: boolean;
}

export default function UserActions({ userId, isVerified }: UserActionsProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnverifying, setIsUnverifying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localVerified, setLocalVerified] = useState(isVerified);

  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      await verifyUser(userId);
      setLocalVerified(true);
    } catch (error: unknown) {
      alert('Failed to verify user: ' + getErrorMessage(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnverify = async () => {
    if (!confirm('Are you sure you want to remove verification for this user?')) return;

    try {
      setIsUnverifying(true);
      await unverifyUser(userId);
      setLocalVerified(false);
    } catch (error: unknown) {
      alert('Failed to unverify user: ' + getErrorMessage(error));
    } finally {
      setIsUnverifying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      setIsDeleting(true);
      await deleteUser(userId);
    } catch (error: unknown) {
      alert('Failed to delete user: ' + getErrorMessage(error));
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      {!localVerified ? (
        <button
          onClick={handleVerify}
          disabled={isVerifying}
          title="Verify User"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          {isVerifying ? 'Verifying...' : 'Verify'}
        </button>
      ) : (
        <button
          onClick={handleUnverify}
          disabled={isUnverifying}
          title="Unverify User"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {isUnverifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          {isUnverifying ? 'Updating...' : 'Unverify'}
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        title="Delete User"
        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

