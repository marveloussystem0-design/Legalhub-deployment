'use client';

import { useState } from 'react';
import { updateCaseStatus } from '../actions';
import { Loader2, Archive, ArchiveRestore, CheckCircle2, XCircle, Handshake, ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CaseStatusToggle({ caseId, currentStatus }: { caseId: string, currentStatus: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();

    const handleToggle = async () => {
        if (currentStatus === 'open') {
            setIsModalOpen(true); // Open modal to select outcome
        } else {
            // Reopen case
            if (!confirm("Are you sure you want to reopen this case?")) return;
            await submitStatusChange('open');
        }
    };

    const submitStatusChange = async (newStatus: 'open' | 'closed', outcome?: string) => {
        setIsLoading(true);
        try {
            const result = await updateCaseStatus(caseId, newStatus, outcome);
            if (result.error) throw new Error(result.error);
            router.refresh();
            setIsModalOpen(false); // Close modal on success
        } catch (err: unknown) {
            alert('Failed to update status: ' + getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleToggle}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    currentStatus === 'open' 
                    ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30 border border-red-900/50' 
                    : 'bg-green-900/20 text-green-400 hover:bg-green-900/30 border border-green-900/50'
                }`}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentStatus === 'open' ? (
                    <>
                        <Archive className="h-4 w-4" />
                        Close Case
                    </>
                ) : (
                    <>
                        <ArchiveRestore className="h-4 w-4" />
                        Reopen Case
                    </>
                )}
            </button>

            {/* Outcome Selection Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl relative">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Close Case & Record Outcome</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            Select the final outcome of this case. This will be used to calculate your public Win Rate.
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <button
                                onClick={() => submitStatusChange('closed', 'won')}
                                className="flex flex-col items-center justify-center p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 transition-all group"
                            >
                                <CheckCircle2 className="h-8 w-8 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-green-800">Won</span>
                            </button>
                            
                            <button
                                onClick={() => submitStatusChange('closed', 'lost')}
                                className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all group"
                            >
                                <XCircle className="h-8 w-8 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-red-800">Lost</span>
                            </button>

                            <button
                                onClick={() => submitStatusChange('closed', 'settled')}
                                className="flex flex-col items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all group"
                            >
                                <Handshake className="h-8 w-8 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-blue-800">Settled</span>
                            </button>

                            <button
                                onClick={() => submitStatusChange('closed', 'dismissed')}
                                className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 hover:border-gray-300 transition-all group"
                            >
                                <ShieldOff className="h-8 w-8 text-gray-500 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-gray-700">Dismissed</span>
                            </button>
                        </div>

                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="w-full py-2.5 text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
    const getErrorMessage = (err: unknown) => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'string') return err;
        return 'Unknown error';
    };
