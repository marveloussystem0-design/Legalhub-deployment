'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteCase } from '@/app/dashboard/advocate/cases/actions';

interface DeleteCaseButtonProps {
    caseId: string;
}

export default function DeleteCaseButton({ caseId }: DeleteCaseButtonProps) {
    const [loading, setLoading] = useState(false);

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'Unexpected error';
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to permanently delete this case? This action cannot be undone.')) return;

        setLoading(true);
        try {
            const result = await deleteCase(caseId);
            if (result.error) {
                alert(`Error: ${result.error}`);
            } else {
                // Success - redirect will happen via server action or we force it here
                alert('Case deleted successfully.');
                window.location.href = '/dashboard/advocate/cases';
            }
        } catch (e: unknown) {
            alert(`Unexpected error: ${getErrorMessage(e)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 hover:bg-red-100 transition-colors text-sm shadow-sm font-medium flex items-center gap-2"
        >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Deleting...' : 'Delete Case'}
        </button>
    );
}
