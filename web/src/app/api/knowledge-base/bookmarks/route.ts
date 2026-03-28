import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getUserBookmarks,
  createBookmark,
  deleteBookmark,
} from '@/lib/db/legal-judgments';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const resourceType = searchParams.get('resourceType') as
      | 'act'
      | 'judgment'
      | 'section'
      | undefined;

    const bookmarks = await getUserBookmarks(user.id, resourceType);

    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resourceType, resourceId, notes, tags } = body;

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: 'resourceType and resourceId are required' },
        { status: 400 }
      );
    }

    const bookmark = await createBookmark(
      user.id,
      resourceType,
      resourceId,
      notes,
      tags
    );

    return NextResponse.json({ bookmark });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const bookmarkId = searchParams.get('id');

    if (!bookmarkId) {
      return NextResponse.json(
        { error: 'Bookmark ID is required' },
        { status: 400 }
      );
    }

    await deleteBookmark(bookmarkId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}
