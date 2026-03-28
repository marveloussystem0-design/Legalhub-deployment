
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { fetchTNCaptchaAction, submitTNCaptchaAction } from '@/app/actions/ecourts-sync';
import Image from 'next/image';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  cnrNumber: string;
}

export default function SyncModal({ isOpen, onClose, caseId, cnrNumber }: SyncModalProps) {
  const router = useRouter();
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTNCaptchaAction(cnrNumber);
      if (res.success && res.imageBase64) {
        setCaptchaImage(res.imageBase64);
        setSessionId(res.sessionId || '');
      } else {
        setError('Failed to load captcha. ' + (res.error || ''));
      }
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  }, [cnrNumber]);

  // Fetch Captcha when modal opens
  useEffect(() => {
    if (isOpen) {
      void loadCaptcha();
    }
    // Cleanup on close
    if (!isOpen) {
        setCaptchaImage(null);
        setCode('');
        setError(null);
        setSuccess(false);
    }
  }, [isOpen, loadCaptcha]);

  const handleSubmit = async () => {
    if (!code || !sessionId) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
        const res = await submitTNCaptchaAction(sessionId, code, cnrNumber, caseId);
        if (res.success) {
            setSuccess(true);
            router.refresh(); 
            setTimeout(() => {
                onClose();
            }, 1000);
        } else {
            setError(res.error || 'Incorrect Captcha');
            setCode('');
        }
    } catch {
        setError('Sync failed. Please try again.');
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 font-semibold text-lg text-gray-900">
            <RefreshCw className="h-5 w-5 text-teal-600" />
            Sync Case Status
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
            {success ? (
                <div className="flex flex-col items-center justify-center py-6 text-green-600 animate-in fade-in zoom-in">
                    <CheckCircle className="h-12 w-12 mb-2" />
                    <p className="font-semibold">Sync Complete</p>
                    <p className="text-sm text-gray-500">Dates updated from eCourts</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center justify-center border border-dashed border-gray-300 min-h-[120px]">
                        {isLoading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        ) : error ? (
                             <div className="text-center">
                                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                                <p className="text-sm text-red-600">{error}</p>
                                <button onClick={loadCaptcha} className="text-sm text-teal-600 hover:underline mt-2">Try Again</button>
                             </div>
                        ) : captchaImage ? (
                            <div className="text-center w-full">
                                <p className="text-xs text-gray-500 mb-2">Enter the code below to verify connection</p>
                                <div className="bg-white p-2 rounded border inline-block mb-2">
                                     <Image src={captchaImage} alt="Captcha" width={180} height={48} unoptimized className="h-12 w-auto object-contain" />
                                </div>
                                <br/>
                                <button onClick={loadCaptcha} className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 mx-auto">
                                    <RefreshCw className="h-3 w-3" /> Refresh Image
                                </button>
                            </div>
                        ) : (
                            <span className="text-sm text-gray-500">Waiting for eCourts...</span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input 
                            placeholder="ENTER CODE" 
                            value={code} 
                            onChange={(e) => setCode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (code && !isSubmitting && captchaImage) {
                                  handleSubmit();
                                }
                              }
                            }}
                            className="w-full px-4 py-3 text-center font-mono text-xl tracking-widest uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            maxLength={6}
                            disabled={isSubmitting || !captchaImage}
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 flex justify-between items-center border-t">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          {!success && (
              <button 
                onClick={handleSubmit} 
                disabled={!code || isSubmitting || !captchaImage}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                    </>
                ) : 'Sync Now'}
              </button>
          )}
        </div>
      </div>
    </div>
  );
}
