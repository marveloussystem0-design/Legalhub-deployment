'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  return { supabase, currentUserId: user.id }
}

export async function verifyUser(userId: string) {
  const { supabase } = await requireAdmin()
  const now = new Date().toISOString()

  const [{ error: profileError }, { error: advocateError }] = await Promise.all([
    supabase
      .from('profiles')
      .update({ is_verified: true, verification_source: 'admin', badge_expires_at: null, updated_at: now })
      .eq('id', userId),
    supabase
      .from('advocates')
      .update({ is_verified: true, verification_source: 'admin', badge_expires_at: null })
      .eq('user_id', userId),
  ])

  if (profileError) {
    console.error('verifyUser error:', profileError)
    throw new Error('Failed to verify user: ' + profileError.message)
  }

  if (advocateError && advocateError.code !== 'PGRST116') {
    console.error('verifyUser advocate error:', advocateError)
    throw new Error('Failed to sync advocate verification: ' + advocateError.message)
  }

  // Revalidate both pages so the dashboard card count also updates
  revalidatePath('/dashboard/admin/users')
  revalidatePath('/dashboard/admin')
}

export async function deleteUser(userId: string) {
  const { currentUserId } = await requireAdmin()

  if (userId === currentUserId) {
    throw new Error('You cannot delete your own admin account.')
  }

  const admin = createServiceRoleClient()

  const { data: ownedCases, error: ownedCasesError } = await admin
    .from('cases')
    .select('id')
    .eq('created_by', userId)

  if (ownedCasesError) {
    console.error('deleteUser ownedCases error:', ownedCasesError)
    throw new Error('Failed to load user cases: ' + ownedCasesError.message)
  }

  const caseIds = ownedCases?.map((kase) => kase.id) ?? []

  const { data: aiConversations, error: aiConversationsError } = await admin
    .from('ai_conversations')
    .select('id')
    .eq('user_id', userId)

  if (aiConversationsError && aiConversationsError.code !== '42P01') {
    console.error('deleteUser aiConversations error:', aiConversationsError)
    throw new Error('Failed to load AI conversations: ' + aiConversationsError.message)
  }

  const aiConversationIds = aiConversations?.map((conversation) => conversation.id) ?? []

  const isMissingRelationError = (error: { code?: string; message?: string } | null) => {
    const message = error?.message?.toLowerCase() ?? ''
    return error?.code === '42P01' || (message.includes('relation') && message.includes('does not exist'))
  }

  const deleteByColumn = async (
    table: string,
    column: string,
    value: string,
    options?: { optional?: boolean }
  ) => {
    const { error } = await admin.from(table).delete().eq(column, value)

    if (options?.optional && isMissingRelationError(error)) {
      return
    }

    if (error) {
      console.error(`deleteUser cleanup error (${table}.${column}):`, error)
      throw new Error(`Failed to delete ${table}: ${error.message}`)
    }
  }

  const deleteByCaseIds = async (table: string, options?: { optional?: boolean }) => {
    if (caseIds.length === 0) return

    const { error } = await admin.from(table).delete().in('case_id', caseIds)

    if (options?.optional && isMissingRelationError(error)) {
      return
    }

    if (error) {
      console.error(`deleteUser case cleanup error (${table}):`, error)
      throw new Error(`Failed to delete ${table}: ${error.message}`)
    }
  }

  await deleteByColumn('case_participants', 'user_id', userId)

  await deleteByCaseIds('case_participants')
  await deleteByCaseIds('case_hearings')
  await deleteByCaseIds('documents')

  if (caseIds.length > 0) {
    const { error: deleteCasesError } = await admin
      .from('cases')
      .delete()
      .in('id', caseIds)

    if (deleteCasesError) {
      console.error('deleteUser cases error:', deleteCasesError)
      throw new Error('Failed to delete user cases: ' + deleteCasesError.message)
    }
  }

  await deleteByColumn('notifications', 'user_id', userId, { optional: true })
  await deleteByColumn('user_push_tokens', 'user_id', userId, { optional: true })
  await deleteByColumn('ai_usage_logs', 'user_id', userId, { optional: true })
  if (aiConversationIds.length > 0) {
    const { error: aiMessagesError } = await admin
      .from('ai_messages')
      .delete()
      .in('conversation_id', aiConversationIds)

    if (!isMissingRelationError(aiMessagesError) && aiMessagesError) {
      console.error('deleteUser aiMessages error:', aiMessagesError)
      throw new Error('Failed to delete ai_messages: ' + aiMessagesError.message)
    }
  }
  await deleteByColumn('ai_conversations', 'user_id', userId, { optional: true })
  await deleteByColumn('legal_bookmarks', 'user_id', userId, { optional: true })
  await deleteByColumn('legal_notices', 'user_id', userId, { optional: true })
  await deleteByColumn('draft_templates', 'created_by', userId, { optional: true })
  await deleteByColumn('admin_notifications', 'sent_by', userId, { optional: true })
  await deleteByColumn('advocates', 'user_id', userId, { optional: true })
  await deleteByColumn('clients', 'user_id', userId, { optional: true })

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId)
  const { error: forceDeleteAuthError } = await admin.rpc('hard_delete_auth_user', {
    target_user_id: userId,
  })

  const authDeleteMessage = deleteAuthError?.message?.toLowerCase() ?? ''
  const forceDeleteAuthMessage = forceDeleteAuthError?.message?.toLowerCase() ?? ''

  if (deleteAuthError && !authDeleteMessage.includes('not found')) {
    console.error('deleteUser auth delete error:', deleteAuthError)
    throw new Error('Failed to delete auth user: ' + deleteAuthError.message)
  }

  if (
    forceDeleteAuthError &&
    forceDeleteAuthError.code !== '42883' &&
    forceDeleteAuthError.code !== 'PGRST202' &&
    !forceDeleteAuthMessage.includes('not found')
  ) {
    console.error('deleteUser auth hard delete error:', forceDeleteAuthError)
    throw new Error('Failed to hard delete auth user: ' + forceDeleteAuthError.message)
  }

  const { error: deleteProfileError } = await admin
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (deleteProfileError) {
    console.error('deleteUser profile delete error:', deleteProfileError)
    throw new Error('Failed to delete profile: ' + deleteProfileError.message)
  }

  revalidatePath('/dashboard/admin/users')
  revalidatePath('/dashboard/admin')
}

export async function unverifyUser(userId: string) {
  const { supabase } = await requireAdmin()
  const now = new Date().toISOString()

  const [{ error: profileError }, { error: advocateError }] = await Promise.all([
    supabase
      .from('profiles')
      .update({ is_verified: false, verification_source: null, badge_expires_at: null, updated_at: now })
      .eq('id', userId),
    supabase
      .from('advocates')
      .update({ is_verified: false, verification_source: null, badge_expires_at: null })
      .eq('user_id', userId),
  ])

  if (profileError) {
    console.error('unverifyUser error:', profileError)
    throw new Error('Failed to unverify user: ' + profileError.message)
  }

  if (advocateError && advocateError.code !== 'PGRST116') {
    console.error('unverifyUser advocate error:', advocateError)
    throw new Error('Failed to sync advocate verification: ' + advocateError.message)
  }

  revalidatePath('/dashboard/admin/users')
  revalidatePath('/dashboard/admin')
}
