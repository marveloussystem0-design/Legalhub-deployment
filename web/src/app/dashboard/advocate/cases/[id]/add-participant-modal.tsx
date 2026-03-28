'use client';

import { useState } from 'react';
import { inviteClientToCase } from '../invite-actions';
import { X, Loader2, UserPlus, Mail, AlertCircle, CheckCircle, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AddParticipantModal({ caseId }: { caseId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        try {
            const formData = new FormData(e.currentTarget);
            const phone = formData.get('phone') as string;
            
            const result = await inviteClientToCase(caseId, phone);

            if (result.error) throw new Error(result.error);

            setMessage({ type: 'success', text: result.success || 'Action completed' });
            if (result.inviteLink) setInviteLink(result.inviteLink);

            if (result.type === 'added') {
                 setTimeout(() => {
                    setIsOpen(false);
                    setMessage(null);
                    setInviteLink(null);
                    router.refresh();
                }, 1500);
            }
        } catch (err: unknown) {
            setMessage({ type: 'error', text: getErrorMessage(err) });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
            >
                <UserPlus className="h-4 w-4" />
                Add Client
            </button>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#2a2218] border border-amber-900/50 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="p-4 border-b border-amber-900/30 flex justify-between items-center bg-[#1a1410] rounded-t-xl">
                            <h2 className="text-lg font-bold text-amber-50">Add/Invite Client</h2>
                            <button 
                                type="button"
                                onClick={() => setIsOpen(false)} 
                                className="text-amber-400 hover:text-amber-200 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-amber-100">Client Phone Number *</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500/50" />
                                    <input 
                                        name="phone" 
                                        type="tel"
                                        required
                                        placeholder="+91 98765 43210"
                                        pattern="[0-9+\s\-]{10,}"
                                        title="Please enter a valid phone number"
                                        className="w-full pl-9 pr-4 py-2 bg-[#1a1410] border border-amber-900/30 rounded-lg text-amber-50 focus:border-amber-600 focus:outline-none placeholder-amber-900/50"
                                    />
                                </div>
                                <p className="text-xs text-amber-200/50 mt-1">
                                    Enables sharing via WhatsApp/SMS. <br/>
                                    If they are registered, they will be added immediately.
                                </p>
                            </div>

                            {message && (
                                <div className={`p-3 rounded-lg text-sm flex flex-col gap-2 ${
                                    message.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-900/30' : 'bg-red-900/20 text-red-400 border border-red-900/30'
                                }`}>
                                    <div className="flex items-start gap-2">
                                        {message.type === 'success' ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
                                        {message.text}
                                    </div>

                                    {/* Share Buttons - Show only on success AND if inviteLink exists */}
                                    {message.type === 'success' && inviteLink && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-green-900/30">
                                            <a 
                                                href={`https://wa.me/?text=${encodeURIComponent(`Hi, please join my case (ID: ${caseId}) on LegalHub. Click to join: ${inviteLink}`)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                            >
                                                {/* WhatsApp Icon SVG */}
                                                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                Share via WhatsApp
                                            </a>
                                            <a 
                                                href={`sms:?body=${encodeURIComponent(`Hi, please join my case (ID: ${caseId}) on LegalHub. Click to join: ${inviteLink}`)}`}
                                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                            >
                                                <Mail className="h-4 w-4" />
                                                Share via SMS
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-3 border-t border-amber-900/30">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsOpen(false);
                                        setMessage(null);
                                        setInviteLink(null);
                                    }} 
                                    className="px-4 py-2 text-amber-200 hover:text-amber-100 text-sm"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Add Client'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
    const getErrorMessage = (err: unknown) => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'string') return err;
        return 'Unexpected error';
    };
