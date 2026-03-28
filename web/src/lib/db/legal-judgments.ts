import { createClient } from '@/lib/supabase/server';

export interface LegalJudgment {
  id: string;
  case_title: string;
  case_number: string | null;
  court_name: string;
  bench: string | null;
  judges: string[] | null;
  judgment_date: string | null;
  citation: string | null;
  petitioner: string | null;
  respondent: string | null;
  summary: string | null;
  full_text: string | null;
  headnotes: string | null;
  topics: string[] | null;
  acts_referred: string[] | null;
  source_url: string | null;
  indiankanoon_doc_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LegalCitation {
  id: string;
  citing_judgment_id: string;
  cited_judgment_id: string;
  citation_context: string | null;
  citation_type: string | null;
  created_at: string;
}

export interface LegalBookmark {
  id: string;
  user_id: string;
  resource_type: 'act' | 'judgment' | 'section';
  resource_id: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface SearchJudgmentsParams {
  query?: string;
  court?: string;
  dateFrom?: string;
  dateTo?: string;
  topics?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Search for legal judgments with optional filters
 */
export async function searchJudgments(params: SearchJudgmentsParams): Promise<{
  data: LegalJudgment[];
  count: number;
}> {
  const supabase = await createClient();
  const { query, court, dateFrom, dateTo, topics, limit = 20, offset = 0 } = params;

  let queryBuilder = supabase
    .from('legal_judgments')
    .select('*', { count: 'exact' })
    .order('judgment_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  // Full-text search if query provided
  if (query) {
    queryBuilder = queryBuilder.textSearch('case_title', query, {
      type: 'websearch',
      config: 'english',
    });
  }

  // Apply filters
  if (court) {
    queryBuilder = queryBuilder.eq('court_name', court);
  }
  if (dateFrom) {
    queryBuilder = queryBuilder.gte('judgment_date', dateFrom);
  }
  if (dateTo) {
    queryBuilder = queryBuilder.lte('judgment_date', dateTo);
  }
  if (topics && topics.length > 0) {
    queryBuilder = queryBuilder.overlaps('topics', topics);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Error searching judgments:', error);
    throw new Error('Failed to search judgments');
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Get a single judgment by ID with citations
 */
export async function getJudgmentById(judgmentId: string): Promise<{
  judgment: LegalJudgment | null;
  citedBy: LegalJudgment[];
  cites: LegalJudgment[];
}> {
  const supabase = await createClient();

  // Get the judgment
  const { data: judgment, error: judgmentError } = await supabase
    .from('legal_judgments')
    .select('*')
    .eq('id', judgmentId)
    .single();

  if (judgmentError) {
    console.error('Error fetching judgment:', judgmentError);
    throw new Error('Failed to fetch judgment');
  }

  // Get judgments that cite this one
  const { data: citingData } = await supabase
    .from('legal_citations')
    .select('citing_judgment_id')
    .eq('cited_judgment_id', judgmentId);

  const citingIds = citingData?.map((c) => c.citing_judgment_id) || [];
  let citedBy: LegalJudgment[] = [];
  if (citingIds.length > 0) {
    const { data } = await supabase
      .from('legal_judgments')
      .select('*')
      .in('id', citingIds);
    citedBy = data || [];
  }

  // Get judgments cited by this one
  const { data: citedData } = await supabase
    .from('legal_citations')
    .select('cited_judgment_id')
    .eq('citing_judgment_id', judgmentId);

  const citedIds = citedData?.map((c) => c.cited_judgment_id) || [];
  let cites: LegalJudgment[] = [];
  if (citedIds.length > 0) {
    const { data } = await supabase
      .from('legal_judgments')
      .select('*')
      .in('id', citedIds);
    cites = data || [];
  }

  return { judgment, citedBy, cites };
}

/**
 * Get all unique courts for filtering
 */
export async function getJudgmentCourts(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_judgments')
    .select('court_name')
    .not('court_name', 'is', null);

  if (error) {
    console.error('Error fetching courts:', error);
    return [];
  }

  const courts = [...new Set(data.map((item) => item.court_name))].filter(
    Boolean
  ) as string[];
  return courts.sort();
}

/**
 * Get all unique topics for filtering
 */
export async function getJudgmentTopics(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_judgments')
    .select('topics')
    .not('topics', 'is', null);

  if (error) {
    console.error('Error fetching topics:', error);
    return [];
  }

  const allTopics = data.flatMap((item) => item.topics || []);
  const uniqueTopics = [...new Set(allTopics)].filter(Boolean) as string[];
  return uniqueTopics.sort();
}

/**
 * Get user's bookmarks
 */
export async function getUserBookmarks(
  userId: string,
  resourceType?: 'act' | 'judgment' | 'section'
): Promise<LegalBookmark[]> {
  const supabase = await createClient();

  let query = supabase
    .from('legal_bookmarks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (resourceType) {
    query = query.eq('resource_type', resourceType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching bookmarks:', error);
    throw new Error('Failed to fetch bookmarks');
  }

  return data || [];
}

/**
 * Create a bookmark
 */
export async function createBookmark(
  userId: string,
  resourceType: 'act' | 'judgment' | 'section',
  resourceId: string,
  notes?: string,
  tags?: string[]
): Promise<LegalBookmark> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_bookmarks')
    .insert({
      user_id: userId,
      resource_type: resourceType,
      resource_id: resourceId,
      notes,
      tags,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating bookmark:', error);
    throw new Error('Failed to create bookmark');
  }

  return data;
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('legal_bookmarks')
    .delete()
    .eq('id', bookmarkId);

  if (error) {
    console.error('Error deleting bookmark:', error);
    throw new Error('Failed to delete bookmark');
  }
}
