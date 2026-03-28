/**
 * Admin Settings Management
 * Server-side utilities for managing system settings
 */

import { createClient } from '@/lib/supabase/server';

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  is_encrypted: boolean;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single();

  if (error || !data) {
    console.error(`Failed to fetch setting: ${key}`, error);
    return null;
  }

  return data.setting_value;
}

/**
 * Get all system settings (for admin panel)
 */
export async function getAllSystemSettings(): Promise<SystemSetting[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('setting_key');

  if (error) {
    console.error('Failed to fetch settings', error);
    return [];
  }

  return data || [];
}

/**
 * Update a system setting
 */
export async function updateSystemSetting(
  key: string, 
  value: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // TODO: Add admin role check here
  // For now, we'll allow any authenticated user to update
  
  const { error } = await supabase
    .from('system_settings')
    .update({ 
      setting_value: value,
      updated_by: user.id 
    })
    .eq('setting_key', key);

  if (error) {
    console.error('Failed to update setting', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
