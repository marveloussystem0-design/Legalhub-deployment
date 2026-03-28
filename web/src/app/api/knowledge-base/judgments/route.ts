import { NextRequest, NextResponse } from 'next/server';
import {
  searchJudgments,
  getJudgmentCourts,
  getJudgmentTopics,
} from '@/lib/db/legal-judgments';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || undefined;
    const court = searchParams.get('court') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const topicsParam = searchParams.get('topics');
    const topics = topicsParam ? topicsParam.split(',') : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // If requesting filters
    if (searchParams.get('filters') === 'true') {
      const [courts, topicsList] = await Promise.all([
        getJudgmentCourts(),
        getJudgmentTopics(),
      ]);

      return NextResponse.json({
        courts,
        topics: topicsList,
      });
    }

    // Search judgments
    const result = await searchJudgments({
      query,
      court,
      dateFrom,
      dateTo,
      topics,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in judgments API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch judgments' },
      { status: 500 }
    );
  }
}
