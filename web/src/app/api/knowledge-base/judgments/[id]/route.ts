import { NextRequest, NextResponse } from 'next/server';
import { getJudgmentById } from '@/lib/db/legal-judgments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const judgmentId = id;

    const result = await getJudgmentById(judgmentId);

    if (!result.judgment) {
      return NextResponse.json(
        { error: 'Judgment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in judgment detail API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch judgment details' },
      { status: 500 }
    );
  }
}
