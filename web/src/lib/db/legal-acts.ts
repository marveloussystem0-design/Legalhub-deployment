import { createClient } from '@/lib/supabase/server';

export interface LegalAct {
  id: string;
  act_name: string;
  act_number: string | null;
  year: number | null;
  category: string | null;
  state: string | null;
  description: string | null;
  full_text: string | null;
  source_url: string | null;
  last_updated: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LegalSection {
  id: string;
  act_id: string;
  section_number: string;
  section_title: string | null;
  section_text: string;
  parent_section_id: string | null;
  created_at: string;
}

export interface SearchActsParams {
  query?: string;
  category?: string;
  state?: string;
  year?: number;
  limit?: number;
  offset?: number;
}

/**
 * Search for legal acts with optional filters
 */
export async function searchActs(params: SearchActsParams): Promise<{
  data: LegalAct[];
  count: number;
}> {
  const supabase = await createClient();
  const { query, category, state, year, limit = 20, offset = 0 } = params;

  let queryBuilder = supabase
    .from('legal_acts')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('year', { ascending: false })
    .range(offset, offset + limit - 1);

  // Full-text search if query provided
  if (query) {
    queryBuilder = queryBuilder.textSearch('act_name', query, {
      type: 'websearch',
      config: 'english',
    });
  }

  // Apply filters
  if (category) {
    queryBuilder = queryBuilder.eq('category', category);
  }
  if (state) {
    queryBuilder = queryBuilder.eq('state', state);
  }
  if (year) {
    queryBuilder = queryBuilder.eq('year', year);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Error searching acts:', error);
    throw new Error('Failed to search acts');
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Get a single act by ID with its sections
 */
export async function getActById(actId: string): Promise<{
  act: LegalAct | null;
  sections: LegalSection[];
}> {
  const supabase = await createClient();

  const [actResult, sectionsResult] = await Promise.all([
    supabase.from('legal_acts').select('*').eq('id', actId).single(),
    supabase
      .from('legal_sections')
      .select('*')
      .eq('act_id', actId)
      .order('section_number'),
  ]);

  if (actResult.error) {
    console.error('Error fetching act:', actResult.error);
    throw new Error('Failed to fetch act');
  }

  return {
    act: actResult.data,
    sections: sectionsResult.data || [],
  };
}

/**
 * Search within sections of a specific act
 */
export async function searchActSections(
  actId: string,
  query: string
): Promise<LegalSection[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_sections')
    .select('*')
    .eq('act_id', actId)
    .textSearch('section_text', query, {
      type: 'websearch',
      config: 'english',
    });

  if (error) {
    console.error('Error searching sections:', error);
    throw new Error('Failed to search sections');
  }

  return data || [];
}

/**
 * Get all unique categories for filtering
 */
export async function getActCategories(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_acts')
    .select('category')
    .not('category', 'is', null)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  const categories = [...new Set(data.map((item) => item.category))].filter(
    Boolean
  ) as string[];
  return categories.sort();
}

/**
 * Get all unique states for filtering
 */
export async function getActStates(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_acts')
    .select('state')
    .not('state', 'is', null)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching states:', error);
    return [];
  }

  const states = [...new Set(data.map((item) => item.state))].filter(
    Boolean
  ) as string[];
  return states.sort();
}
