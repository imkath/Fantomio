'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { sendAnonymousMessage, getGiverMessages, getReceiverMessages } from '@/lib/actions/messages'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

interface Message {
  message_id: string
  match_id: string
  sender_role: string
  content: string
  created_at: string
}

interface AnonymousChatProps {
  matchId: string | null
  groupId: string
  role: 'giver' | 'receiver'
  receiverName?: string
}

export function AnonymousChat({ matchId, groupId, role, receiverName }: AnonymousChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [resolvedMatchId, setResolvedMatchId] = useState<string | null>(matchId)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Las tres dependencias son las que determinan qué mensajes se piden:
  // quién eres en el intercambio y de qué grupo o emparejamiento.
  // `quiet` skips the spinner for refreshes triggered by realtime.
  const loadMessages = useCallback(
    async (quiet = false) => {
      if (!quiet) setIsLoading(true)

      if (role === 'giver' && matchId) {
        const result = await getGiverMessages(matchId)
        if (result.success) {
          setMessages(result.messages)
        }
        setResolvedMatchId(matchId)
      } else if (role === 'receiver') {
        const result = await getReceiverMessages(groupId)
        if (result.success) {
          setMessages(result.messages)
          setResolvedMatchId(result.matchId)
        }
      }

      setIsLoading(false)
    },
    [matchId, groupId, role]
  )

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // New messages arrive live. Realtime applies the table's RLS, so each side only hears its match.
  useEffect(() => {
    if (!resolvedMatchId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`chat-${role}-${resolvedMatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anonymous_messages',
          filter: `match_id=eq.${resolvedMatchId}`,
        },
        () => loadMessages(true)
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [resolvedMatchId, role, loadMessages])

  // A conversation that already has messages starts open.
  const open = isExpanded || messages.length > 0

  useEffect(() => {
    // Scroll only the message box: scrollIntoView would move the whole page past the chat.
    const list = listRef.current
    if (open && list) list.scrollTop = list.scrollHeight
  }, [messages, open])

  // "Preguntar" always lands on the question field, even when the chat is already open.
  const [focusRequest, setFocusRequest] = useState(0)
  useEffect(() => {
    const input = inputRef.current
    if (!focusRequest || isLoading || !input) return
    input.focus({ preventScroll: true })
    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusRequest, isLoading, open])

  const openChat = () => {
    setIsExpanded(true)
    setFocusRequest((n) => n + 1)
  }

  const handleSend = async () => {
    if (!newMessage.trim() || !resolvedMatchId) return

    setIsSending(true)
    const result = await sendAnonymousMessage(resolvedMatchId, newMessage.trim(), role)

    if (result.success) {
      setNewMessage('')
      await loadMessages()
    } else {
      toast.error(result.error || 'No se pudo enviar. Intenta de nuevo.')
    }

    setIsSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // For receiver: if no one has sent them a message yet, show nothing
  if (role === 'receiver' && !isLoading && messages.length === 0 && !resolvedMatchId) {
    return null
  }

  const giver = role === 'giver'
  const panelId = `chat-${role}-${groupId}`

  return (
    <section
      className={
        giver ? 'border-rule border-t pt-5' : 'border-rule rounded-[4px] border p-6 md:p-8'
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className={giver ? 'text-[17px]' : 'text-xl font-bold'}>
          {giver
            ? `Pregúntale algo a ${receiverName || 'tu amigo secreto'} sin que sepa que eres tú`
            : 'Preguntas de quien te regala'}
        </h3>
        <div className="flex shrink-0 items-center gap-3 text-[15px]">
          {messages.length > 0 && (
            <span className="text-graphite">
              {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={openChat} aria-controls={panelId}>
            <MessageCircle aria-hidden="true" />
            {giver ? 'Preguntar' : 'Responder'}
          </Button>
        </div>
      </div>

      {open && (
        <div id={panelId} className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="text-faint h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-graphite mb-4 text-[15px]">
                {giver
                  ? 'Lo que preguntes le llega sin tu nombre. Sirve para cosas como la talla o qué le falta.'
                  : 'Alguien del grupo te pregunta cosas para acertar con tu regalo. No sabes quién es, y no hace falta.'}
              </p>

              <div ref={listRef} className="mb-4 grid max-h-72 gap-2 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-graphite py-3 text-center text-[15px]">
                    {giver ? 'Todavía no preguntas nada.' : 'Todavía no hay preguntas.'}
                  </p>
                )}
                {messages.map((msg) => {
                  const isMe = msg.sender_role === role
                  return (
                    <div
                      key={msg.message_id}
                      className={`max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-[15px] break-words ${
                        isMe
                          ? 'bg-ink text-paper justify-self-end rounded-br-[3px]'
                          : 'bg-slip text-ink justify-self-start rounded-bl-[3px]'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className="mt-1 text-[13px] opacity-60">
                        {new Date(msg.created_at).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )
                })}
              </div>

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  aria-label={giver ? 'Tu pregunta' : 'Tu respuesta'}
                  placeholder={giver ? '¿Qué talla usas?' : 'Escribe tu respuesta'}
                  maxLength={500}
                  className="border-input bg-paper text-ink placeholder:text-faint focus-visible:border-ink h-11 min-w-0 flex-1 rounded-[8px] border px-3 text-base outline-none"
                />
                <Button type="submit" disabled={!newMessage.trim() || isSending}>
                  {isSending ? <Loader2 className="animate-spin" /> : <Send aria-hidden="true" />}
                  Enviar
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  )
}
