// Runs in the browser with the person's session; RLS decides what each call may do.

import { createClient } from '@/lib/supabase'
import { addExclusionSchema, removeExclusionSchema } from '@/lib/validations'

interface ExclusionResult {
  success: boolean
  error?: string
}

interface Exclusion {
  id: string
  group_id: string
  giver_id: string
  excluded_receiver_id: string
  created_at: string
}

interface GetExclusionsResult {
  success: boolean
  exclusions?: Exclusion[]
  error?: string
}

/**
 * Add a gifting restriction (A cannot give to B)
 */
export async function addExclusion(
  groupId: string,
  giverId: string,
  excludedReceiverId: string
): Promise<ExclusionResult> {
  // Validate input
  const validation = addExclusionSchema.safeParse({
    groupId,
    giverId,
    excludedReceiverId,
  })

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const supabase = createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'No autenticado' }
  }

  // Verify user is admin of this group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('admin_id, status')
    .eq('id', groupId)
    .single()

  if (groupError || !group) {
    return { success: false, error: 'Grupo no encontrado' }
  }

  if (group.admin_id !== user.id) {
    return { success: false, error: 'Solo el administrador puede gestionar restricciones' }
  }

  if (group.status === 'DRAWN') {
    return { success: false, error: 'No se pueden modificar restricciones después del sorteo' }
  }

  // Verify both users are members of the group
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('user_id')
    .eq('group_id', groupId)
    .in('user_id', [giverId, excludedReceiverId])

  if (membersError || !members || members.length !== 2) {
    return { success: false, error: 'Ambos usuarios deben ser miembros del grupo' }
  }

  // Insert exclusion
  const { error: insertError } = await supabase.from('exclusions').insert({
    group_id: groupId,
    giver_id: giverId,
    excluded_receiver_id: excludedReceiverId,
  })

  if (insertError) {
    // Handle unique constraint violation
    if (insertError.code === '23505') {
      return { success: false, error: 'Esta restricción ya existe' }
    }
    console.error('Error inserting exclusion:', insertError)
    return { success: false, error: 'Error al crear la restricción' }
  }

  return { success: true }
}

/**
 * Remove a gifting restriction
 */
export async function removeExclusion(exclusionId: string): Promise<ExclusionResult> {
  // Validate input
  const validation = removeExclusionSchema.safeParse({ exclusionId })

  if (!validation.success) {
    return { success: false, error: validation.error.errors[0].message }
  }

  const supabase = createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'No autenticado' }
  }

  // Get exclusion and verify permissions
  const { data: exclusion, error: exclusionError } = await supabase
    .from('exclusions')
    .select('group_id, groups!inner(admin_id, status)')
    .eq('id', exclusionId)
    .single()

  if (exclusionError || !exclusion) {
    return { success: false, error: 'Restricción no encontrada' }
  }

  const groupData = exclusion.groups as unknown as { admin_id: string; status: string }

  if (groupData.admin_id !== user.id) {
    return { success: false, error: 'Solo el administrador puede gestionar restricciones' }
  }

  if (groupData.status === 'DRAWN') {
    return { success: false, error: 'No se pueden modificar restricciones después del sorteo' }
  }

  // Delete exclusion
  const { error: deleteError } = await supabase.from('exclusions').delete().eq('id', exclusionId)

  if (deleteError) {
    console.error('Error deleting exclusion:', deleteError)
    return { success: false, error: 'Error al eliminar la restricción' }
  }

  return { success: true }
}

/**
 * Get all exclusions for a group
 */
export async function getExclusions(groupId: string): Promise<GetExclusionsResult> {
  const supabase = createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'No autenticado' }
  }

  // Verify user is member of the group
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) {
    return { success: false, error: 'No eres miembro de este grupo' }
  }

  // Get all exclusions for this group
  const { data: exclusions, error: exclusionsError } = await supabase
    .from('exclusions')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (exclusionsError) {
    console.error('Error fetching exclusions:', exclusionsError)
    return { success: false, error: 'Error al obtener las restricciones' }
  }

  return { success: true, exclusions: exclusions || [] }
}
