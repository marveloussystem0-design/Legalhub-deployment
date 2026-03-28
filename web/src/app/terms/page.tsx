import Link from "next/link";
import { ArrowLeft, Shield, Scale } from "lucide-react";

export default function TermsPage() {
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
               <Scale className="h-5 w-5 text-teal-600" />
               <span className="font-bold text-lg">LegalHub</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-teal-50 p-3 rounded-xl">
              <Shield className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
              <p className="text-slate-500 mt-1">Last Updated: January 29, 2026</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <p className="lead">
              Welcome to LegalHub. By accessing or using our website, mobile application, and services, you agree to be bound by these Terms of Service.
            </p>

            <h3>1. Definitions</h3>
            <ul>
              <li><strong>&quot;Platform&quot;</strong> refers to the LegalHub web and mobile applications.</li>
              <li><strong>&quot;Advocate&quot;</strong> refers to legal professionals registered on the platform.</li>
              <li><strong>&quot;Litigant&quot;</strong> refers to clients or individuals using the platform to access legal services.</li>
              <li><strong>&quot;Services&quot;</strong> includes case management, document drafting, public directory, and messaging features.</li>
            </ul>

            <h3>2. Role of Platform</h3>
            <p>
              LegalHub is a technology platform for practice management and connectivity. <strong>We are not a law firm</strong> and do not provide legal advice. Any information provided on the platform is for informational purposes only.
            </p>

            <h3>3. User Responsibilities</h3>
            <ul>
              <li><strong>Advocates:</strong> You warrant that you are a licensed legal professional with a valid Bar Council ID. You are responsible for the advice and services you provide to Litigants.</li>
              <li><strong>Litigants:</strong> You agree to provide accurate information and respect the professional time of Advocates.</li>
              <li><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your login credentials.</li>
            </ul>

            <h3>4. Data Privacy & Security</h3>
            <p>
              We take data security seriously.
            </p>
            <ul>
              <li><strong>Case Data:</strong> Client case data is encrypted and accessible only to authorized participants.</li>
              <li><strong>Public Directory:</strong> Advocates agree to display their professional information (Name, Experience, Specialization) in the public directory.</li>
              <li><strong>Messaging:</strong> Communication between Advocates and Litigants is private and encrypted in transit.</li>
            </ul>

            <h3>5. eCourts Integration</h3>
            <p>
              Our platform provides data imported from the eCourts system for convenience. While we strive for accuracy, we do not guarantee the real-time correctness of eCourts data. Users should verify critical hearing dates with official court records.
            </p>

            <h3>6. Subscription & Payments</h3>
            <ul>
              <li><strong>Free Trial:</strong> We may offer a free trial period. You will not be charged during this period.</li>
              <li><strong>Billing:</strong> Subscriptions are billed in advance on a monthly or annual basis.</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time.</li>
            </ul>

            <h3>7. Limitation of Liability</h3>
            <p>
              To the fullest extent permitted by law, LegalHub shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data.
            </p>

            <h3>8. Contact Us</h3>
            <p>
              If you have any questions about these Terms, please contact us at <a href="mailto:support@legalhub.in">support@legalhub.in</a>.
            </p>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-100 flex justify-center">
            <Link 
              href="/signup" 
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              I Agree, Return to Sign Up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
