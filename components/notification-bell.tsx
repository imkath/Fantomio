'use client'

import { groupPath } from '@/lib/routes'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Bell, ListChecks, MessageCircleQuestion, MessageCircleReply } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase'

// The bell in the app header. Rows are created by database triggers (questions, replies and
// wishlist changes); here we only list them, keep them live and mark them as read on open.
interface Notification {
  id: string
  group_id: string
  type: 'question' | 'reply' | 'wishlist'
  body: string
  read_at: string | null
  created_at: string
}

const ICONS = {
  question: MessageCircleQuestion,
  reply: MessageCircleReply,
  wishlist: ListChecks,
}

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}

export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([])

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from('notifications')
      .select('id, group_id, type, body, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setItems(data as Notification[])
  }, [])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        load
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  const unread = items.filter((n) => !n.read_at).length

  // Marked as read when the list closes, so new ones stay bold while you look at them.
  const markRead = async (open: boolean) => {
    if (open || unread === 0) return
    const now = new Date().toISOString()
    // ponytail: everything visible counts as read; per-item state only if people miss things.
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    await createClient()
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
  }

  return (
    <Popover onOpenChange={markRead}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="btn-single"
          aria-label={unread ? `Avisos, ${unread} sin leer` : 'Avisos'}
        >
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <span className="bg-hanko text-hanko-ink absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[12px] leading-none font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))] p-0">
        <p className="border-rule border-b px-4 py-3 font-bold">Avisos</p>
        {items.length === 0 ? (
          <p className="text-graphite px-4 py-6 text-[15px]">
            Aquí te avisamos cuando te hagan una pregunta, te respondan o tu amigo secreto cambie su
            lista.
          </p>
        ) : (
          <ul className="divide-rule max-h-[60vh] divide-y overflow-y-auto">
            {items.map((n) => {
              const Icon = ICONS[n.type]
              return (
                <li key={n.id}>
                  <Link
                    href={groupPath(n.group_id)}
                    className="hover:bg-slip flex gap-3 px-4 py-3 transition-colors"
                  >
                    <span className="bg-slip text-ink grid size-9 shrink-0 place-items-center rounded-full">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[15px] ${n.read_at ? '' : 'font-bold'}`}>
                        {n.body}
                      </span>
                      <span className="text-graphite text-sm">{timeAgo(n.created_at)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
