import { NextResponse } from 'next/server';
import { TNEcourtsScraper } from '@/lib/scrapers/tn-ecourts-scraper';
import { createClient } from '@/utils/supabase/server';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Internal Server Error';
}

/**
 * GET /api/ecourts/captcha
 * Fetches a fresh CAPTCHA from TN eCourts.
 * Called by the mobile app's SyncModal.
 * Auth: Supabase JWT in Authorization header OR session cookie.
 */
export async function GET(req: Request) {
  try {
    console.log('📱 [API] GET /api/ecourts/captcha request received');
    // Auth guard – allow either cookie session (web) or Bearer token (mobile)
    const supabase = await createClient();
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    let user;
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      console.error('❌ [API] Unauthorized access attempt (no valid user)');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cnr = searchParams.get('cnr');

    const result = await TNEcourtsScraper.fetchCaptcha(cnr || undefined);

    if (result.status === 'success' && result.imageBase64) {
      return NextResponse.json({
        success: true,
        imageBase64: result.imageBase64,
        sessionId: result.sessionId,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Failed to retrieve captcha' }, { 
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: unknown) {
    console.error('[/api/ecourts/captcha] Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
