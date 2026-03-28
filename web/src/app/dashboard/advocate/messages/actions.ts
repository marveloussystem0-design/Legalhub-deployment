'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

export async function sendMessage(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const recipientId = formData.get('recipientId') as string
  const caseId = formData.get('caseId') as string
  const content = formData.get('content') as string
  const documentUrl = formData.get('documentUrl') as string

  if (!recipientId || !content) {
    return { error: 'Recipient and message content are required' }
  }

  try {
    const messageData: Record<string, string | boolean | null> = {
      sender_id: user.id,
      recipient_id: recipientId,
      case_id: caseId || null,
      content,
      is_read: false
    };

    // Only add document_url if provided
    if (documentUrl) {
      messageData.document_url = documentUrl;
    }

    const { error } = await supabase
      .from('messages')
      .insert(messageData)

    if (error) throw error

    revalidatePath('/dashboard/advocate/messages')
    revalidatePath('/dashboard/client/messages')
    return { success: true }
  } catch (error: unknown) {
    console.error('Send message error:', error)
    return { error: getErrorMessage(error) }
  }
}

export async function markAsRead(messageId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .eq('recipient_id', user.id)

    if (error) throw error

    revalidatePath('/dashboard/advocate/messages')
    revalidatePath('/dashboard/client/messages')
    return { success: true }
  } catch (error: unknown) {
    console.error('Mark as read error:', error)
    return { error: getErrorMessage(error) }
  }
}
