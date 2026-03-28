"use client";

import { X, Shield, Lock, FileText } from "lucide-react";
import { useEffect } from "react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "terms" | "privacy";
}

export default function TermsModal({ isOpen, onClose, initialTab = "terms" }: TermsModalProps) {
  void initialTab;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-teal-50 p-2 rounded-lg">
              <Shield className="h-5 w-5 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Legal Information</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50/50 text-slate-800 scroll-smooth">
            
            {/* Terms Section */}
            <section id="terms">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-teal-600" />
                    <h3 className="text-2xl font-bold text-slate-900">Terms of Service</h3>
                </div>
                <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4">
                    <p><strong>1. Introduction</strong><br/>Welcome to LegalHub. By accessing or using our platform, you agree to be bound by these Terms of Service.</p>
                    <p><strong>2. Definitions</strong><br/>&quot;Platform&quot; refers to LegalHub. &quot;Advocate&quot; refers to registered legal professionals. &quot;Litigant&quot; refers to clients.</p>
                    <p><strong>3. Responsibilities</strong><br/>Advocates warrant they are licensed professionals. We are a technology facilitator, not a law firm.</p>
                    <p><strong>4. eCourts Integration</strong><br/>Data imported from eCourts is for convenience only. Please verify with official records.</p>
                </div>
            </section>

            <hr className="border-slate-200" />

            {/* Privacy Section */}
            <section id="privacy">
                <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-5 w-5 text-teal-600" />
                    <h3 className="text-2xl font-bold text-slate-900">Privacy Policy</h3>
                </div>
                <div className="prose prose-slate max-w-none text-sm text-slate-600 space-y-4">
                    <p><strong>1. Data Collection</strong><br/>We collect Name, Email, Bar Council ID (if applicable), and Case Data you input.</p>
                    <p><strong>2. Usage</strong><br/>Data is used to provide case management and messaging services.</p>
                    <p><strong>3. Security</strong><br/>We use industry-standard encryption. Your case data is private.</p>
                    <p><strong>4. Sharing</strong><br/>We do not sell data to third parties.</p>
                </div>
            </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
            <button 
                onClick={onClose}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
            >
                Close & Continue
            </button>
        </div>

      </div>
    </div>
  );
}
