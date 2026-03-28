import { NextRequest, NextResponse } from 'next/server';
import { getActById, searchActSections } from '@/lib/db/legal-acts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actId = id;
    const searchParams = request.nextUrl.searchParams;
    const sectionQuery = searchParams.get('sectionQuery');

    // If searching within sections
    if (sectionQuery) {
      const sections = await searchActSections(actId, sectionQuery);
      return NextResponse.json({ sections });
    }

    // Get act with all sections
    const result = await getActById(actId);

    if (!result.act) {
      return NextResponse.json(
        { error: 'Act not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in act detail API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch act details' },
      { status: 500 }
    );
  }
}
