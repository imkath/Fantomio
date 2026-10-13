// Runs in the browser with the person's session; RLS decides what each call may do.

import { createClient } from '@/lib/supabase'
import { z } from 'zod'

const sendMessageSchema = z.object({
  matchId: z.string().uuid(),
  content: z.string().min(1).max(500),
  senderRole: z.enum(['giver', 'receiver']),
})

interface ActionResult {
  success: boolean
  error?: string
}

export async function sendAnonymousMessage(
  matchId: string,
  content: string,
  senderRole: 'giver' | 'receiver'
): Promise<ActionResult> {
  const parsed = sendMessageSchema.safeParse({ matchId, content, senderRole })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  const { error } = await supabase.from('anonymous_messages').insert({
    match_id: matchId,
    content: content.trim(),
    sender_role: senderRole,
  })

  if (error) {
    console.error('Error sending anonymous message:', error)
    return { success: false, error: 'Error al enviar mensaje' }
  }

  return { success: true }
}

interface Message {
  message_id: string
  match_id: string
  sender_role: string
  content: string
  created_at: string
}

export async function getGiverMessages(matchId: string): Promise<{
  success: boolean
  messages: Message[]
  error?: string
}> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, messages: [], error: 'No autenticado' }
  }

  const { data, error } = await supabase
    .from('anonymous_messages')
    .select('id, match_id, sender_role, content, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching giver messages:', error)
    return { success: false, messages: [], error: 'Error al cargar mensajes' }
  }

  return {
    success: true,
    messages: (data || []).map((m) => ({
      message_id: m.id,
      match_id: m.match_id,
      sender_role: m.sender_role,
      content: m.content,
      created_at: m.created_at,
    })),
  }
}

export async function getReceiverMessages(groupId: string): Promise<{
  success: boolean
  messages: Message[]
  matchId: string | null
  error?: string
}> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, messages: [], matchId: null, error: 'No autenticado' }
  }

  // Get the match_id where this user is the receiver
  const { data: matchIdData, error: matchIdError } = await supabase.rpc('get_receiver_match_id', {
    p_group_id: groupId,
  })

  if (matchIdError || !matchIdData) {
    return { success: true, messages: [], matchId: null }
  }

  // Get messages for this match
  const { data, error } = await supabase.rpc('get_receiver_messages', {
    p_group_id: groupId,
  })

  if (error) {
    console.error('Error fetching receiver messages:', error)
    return { success: false, messages: [], matchId: matchIdData, error: 'Error al cargar mensajes' }
  }

  return {
    success: true,
    messages: (data || []).map((m: Message) => ({
      message_id: m.message_id,
      match_id: m.match_id,
      sender_role: m.sender_role,
      content: m.content,
      created_at: m.created_at,
    })),
    matchId: matchIdData,
  }
}
