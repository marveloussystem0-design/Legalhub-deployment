"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Scale, Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, Briefcase, Users, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import TermsModal from "@/components/auth/TermsModal";
import { SUBSCRIPTION_PLANS, type PlanType } from "@/lib/billing/plans";

type UserRole = "advocate" | "client";
type RoleIcon = React.ComponentType<{ className?: string }>;

function SignUpContent() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserRole>("advocate");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    // Advocate specific
    barCouncilNumber: "",
    barCouncilState: "",
    experienceYears: "",
    specialization: [] as string[],
    bio: "",
    // Litigant specific
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("basic");
  
  const searchParams = useSearchParams();
  const supabase = createClient();
  const inviteToken = searchParams.get('invite');
  const invitePhone = searchParams.get('phone');
  const inviteRole = searchParams.get('role');

  // Handle Invitation Pre-fill
  useEffect(() => {
    if (inviteToken) {
      if (invitePhone) setFormData(prev => ({ ...prev, phone: invitePhone }));
      if (inviteRole === 'client' || inviteRole === 'advocate') setRole(inviteRole as UserRole);
      setStep(2); // Jump straight to details if invited
    }
  }, [inviteToken, invitePhone, inviteRole]);

  const roles: { value: UserRole; label: string; icon: RoleIcon; description: string }[] = [
    {
      value: "advocate",
      label: "Advocate",
      icon: Briefcase,
      description: "Manage cases, clients, and legal practice"
    },
    {
      value: "client",
      label: "Litigant",
      icon: Users,
      description: "Track cases and connect with legal counsel"
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: role,
            phone: formData.phone,
            subscription_plan: role === "advocate" ? selectedPlan : "basic",
            subscription_amount: role === "advocate" ? SUBSCRIPTION_PLANS[selectedPlan].amountPaise / 100 : 0,
            subscription_currency: "INR",
            subscription_status: role === "advocate" ? "pending_activation" : "free",
            // Pass all profile fields to metadata (trigger will handle insertion)
            bar_council_number: formData.barCouncilNumber,
            bar_council_state: formData.barCouncilState,
            experience_years: formData.experienceYears ? parseInt(formData.experienceYears) : null,
            specialization: formData.specialization,
            bio: formData.bio,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        if (inviteToken) {
            // Link invite to user (This would ideally be handled by a server action)
            await supabase.from('case_invites').update({ status: 'accepted', accepted_by: authData.user.id }).eq('token', inviteToken);
            
            // Note: A trigger should ideally handle the case_participants insertion 
            // but we can do a fallback here if needed.
        }
        
        alert("Account created successfully! Redirecting to login...");
        router.push(inviteToken ? `/login?redirect=/invite/${inviteToken}` : '/login');
      }

    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "An error occurred during sign up.";
      const message = rawMessage === 'Database error saving new user'
        ? 'Signup failed while saving your profile. Please ask an admin to run the latest signup trigger migration and try again.'
        : rawMessage;
      console.error('Signup error:', error);
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 lg:px-12 bg-white">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
            <div className="bg-gradient-to-br from-teal-600 to-teal-700 p-2 rounded-lg shadow-md">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LegalHub</span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-base text-gray-600">Join thousands of legal professionals</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === 1 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                1
              </div>
              <span className="text-sm text-gray-600 hidden sm:inline">Select Role</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === 2 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                2
              </div>
              <span className="text-sm text-gray-600 hidden sm:inline">Details</span>
            </div>
          </div>

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-gray-900">Choose your role</h3>
              <div className="grid grid-cols-2 gap-3">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      role === r.value
                        ? 'border-teal-600 bg-teal-50'
                        : 'border-gray-200 bg-white hover:border-teal-300'
                    }`}
                  >
                    <r.icon className={`h-7 w-7 mb-2 ${role === r.value ? 'text-teal-600' : 'text-gray-400'}`} />
                    <div className="font-semibold text-gray-900 mb-1 text-sm">{r.label}</div>
                    <div className="text-xs text-gray-500 leading-snug">{r.description}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white py-3.5 rounded-lg font-semibold hover:shadow-lg hover:shadow-teal-600/30 transition-all flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Step 2: Form */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Role Indicator (Helpful for invites) */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex items-center gap-3">
                <div className="bg-teal-600 p-1.5 rounded-lg">
                  {role === 'advocate' ? <Briefcase className="h-4 w-4 text-white" /> : <Users className="h-4 w-4 text-white" />}
                </div>
                <div>
                  <div className="text-xs text-teal-600 font-semibold uppercase tracking-wider">Account Type</div>
                  <div className="text-sm font-bold text-gray-900">{role === 'advocate' ? 'Advocate' : 'Litigant (Client)'}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
              {/* Common Fields: Name, Email, Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition-all"
                      placeholder="Rajesh Kumar"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition-all"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 transition-all"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {/* Subscription Selection (Advocate only) */}
              {role === "advocate" && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700">Choose Subscription Plan</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
                      const active = selectedPlan === plan.type;
                      return (
                        <button
                          key={plan.type}
                          type="button"
                          onClick={() => setSelectedPlan(plan.type)}
                          className={`text-left rounded-lg border p-3 transition-all ${
                            active ? "border-teal-600 bg-teal-50" : "border-gray-200 bg-white hover:border-teal-300"
                          }`}
                        >
                          <div className="text-sm font-semibold text-gray-900">{plan.label}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            Rs. {(plan.amountPaise / 100).toLocaleString("en-IN")} / month
                          </div>
                          <ul className="mt-2 space-y-1">
                            {plan.features.map((feature) => (
                              <li key={feature} className="text-[11px] text-gray-600 leading-snug">
                                - {feature}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Role-Specific Fields */}
              {role === 'advocate' ? (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Bar Council No.</label>
                      <input
                        type="text"
                        value={formData.barCouncilNumber}
                        onChange={(e) => setFormData({ ...formData, barCouncilNumber: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                        placeholder="D/123/2024"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={formData.barCouncilState}
                        onChange={(e) => setFormData({ ...formData, barCouncilState: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                        placeholder="Maharashtra"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Experience (Years)</label>
                    <input
                      type="number"
                      value={formData.experienceYears}
                      onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Specialization Areas</label>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      {[
                        { label: 'Criminal Law', value: 'criminal' },
                        { label: 'Civil Law', value: 'civil' },
                        { label: 'Family Law', value: 'family' },
                        { label: 'Corporate Law', value: 'corporate' },
                        { label: 'Property Law', value: 'property' },
                        { label: 'Tax Law', value: 'tax' },
                        { label: 'Immigration', value: 'immigration' },
                        { label: 'Intellectual Property', value: 'ipr' },
                        { label: 'Consumer Protection', value: 'consumer' }
                      ].map((spec) => (
                        <label key={spec.value} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white rounded transition-colors select-none">
                          <input
                            type="checkbox"
                            checked={formData.specialization.includes(spec.value)}
                            onChange={(e) => {
                              const newSpecs = e.target.checked
                                ? [...formData.specialization, spec.value]
                                : formData.specialization.filter(s => s !== spec.value);
                              setFormData({ ...formData, specialization: newSpecs });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-xs text-gray-700">{spec.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Bio</label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      placeholder="Tell us about your practice..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="col-span-1 space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="col-span-1 space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Pincode</label>
                      <input
                        type="text"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      rows={2}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      placeholder="123, Legal Street..."
                    />
                  </div>
                </div>
              )}

              {/* Password Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 py-1">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-white text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  I agree to the{" "}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-teal-600 hover:text-teal-700 underline font-medium">Terms of Service</button>
                  {" "}and{" "}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-teal-600 hover:text-teal-700 underline font-medium">Privacy Policy</button>
                </span>
              </label>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all text-sm"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-teal-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          )}

          {/* Footer Links */}
          <div className="mt-8 space-y-3">
              <div className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  href={inviteToken ? `/login?redirect=/invite/${inviteToken}` : "/login"}
                  className="text-teal-600 hover:text-teal-700 font-semibold"
                >
                  Sign in
                </Link>
              </div>
            <div className="text-center">
              <Link href="/" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Background Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-teal-700 to-teal-600">
        <Image
          src="/law-books.png"
          alt="Law Library"
          fill
          className="object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-teal-700/60 via-teal-600/40 to-transparent"></div>
        
        {/* Overlay Content */}
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md text-center space-y-5">
            <Scale className="h-16 w-16 text-white mx-auto" />
            <h2 className="text-3xl font-bold text-white">
              Join Legal Professionals
            </h2>
            <p className="text-base text-teal-50 leading-relaxed">
              Create your account and start managing your legal practice with cutting-edge AI tools.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-white">Secure</div>
                <div className="text-xs text-teal-100">Encrypted Data</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">Cloud</div>
                <div className="text-xs text-teal-100">Access Anywhere</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">Smart</div>
                <div className="text-xs text-teal-100">AI Drafting</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
          Loading...
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
