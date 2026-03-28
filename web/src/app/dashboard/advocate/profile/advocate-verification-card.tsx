
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

type AdvocateProfile = {
  full_name?: string | null;
  is_verified?: boolean | null;
  verification_source?: string | null;
  badge_expires_at?: string | null;
};

export function AdvocateVerificationCard({ userProfile }: { userProfile: AdvocateProfile | null }) {
  const [step, setStep] = useState<'INIT' | 'OTP' | 'VERIFIED'>('INIT');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formData, setFormData] = useState({
    enrollmentNumber: '',
    mobileNumber: '',
    otp: ''
  });

  const handleInit = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/verify-advocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'INIT',
          enrollmentNumber: formData.enrollmentNumber,
          mobileNumber: formData.mobileNumber,
          advocateName: userProfile?.full_name || 'Advocate'
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'OTP sent to your mobile number' });
        setStep('OTP');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send OTP' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network connection failed' });
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/verify-advocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY',
          otp: formData.otp
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile Verified Successfully!' });
        setStep('VERIFIED');
        // Reload page to reflect verified status in main profile after a short delay
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Verification Failed' });
        // Don't reset step immediately on error, allow retry
      }
    } catch {
      setMessage({ type: 'error', text: 'Network connection failed' });
    }
    setLoading(false);
  };

  if (userProfile?.is_verified || step === 'VERIFIED') {
    const sourceLabel =
      userProfile?.verification_source === 'pro'
        ? 'Included with your Pro plan.'
        : userProfile?.verification_source === 'badge'
        ? `Active via Verify Badge${userProfile.badge_expires_at ? ` until ${new Date(userProfile.badge_expires_at).toLocaleDateString()}` : '.'}`
        : 'Your advocate profile is currently verified.';

    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-green-900">Verified Advocate</h3>
            <p className="text-green-700 text-sm mt-1">{sourceLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 pb-4 border-b border-gray-100">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          Verify Profile
          <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs border border-yellow-200 font-medium">Pending</span>
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Sync your details with the Bar Council of Tamil Nadu & Puducherry.
        </p>
      </div>
      
      <div className="p-6 space-y-4">
        {message && (
          <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
            {message.text}
          </div>
        )}

        {step === 'INIT' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Enrollment Number</label>
              <input 
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm"
                placeholder="e.g. Ms/123/2023" 
                value={formData.enrollmentNumber}
                onChange={(e) => setFormData({...formData, enrollmentNumber: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Registered Mobile Number</label>
              <input 
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm"
                placeholder="9876543210" 
                maxLength={10}
                value={formData.mobileNumber}
                onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Must match the number registered with Bar Council.
              </p>
            </div>
          </>
        )}

        {step === 'OTP' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Enter OTP</label>
            <input 
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors text-sm"
              placeholder="123456" 
              maxLength={6}
              value={formData.otp}
              onChange={(e) => setFormData({...formData, otp: e.target.value})}
            />
            <p className="text-xs text-gray-500">
              Please enter the OTP sent to {formData.mobileNumber}
            </p>
            <button 
              onClick={() => setStep('INIT')} 
              className="text-xs text-teal-600 hover:underline"
            >
              Change Details
            </button>
          </div>
        )}
      </div>

      <div className="p-6 pt-0">
        {step === 'INIT' ? (
          <button 
            onClick={handleInit} 
            disabled={loading || !formData.enrollmentNumber || !formData.mobileNumber} 
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send OTP
          </button>
        ) : (
          <button 
            onClick={handleVerify} 
            disabled={loading || !formData.otp} 
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify & Sync
          </button>
        )}
      </div>
    </div>
  );
}
