'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

export async function updateClientProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const fullName = formData.get('fullName') as string
  const address = formData.get('address') as string
  const city = formData.get('city') as string
  const state = formData.get('state') as string
  const pincode = formData.get('pincode') as string
  const profilePhotoUrl = formData.get('profilePhotoUrl') as string

  if (!fullName) return { error: 'Full name is required' }

  try {
    const updateData: Record<string, string | null> = {
      full_name: fullName,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      updated_at: new Date().toISOString()
    };

    // Only update profile photo if provided
    if (profilePhotoUrl) {
      updateData.profile_photo_url = profilePhotoUrl;
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/dashboard/client/profile')
    return { success: true }
  } catch (error: unknown) {
    console.error('Update profile error:', error)
    return { error: getErrorMessage(error) }
  }
}
