// Runs in the browser with the person's session; RLS decides what each call may do.

import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { updateGroupSchema, groupIdSchema, memberIdSchema } from '@/lib/validations'

export async function updateGroup(
  groupId: string,
  data: {
    name?: string
    budget?: number | null
    currency?: string
    exchange_date?: string | null
  }
) {
  // Validate inputs
  const groupIdResult = groupIdSchema.safeParse(groupId)
  if (!groupIdResult.success) {
    return { success: false, error: groupIdResult.error.errors[0].message }
  }

  const dataResult = updateGroupSchema.safeParse(data)
  if (!dataResult.success) {
    return { success: false, error: dataResult.error.errors[0].message }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  // Verify user is admin
  const { data: group } = await supabase
    .from('groups')
    .select('admin_id')
    .eq('id', groupId)
    .single()

  if (!group || group.admin_id !== user.id) {
    return { success: false, error: 'No tienes permisos para editar este grupo' }
  }

  const { error } = await supabase.from('groups').update(data).eq('id', groupId)

  if (error) {
    return { success: false, error: getUserFriendlyError(error) }
  }

  // Log activity
  await supabase.from('activities').insert({
    group_id: groupId,
    user_id: user.id,
    type: 'GROUP_UPDATED',
    message: `Grupo actualizado`,
  })

  return { success: true }
}

export async function deleteGroup(groupId: string) {
  // Validate input
  const groupIdResult = groupIdSchema.safeParse(groupId)
  if (!groupIdResult.success) {
    return { success: false, error: groupIdResult.error.errors[0].message }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  // Verify user is admin
  const { data: group } = await supabase
    .from('groups')
    .select('admin_id, name')
    .eq('id', groupId)
    .single()

  if (!group || group.admin_id !== user.id) {
    return { success: false, error: 'No tienes permisos para eliminar este grupo' }
  }

  // Members, matches, exclusions, lists and activity go with it (ON DELETE CASCADE).
  const { error } = await supabase.from('groups').delete().eq('id', groupId)

  if (error) {
    return { success: false, error: getUserFriendlyError(error) }
  }

  return { success: true }
}

export async function leaveGroup(groupId: string) {
  // Validate input
  const groupIdResult = groupIdSchema.safeParse(groupId)
  if (!groupIdResult.success) {
    return { success: false, error: groupIdResult.error.errors[0].message }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  // Check if user is admin
  const { data: group } = await supabase
    .from('groups')
    .select('admin_id, status')
    .eq('id', groupId)
    .single()

  if (!group) {
    return { success: false, error: 'Grupo no encontrado' }
  }

  if (group.admin_id === user.id) {
    return {
      success: false,
      error:
        'Quien organiza no puede salir del grupo. Primero pasa la organización a otra persona o elimina el grupo.',
    }
  }

  if (group.status === 'DRAWN') {
    return { success: false, error: 'No puedes abandonar un grupo después del sorteo' }
  }

  // RLS turns a forbidden delete into "0 rows", not an error, so check that it happened.
  const { data: left, error } = await supabase
    .from('members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    return { success: false, error: getUserFriendlyError(error) }
  }
  if (!left?.length) {
    return { success: false, error: 'No puedes salir de este grupo' }
  }

  // The database logs the departure (on_member_left trigger).
  return { success: true }
}

export async function removeMember(groupId: string, memberId: string) {
  // Validate inputs
  const groupIdResult = groupIdSchema.safeParse(groupId)
  if (!groupIdResult.success) {
    return { success: false, error: groupIdResult.error.errors[0].message }
  }

  const memberIdResult = memberIdSchema.safeParse(memberId)
  if (!memberIdResult.success) {
    return { success: false, error: memberIdResult.error.errors[0].message }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  // Verify user is admin
  const { data: group } = await supabase
    .from('groups')
    .select('admin_id, status')
    .eq('id', groupId)
    .single()

  if (!group || group.admin_id !== user.id) {
    return { success: false, error: 'No tienes permisos para eliminar miembros' }
  }

  if (group.status === 'DRAWN') {
    return { success: false, error: 'No puedes eliminar miembros después del sorteo' }
  }

  const { data: member } = await supabase
    .from('members')
    .select('user_id')
    .eq('id', memberId)
    .eq('group_id', groupId)
    .single()

  if (!member) {
    return { success: false, error: 'Miembro no encontrado' }
  }

  // Can't remove yourself (admin)
  if (member.user_id === user.id) {
    return { success: false, error: 'No puedes eliminarte a ti mismo' }
  }

  // Delete member
  const { data: removed, error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)
    .select('id')

  if (error) {
    return { success: false, error: getUserFriendlyError(error) }
  }
  if (!removed?.length) {
    return { success: false, error: 'No se pudo quitar a esta persona' }
  }

  // The database logs the removal (on_member_left trigger).
  return { success: true }
}

export async function getGroupActivities(groupId: string) {
  // Validate input
  const groupIdResult = groupIdSchema.safeParse(groupId)
  if (!groupIdResult.success) {
    return { success: false, error: groupIdResult.error.errors[0].message, activities: [] }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'No autenticado', activities: [] }
  }

  // Verify user is member
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { success: false, error: 'No eres miembro de este grupo', activities: [] }
  }

  const { data: activities, error } = await supabase
    .from('activities')
    .select(
      `
      id,
      type,
      message,
      created_at,
      profiles:user_id (
        full_name,
        email,
        avatar_url
      )
    `
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return { success: false, error: getUserFriendlyError(error), activities: [] }
  }

  return { success: true, activities: activities || [] }
}

// Hands the group to another member. The checks (only the current organizer, only to someone
// in the group) and the activity entry happen in the database, in one step (transfer_group).
export async function transferGroup(groupId: string, newAdminId: string) {
  const groupIdResult = groupIdSchema.safeParse(groupId)
  if (!groupIdResult.success) {
    return { success: false, error: groupIdResult.error.errors[0].message }
  }
  const newAdminResult = groupIdSchema.safeParse(newAdminId)
  if (!newAdminResult.success) {
    return { success: false, error: 'Persona no válida' }
  }

  const { error } = await createClient().rpc('transfer_group', {
    p_group_id: groupId,
    p_new_admin: newAdminId,
  })
  return error ? { success: false, error: getUserFriendlyError(error) } : { success: true }
}
