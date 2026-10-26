// The draw and its reset run inside the database (draw_group / reset_group_draw, see
// supabase/migrations/20261013c_draw_in_database.sql): the full list of who gives to whom
// never reaches a browser, the organizer's included. The database also sends the emails.
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { groupIdSchema } from '@/lib/validations'

interface DrawResult {
  success: boolean
  error?: string
}

async function call(
  fn: 'draw_group' | 'reset_group_draw',
  groupId: string,
  extra: Record<string, unknown> = {}
): Promise<DrawResult> {
  const parsed = groupIdSchema.safeParse(groupId)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await createClient().rpc(fn, { p_group_id: groupId, ...extra })
  // The functions raise readable Spanish messages (not enough people, exclusions, etc.).
  return error ? { success: false, error: getUserFriendlyError(error) } : { success: true }
}

// avoidPrevious: don't repeat last edition's pairs (the database reads them, nobody sees them).
export const drawNames = (groupId: string, avoidPrevious = false) =>
  call('draw_group', groupId, { p_avoid_previous: avoidPrevious })
export const resetDraw = (groupId: string) => call('reset_group_draw', groupId)
