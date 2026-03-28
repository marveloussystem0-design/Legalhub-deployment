import Link from "next/link";
import { ArrowLeft, Shield, Lock } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
            <div className="flex items-center gap-2">
               <Shield className="h-5 w-5 text-teal-600" />
               <span className="font-bold text-lg">LegalHub</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-teal-50 p-3 rounded-xl">
              <Lock className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
              <p className="text-slate-500 mt-1">Last Updated: February 2, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="lead">
              At LegalHub, we prioritize the confidentiality and security of legal data. This Privacy Policy outlines how we collect, use, and protect your information.
            </p>

            <h3>1. Information We Collect</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, Email, Bar Council ID (for Advocates), and Profile details.</li>
              <li><strong>Case Data:</strong> Case details, client lists, hearings, and orders you input into the system.</li>
              <li><strong>Documents:</strong> Files uploaded to the &quot;My Documents&quot; section or attached to cases.</li>
            </ul>

            <h3>2. How We Use Your Information</h3>
            <p>
              We use your data solely to provide the Service:
            </p>
            <ul>
              <li>Manage your legal practice and cases.</li>
              <li>Facilitate secure messaging between Advocates and Litigants.</li>
              <li>Connect Advocates with potential clients via the Public Directory (only public profile data).</li>
            </ul>

            <h3>3. Data Protection</h3>
            <p>
              We employ industry-standard encryption protocols (SSL/TLS) for data in transit and at rest. Your private case notes and client communications are accessible only to you and authorized parties.
            </p>

            <h3>4. Third-Party Sharing</h3>
            <p>
              We do <strong>not</strong> sell your personal data. We may share data with service providers (e.g., cloud hosting, email delivery) strictly for operational purposes.
            </p>

            <h3>5. Contact Us</h3>
            <p>
              For privacy-related inquiries, please contact <a href="mailto:privacy@legalhub.in">privacy@legalhub.in</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
