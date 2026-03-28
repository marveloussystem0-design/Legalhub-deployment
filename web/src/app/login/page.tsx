"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      if (data.user) {
        const redirectTo = searchParams.get("redirect");
        router.push(redirectTo || '/dashboard');
        router.refresh();
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid login credentials.";
      console.error('Login error:', error);
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
          <Link href="/" className="inline-flex items-center gap-2.5 mb-10">
            <div className="bg-gradient-to-br from-teal-600 to-teal-700 p-2 rounded-lg shadow-md">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LegalHub</span>
          </Link>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Welcome Back</h1>
            <p className="text-base text-gray-600">Sign in to access your legal practice dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full pl-11 pr-11 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 bg-white text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600 cursor-pointer select-none">Remember me for 30 days</span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 text-white py-3.5 rounded-lg font-semibold hover:shadow-lg hover:shadow-teal-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Don&apos;t have an account?</span>
              </div>
            </div>

            <Link 
              href="/signup"
              className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all"
            >
              Create an Account
            </Link>
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
        
        {/* Overlay Content using eCourts style */}
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md text-center space-y-8">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl inline-block border border-white/10">
              <Scale className="h-12 w-12 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-white leading-snug">
              Access Your
              <br />
              Legal Practice
            </h2>
            
            <p className="text-base text-teal-50 leading-relaxed font-medium">
              Manage cases, draft documents, and connect with clients from your personalized dashboard.
            </p>

            <div className="space-y-4 pt-4">
              {[
                "Secure Client Management",
                "Advanced Case Tracking",
                "AI-Powered Legal Research"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-teal-50 bg-teal-800/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-teal-200 flex-shrink-0" />
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
