'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

export async function updateAdvocateProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const fullName = formData.get('fullName') as string
  const barCouncilNumber = formData.get('barCouncilNumber') as string
  const barCouncilState = formData.get('barCouncilState') as string
  const experienceYears = formData.get('experienceYears') as string
  const bio = formData.get('bio') as string
  const profilePhotoUrl = formData.get('profilePhotoUrl') as string

  // Handle multiple checkboxes for specialization
  const specializationList = formData.getAll('specialization');
  
  // If no checkboxes, getAll returns empty array. But TypeScript typically returns FormDataEntryValue[]
  const specializationArray = specializationList.map(item => item.toString());

  try {
    const updateData: Record<string, string | string[] | number | null> = {
      full_name: fullName,
      bar_council_number: barCouncilNumber || null,
      bar_council_state: barCouncilState || null,
      specialization: specializationArray.length > 0 ? specializationArray : null,
      experience_years: experienceYears ? parseInt(experienceYears) : null,
      bio: bio || null,
      updated_at: new Date().toISOString()
    };

    // Only update profile photo if provided
    if (profilePhotoUrl) {
      updateData.profile_photo_url = profilePhotoUrl;
    }

    const { error } = await supabase
      .from('advocates')
      .update(updateData)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/dashboard/advocate/profile')
    return { success: true }
  } catch (error: unknown) {
    console.error('Update profile error:', error)
    return { error: getErrorMessage(error) }
  }
}
