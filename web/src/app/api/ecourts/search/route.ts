import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'API-based search is disabled. Please use the scraper-based import flow with Captcha.' },
    { status: 403 }
  );
}
