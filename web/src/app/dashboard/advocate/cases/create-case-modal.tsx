'use client';

import { useState } from 'react';
import { importCaseFromECourts } from './actions';
import { fetchTNCaptchaAction } from '@/app/actions/ecourts-sync';
import { X, Loader2, Globe, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function CreateCaseModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    // Import State (CNR)
    const [cnr, setCnr] = useState('');
    const [captchaImage, setCaptchaImage] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [captchaCode, setCaptchaCode] = useState('');
    const [importStep, setImportStep] = useState<'init' | 'captcha' | 'success'>('init');
    const [importError, setImportError] = useState<string | null>(null);

    const startImport = async () => {
        setImportStep('captcha');
        setImportError(null);
        // Fetch Captcha
        const res = await fetchTNCaptchaAction();
        if (res.success && res.imageBase64) {
             setCaptchaImage(res.imageBase64);
             setSessionId(res.sessionId ?? null);
        } else {
            setImportError('Failed to load captcha. Please try again.');
        }
    };

    const confirmImport = async () => {
        if (!sessionId || !captchaCode) return;
        setIsSubmitting(true);
        setImportError(null);

        try {
            const formData = new FormData();
            formData.append('cnrNumber', cnr);
            formData.append('captcha', captchaCode);
            formData.append('sessionId', sessionId);
            
            const res = await importCaseFromECourts(formData);
            if (res.success) {
                setImportStep('success');
                setTimeout(() => {
                    setIsOpen(false);
                    router.refresh();
                    // Reset state
                    setImportStep('init');
                    setCnr('');
                    setCaptchaCode('');
                }, 2000);
            } else {
                setImportError(res.error || 'Failed to import case');
                // Do NOT auto-restart. Let user see error and click retry.
            }
        } catch (err: unknown) {
            setImportError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
                Add Case via CNR
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#2a2218] border border-amber-900/50 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        
                        {/* Header */}
                        <div className="p-4 border-b border-amber-900/30 flex justify-between items-start bg-[#1a1410]">
                            <div>
                                <h2 className="text-lg font-bold text-amber-50">Add Case via CNR</h2>
                                <p className="text-sm text-amber-400/60 mt-1">
                                    Enter the 16-digit CNR number to import case details from eCourts
                                </p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-amber-400 hover:text-amber-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        {/* Content - CNR Import Only */}
                        <div className="p-6 flex flex-col items-center justify-center min-h-[300px] bg-[#221a15]">
                            {importStep === 'init' && (
                                <div className="w-full space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-amber-100">CNR Number</label>
                                            <input 
                                                value={cnr}
                                                onChange={(e) => setCnr(e.target.value.toUpperCase())}
                                                placeholder="e.g., MCHC010012342023"
                                                maxLength={16}
                                                className="w-full px-4 py-3 bg-[#1a1410] border border-amber-900/30 rounded-lg text-amber-50 focus:border-teal-500 focus:outline-none font-mono text-center tracking-wider placeholder:text-amber-900/50" 
                                            />
                                        </div>

                                        <button 
                                            onClick={startImport}
                                            disabled={cnr.length < 16}
                                            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Globe className="h-4 w-4" />
                                            Search eCourts
                                        </button>
                                    </div>

                                    <div className="pt-4 border-t border-amber-900/20 text-center">
                                         <p className="text-xs text-amber-500/40">
                                            Only Tamil Nadu courts supported currently.
                                         </p>
                                    </div>
                                </div>
                            )}

                            {importStep === 'captcha' && (
                                <div className="w-full space-y-6 text-center">
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-semibold text-amber-50">Security Check</h3>
                                            <p className="text-sm text-amber-400/60">Enter the code shown below</p>
                                        </div>
                                        
                                        {captchaImage ? (
                                            <div className="bg-white p-2 rounded-lg inline-block shadow-lg">
                                                <Image src={captchaImage} alt="Captcha" width={220} height={64} unoptimized className="h-16 w-auto" />
                                            </div>
                                        ) : (
                                            <div className="h-20 flex items-center justify-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                                            </div>
                                        )}

                                        <input 
                                        value={captchaCode}
                                        onChange={(e) => setCaptchaCode(e.target.value)}
                                        placeholder="Enter Code"
                                        className="w-full px-4 py-3 text-center font-mono text-lg uppercase bg-[#1a1410] border border-amber-900/50 rounded-lg text-amber-50 focus:border-amber-500 focus:outline-none tracking-widest"
                                        maxLength={6}
                                        />

                                        {importError && (
                                            <div className="space-y-3">
                                                <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3">
                                                    <p className="text-red-400 text-sm flex items-center justify-center gap-2">
                                                        <X className="h-4 w-4" />
                                                        {importError}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={startImport}
                                                    className="text-sm text-teal-400 hover:text-teal-300 underline underline-offset-4"
                                                >
                                                    Try Again
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex gap-3 pt-2">
                                            <button 
                                                onClick={() => setImportStep('init')} 
                                                className="flex-1 py-2 text-amber-200 hover:text-amber-100 transition-colors text-sm font-medium"
                                            >
                                                Back
                                            </button>
                                            <button 
                                                onClick={confirmImport}
                                                disabled={!captchaCode || isSubmitting}
                                                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                                            >
                                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import Case'}
                                            </button>
                                        </div>
                                </div>
                            )}

                            {importStep === 'success' && (
                                <div className="text-center space-y-4 animate-in zoom-in duration-300 py-8">
                                    <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle className="h-10 w-10 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-amber-50">Case Linked!</h3>
                                        <p className="text-amber-200/60 mt-1">Successfully imported from eCourts.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
    const getErrorMessage = (err: unknown) => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'string') return err;
        return 'An unexpected error occurred';
    };
