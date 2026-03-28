
import { checkUpcomingHearings, checkSyncOverdueCases } from '@/app/actions/reminders';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure it's not cached

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Queue hearing reminders for today/tomorrow
    const reminderResult = await checkUpcomingHearings();
    
    // 2. Queue sync reminders for cases with today's hearing that haven't been synced
    const syncResult = await checkSyncOverdueCases();
    
    if (reminderResult.success && syncResult.success) {
        return NextResponse.json({ 
          success: true, 
          hearing_reminders: reminderResult.count,
          sync_reminders: syncResult.count
        });
    } else {
        return NextResponse.json({ 
          success: false, 
          error: reminderResult.error || syncResult.error 
        }, { status: 500 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
