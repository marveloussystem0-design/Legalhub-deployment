import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NotificationService } from "@/lib/services/notifications";
import { Scale, Shield, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { normalizePhone } from "@/lib/phone";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    // Use service role to bypass RLS for this specific token lookup 
    // (since public users can't see 'cases' or 'profiles' table rows)
    const supabase = createServiceRoleClient();
    const authSupabase = await createClient();
    const { token } = await params;
    const { data: { user } } = await authSupabase.auth.getUser();

    // Fetch invite details
    const { data: invite, error } = await supabase
        .from('case_invites')
        .select(`
            id,
            case_id,
            phone,
            role,
            status,
            invited_by,
            token,
            cases (title, case_number),
            profiles:invited_by (full_name)
        `)
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle();

    if (error || !invite) {
        if (error) console.error("Invite lookup error:", error);
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-[#1e293b] border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
                    <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Invalid or Expired Invite</h1>
                    <p className="text-slate-400 mb-8">
                        This invitation link is no longer valid. Please ask your advocate to send a new invitation.
                    </p>
                    <Link href="/">
                        <button className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-all">
                            Back to Home
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    const inviterProfile = invite.profiles as { full_name?: string } | null;
    const inviteCase = invite.cases as { title?: string; case_number?: string } | null;

    // If already authenticated, auto-accept invite and link case immediately.
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', user.id)
            .maybeSingle();

        const invitedPhone = normalizePhone((invite.phone as string) || '');
        const profilePhone = normalizePhone((profile?.phone as string) || '');

        // Safety check: enforce phone match when both sides have valid phone numbers.
        if (
            invitedPhone.national10 &&
            profilePhone.national10 &&
            invitedPhone.national10 !== profilePhone.national10
        ) {
            return (
                <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-[#1e293b] border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
                        <div className="w-16 h-16 bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="h-8 w-8 text-amber-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Phone Number Mismatch</h1>
                        <p className="text-slate-400 mb-6">
                            This invite is for a different phone number. Please log in with the invited account.
                        </p>
                        <Link href="/login">
                            <button className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-semibold transition-all">
                                Back to Login
                            </button>
                        </Link>
                    </div>
                </div>
            );
        }

        const { data: existingParticipant } = await supabase
            .from('case_participants')
            .select('id')
            .eq('case_id', invite.case_id)
            .eq('user_id', user.id)
            .eq('role', 'client')
            .maybeSingle();

        if (!existingParticipant) {
            const { error: participantInsertError } = await supabase
                .from('case_participants')
                .insert({
                    case_id: invite.case_id,
                    user_id: user.id,
                    role: 'client'
                });

            if (participantInsertError) {
                throw participantInsertError;
            }
        }

        await supabase
            .from('case_invites')
            .update({ status: 'accepted', accepted_by: user.id })
            .eq('id', invite.id);

        // Notify client they've been added to the case
        try {
            const caseLabel = inviteCase?.title || inviteCase?.case_number || 'a case';
            await NotificationService.send({
                user_id: user.id,
                type: 'case_added',
                category: 'admin',
                title: "📁 You've been added to a case",
                message: `Your advocate has added you to "${caseLabel}". Open the app to view your case details.`,
                metadata: {
                    case_id: invite.case_id,
                    link: `/cases/${invite.case_id}`,
                    participant_role: 'client'
                }
            });
        } catch (notifErr) {
            console.error('⚠️ Failed to send case-added notification:', notifErr);
        }

        const role = user.user_metadata?.role;
        const targetPath =
            role === 'advocate'
                ? `/dashboard/advocate/cases/${invite.case_id}`
                : `/dashboard/client/cases/${invite.case_id}`;

        redirect(targetPath);
    }

    return (
        <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-xl w-full z-10">
                {/* Logo */}
                <div className="flex justify-center mb-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-2.5 rounded-xl shadow-lg shadow-teal-500/20">
                            <Scale className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white tracking-tight">LegalHub</span>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-[#1e293b]/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-12 shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border border-teal-500/20">
                            <Shield className="h-4 w-4" /> Secure Invitation
                        </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                            You&apos;ve been invited to join a case
                            </h1>
                            <p className="text-slate-400 text-lg">
                            Adv. {inviterProfile?.full_name || 'Your Lawyer'} has invited you to access legal updates for:
                            </p>
                    </div>

                    {/* Case Detail Box */}
                    <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-10">
                        <div className="flex items-start gap-4">
                            <div className="bg-teal-500/20 p-3 rounded-lg">
                                <CheckCircle2 className="h-6 w-6 text-teal-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{inviteCase?.title || 'Legal Case'}</h3>
                                <p className="text-slate-500 text-sm mt-1">
                                    Case ID: {inviteCase?.case_number || invite.case_id.slice(0, 8)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Link href={`/signup?invite=${token}&phone=${invite.phone}&role=client`}>
                            <button className="w-full bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-3 group">
                                Create Account & View Case
                                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                        
                        <div className="text-center">
                            <Link href={`/login?redirect=/invite/${token}`} className="text-slate-500 hover:text-white transition-colors text-sm">
                                Already have an account? <span className="text-teal-400 font-semibold underline underline-offset-4">Log in here</span>
                            </Link>
                        </div>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-3 gap-4 mt-12 pt-12 border-t border-slate-700/50">
                        <div className="text-center">
                            <div className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Updates</div>
                            <p className="text-slate-500 text-[10px] leading-snug">Get instant hearing updates</p>
                        </div>
                        <div className="text-center">
                            <div className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Docs</div>
                            <p className="text-slate-500 text-[10px] leading-snug">Secure document storage</p>
                        </div>
                        <div className="text-center">
                            <div className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Access</div>
                            <p className="text-slate-500 text-[10px] leading-snug">Available on Mobile & Web</p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-12">
                    &copy; 2026 LegalHub Practice Management. All rights reserved.
                </p>
            </div>
        </div>
    );
}
