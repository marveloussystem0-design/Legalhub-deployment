import { NextRequest, NextResponse } from 'next/server';
import { searchActs, getActCategories, getActStates } from '@/lib/db/legal-acts';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || undefined;
    const category = searchParams.get('category') || undefined;
    const state = searchParams.get('state') || undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // If requesting filters
    if (searchParams.get('filters') === 'true') {
      const [categories, states] = await Promise.all([
        getActCategories(),
        getActStates(),
      ]);

      return NextResponse.json({
        categories,
        states,
      });
    }

    // Search acts
    const result = await searchActs({
      query,
      category,
      state,
      year,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in acts API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch acts' },
      { status: 500 }
    );
  }
}
