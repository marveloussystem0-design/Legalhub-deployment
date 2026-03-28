import { NextRequest, NextResponse } from 'next/server';
import { checkTodayHearings, checkTomorrowHearings } from '@/app/actions/scheduling';

export const dynamic = 'force-dynamic'; // Trigger on every request

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, this endpoint must be protected.
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // 'morning' (7AM) or 'evening' (7PM)

  try {
    let result;

    if (type === 'morning') {
      // 7:00 AM Task: Check "Today's" Hearings
      result = await checkTodayHearings();
    } else if (type === 'evening') {
      // 7:00 PM Task: Check "Tomorrow's" Hearings
      result = await checkTomorrowHearings();
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Use ?type=morning or ?type=evening' }, 
        { status: 400 }
      );
    }

    return NextResponse.json({ 
       
      type, 
      ...result 
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message }, 
      { status: 500 }
    );
  }
}
