// The draw and its reset run inside the database (draw_group / reset_group_draw, see
// supabase/migrations/20261013c_draw_in_database.sql): the full list of who gives to whom
// never reaches a browser, the organizer's included. The database also sends the emails.
import { createClient } from '@/lib/supabase'
import { groupIdSchema } from '@/lib/validations'

interface DrawResult {
  success: boolean
  error?: string
}

async function call(fn: 'draw_group' | 'reset_group_draw', groupId: string): Promise<DrawResult> {
  const parsed = groupIdSchema.safeParse(groupId)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await createClient().rpc(fn, { p_group_id: groupId })
  // The functions raise readable Spanish messages (not enough people, exclusions, etc.).
  return error ? { success: false, error: error.message } : { success: true }
}

export const drawNames = (groupId: string) => call('draw_group', groupId)
export const resetDraw = (groupId: string) => call('reset_group_draw', groupId)
