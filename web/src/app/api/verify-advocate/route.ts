
import { NextRequest, NextResponse } from 'next/server';
import { AdvocateScraperSessionManager } from '@/lib/scrapers/advocate-scraper-session-manager';
import { createClient } from '@/lib/supabase/server';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Internal Server Error';
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, enrollmentNumber, mobileNumber, otp, advocateName } = await req.json();
  const userId = user.id;

  try {
    const scraper = await AdvocateScraperSessionManager.getSession(userId);

    if (action === 'INIT') {
      console.log(`[REAL-TIME] Initiating OTP request for ${enrollmentNumber}`);
      await scraper.initSession();
      await scraper.navigateToSearch();
      const success = await scraper.requestOtp(enrollmentNumber, mobileNumber, advocateName);
      
      if (success) {
        return NextResponse.json({ success: true, message: 'OTP Sent' });
      } else {
        await AdvocateScraperSessionManager.endSession(userId); // Cleanup on fail
        return NextResponse.json({ success: false, error: 'Failed to request OTP (Check details)' }, { status: 500 });
      }

    } else if (action === 'VERIFY') {
      console.log(`[REAL-TIME] Verifying OTP...`);
      const profile = await scraper.verifyOtpAndFetch(otp);
      await AdvocateScraperSessionManager.endSession(userId); // Always cleanup after verify attempt

      if (profile) {
        // Save to DB
        const { error: updateError } = await supabase
          .from('advocates')
          .update({
            bar_council_data: profile, 
            bar_council_number: profile.enrollmentNumber, // Use captured number
            bar_council_state: 'Tamil Nadu',
            is_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) console.error('DB Update Error:', updateError);

        return NextResponse.json({ success: true, data: profile });
      } else {
        return NextResponse.json({ success: false, error: 'Invalid OTP or Scraping Failed' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });

  } catch (error: unknown) {
    console.error('API Error:', error);
    await AdvocateScraperSessionManager.endSession(userId); // Cleanup
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
