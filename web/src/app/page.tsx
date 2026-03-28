import Link from "next/link";
import Image from "next/image";
import { Scale, Search, FileText, Brain, Shield, Users, ArrowRight, CheckCircle2, BookOpen, Award, Clock, Briefcase, ChevronRight, Twitter, Linkedin, Facebook } from "lucide-react";
import { Suspense } from "react";
import { AuthRedirectHandler } from "@/components/auth-redirect-handler";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      <Suspense fallback={null}>
        <AuthRedirectHandler />
      </Suspense>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-teal-600 to-teal-700 p-2.5 rounded-xl shadow-md">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                LegalHub
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-slate-600 hover:text-teal-600 font-medium transition-colors">Features</Link>
              <Link href="#how-it-works" className="text-slate-600 hover:text-teal-600 font-medium transition-colors">How It Works</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/login" 
                className="text-slate-600 hover:text-teal-700 font-semibold transition-colors hidden sm:block"
              >
                Sign In
              </Link>
              <Link 
                href="/signup" 
                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-teal-600/20 transition-all border border-teal-500 hover:scale-[1.02]"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-br from-teal-700 to-teal-800 text-white">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/law-books.png"
            alt="Law Library"
            fill
            className="object-cover opacity-20 mix-blend-overlay"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-teal-900/50 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-teal-800/50 border border-teal-400/30 rounded-full px-4 py-2 text-teal-100 text-sm font-semibold backdrop-blur-sm shadow-sm hover:bg-teal-800/70 transition-colors">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-300"></span>
              </span>
              Now Available for Indian Advocates
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-white drop-shadow-sm">
              Modern Legal Practice
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-100 to-teal-200">
                Management Platform
              </span>
            </h1>
            
            <p className="text-xl text-teal-50 max-w-2xl mx-auto leading-relaxed font-medium">
              Streamline case management, access comprehensive legal databases, draft documents with AI, 
              and manage your entire practice from one powerful platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Link 
                href="/signup" 
                className="group bg-white text-teal-800 px-8 py-4 rounded-xl font-bold text-lg hover:bg-teal-50 hover:shadow-2xl hover:shadow-teal-900/20 transition-all flex items-center gap-2"
              >
                <Briefcase className="h-5 w-5" />
                Start Free Trial
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Stats / Key Benefits */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-16 border-t border-teal-600/30 mt-16 text-white">
              {[
                { label: "Platform Type", value: "Cloud Based", color: "text-white" },
                { label: "Data Security", value: "Encrypted", color: "text-teal-100" },
                { label: "Case Updates", value: "Real-time", color: "text-white" },
                { label: "Drafting", value: "Smart Tools", color: "text-teal-100" },
              ].map((stat, i) => (
                <div key={i} className="text-center group hover:-translate-y-1 transition-transform duration-300">
                  <div className={`text-2xl md:text-3xl font-extrabold ${stat.color} mb-2`}>{stat.value}</div>
                  <div className="text-sm text-teal-200/80 font-medium uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 font-display">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Professional tools designed specifically for the modern Indian legal ecosystem, 
              combining traditional workflows with cutting-edge AI.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Search,
                title: "eCourts Integration",
                description: "One-click import from eCourts using CNR numbers. Auto-sync Next Dates and Orders without manual data entry.",
                bg: "bg-blue-50",
                color: "text-blue-600"
              },
              {
                icon: FileText,
                title: "AI-Powered Drafting",
                description: "Draft 10x faster with our library of 2,000+ Court Templates. Smart autocompletion for Petitioner/Respondent details.",
                bg: "bg-teal-50",
                color: "text-teal-600"
              },
              {
                icon: Users,
                title: "Litigant Portal",
                description: "Give your clients a dedicated login to view Case Status, Orders, and Timeline. Reduce generic phone calls by 80%.",
                bg: "bg-rose-50",
                color: "text-rose-600"
              },
              {
                icon: Brain,
                title: "Legal Knowledge Base",
                description: "Integrated Bare Acts (IPC, CrPC, CPC, Evidence) with smart search. accessible directly from your case dashboard.",
                bg: "bg-indigo-50",
                color: "text-indigo-600"
              },
              {
                icon: BookOpen,
                title: "Public Advocate Directory",
                description: "Get discovered by thousands of potential litigants. Showcase your Experience, Win Rate, and Specializations.",
                bg: "bg-amber-50",
                color: "text-amber-600"
              },
              {
                icon: Shield,
                title: "Secure Messaging",
                description: "Chats that keep your personal number private. Share documents and updates securely with clients and juniors.",
                bg: "bg-emerald-50",
                color: "text-emerald-600"
              },
            ].map((feature, index) => (
              <div 
                key={index}
                className="group relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-teal-100 transition-all duration-300"
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bg} ${feature.color} mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold">
                <Clock className="h-4 w-4" />
                Setup in 2 Minutes
              </div>
              <h2 className="text-4xl font-bold text-slate-900">
                Seamless Workflow for Modern Advocates
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: "Create Account",
                    description: "Sign up and verify your credentials with Bar Council ID.",
                    icon: Users
                  },
                  {
                    title: "Import Cases",
                    description: "One-click import from eCourts using your CNR numbers.",
                    icon: Search
                  },
                  {
                    title: "Practice Management",
                    description: "Manage hearings, clients, and documents in one dashboard.",
                    icon: Briefcase
                  }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg">
                        {i + 1}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{step.title}</h3>
                      <p className="text-slate-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="relative bg-slate-900 rounded-2xl p-2 shadow-2xl skew-y-1 transform hover:skew-y-0 transition-transform duration-700">
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-800">
                  <Image 
                    src="/dashboard-preview.png" 
                    alt="Advocate Dashboard Interface" 
                    width={800} 
                    height={600} 
                    className="w-full h-auto object-cover"
                  />
                </div>
                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl border border-slate-100 max-w-xs z-20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Case Updated</div>
                      <div className="text-xs text-slate-500">Just now</div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    Your next hearing for <strong>Sharma vs. State</strong> is scheduled for tomorrow at 10:30 AM.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden bg-slate-900 text-white">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-600 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join thousands of legal professionals who trust LegalHub for their daily operations. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/signup" 
              className="inline-flex items-center justify-center gap-2 bg-teal-500 text-white px-8 py-4 rounded-xl font-bold hover:bg-teal-400 transition-all shadow-lg hover:shadow-teal-500/30 text-lg border border-transparent"
            >
              Start Your Free Trial
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link 
              href="#contact" 
              className="inline-flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-700 transition-all text-lg"
            >
              Contact Sales
            </Link>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-400" />
              <span>Full Access during trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-400" />
              <span>No credit card needed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-400" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-teal-600 p-2 rounded-lg">
                  <Scale className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-slate-900">
                  LegalHub
                </span>
              </div>
              <p className="text-slate-500 mb-6 leading-relaxed max-w-sm">
                The premier legal services platform trusted by thousands of advocates and legal professionals across India.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 transition-all text-slate-400">
                  <span className="sr-only">Twitter</span>
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 transition-all text-slate-400">
                  <span className="sr-only">LinkedIn</span>
                  <Linkedin className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-teal-50 hover:text-teal-600 transition-all text-slate-400">
                  <span className="sr-only">Facebook</span>
                  <Facebook className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-4 text-base">Product</h4>
              <ul className="space-y-3">
                <li><Link href="#features" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Features</Link></li>
                <li><Link href="/signup" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Plans</Link></li>
                <li><Link href="/login" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Login</Link></li>
                <li><Link href="/signup" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-4 text-base">Company</h4>
              <ul className="space-y-3">
                <li><Link href="#" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">About Us</Link></li>
                <li><Link href="#" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Contact</Link></li>
                <li><Link href="#" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-4 text-base">Legal</h4>
              <ul className="space-y-3">
                <li><Link href="/terms" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Privacy Policy</Link></li>
                <li><Link href="#" className="text-slate-500 hover:text-teal-600 transition-colors font-medium text-sm">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © 2026 LegalHub. All rights reserved.
            </p>
            <div className="flex gap-6">
              <span className="text-slate-400 text-sm flex items-center gap-2">
                <Award className="h-4 w-4" />
                Made with ❤️ in India
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
