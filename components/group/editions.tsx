'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Gift, Loader2, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LazyConfirmDialog } from '@/components/lazy-confirm-dialog'
import { GhostAvatar } from '@/components/ghost-avatar'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'
import { groupPath } from '@/lib/routes'
import { parseLocalDate } from '@/lib/utils'

// Repeating a group, its earlier editions, archiving and the voluntary reveal. The rules are
// in the database (20261026j_editions_archive_reveal.sql); these only show and call them.

const longDate = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export function ArchivedNotice({
  groupId,
  isAdmin,
  onChange,
}: {
  groupId: string
  isAdmin: boolean
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const restore = async () => {
    setBusy(true)
    const { error } = await createClient().rpc('set_group_archived', {
      p_group_id: groupId,
      p_archived: false,
    })
    setBusy(false)
    if (error) return toast.error(getUserFriendlyError(error))
    toast.success('Grupo restaurado')
    onChange()
  }
  return (
    <div className="border-rule bg-slip mt-6 flex flex-col gap-4 rounded-[4px] border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">Este grupo está archivado</p>
        <p className="text-graphite text-[15px]">
          Queda como recuerdo. Se puede mirar, pero ya no se cambian listas ni sorteo, y los
          mensajes anónimos se cerraron.
        </p>
      </div>
      {isAdmin && (
        <Button variant="outline" className="shrink-0" disabled={busy} onClick={restore}>
          {busy ? <Loader2 className="animate-spin" /> : <ArchiveRestore aria-hidden="true" />}
          Restaurar
        </Button>
      )}
    </div>
  )
}

export function ArchiveButton({ groupId, onChange }: { groupId: string; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const archive = async () => {
    setBusy(true)
    const { error } = await createClient().rpc('set_group_archived', {
      p_group_id: groupId,
      p_archived: true,
    })
    setBusy(false)
    setOpen(false)
    if (error) return toast.error(getUserFriendlyError(error))
    toast.success('Grupo archivado')
    onChange()
  }
  return (
    <>
      <Button variant="outline" className="justify-start" onClick={() => setOpen(true)}>
        <Archive aria-hidden="true" />
        Archivar grupo
      </Button>
      <LazyConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Archivar el grupo?"
        description="Pasa a Anteriores para todos y queda de solo lectura, así que ya no se cambian listas ni sorteo y los mensajes anónimos se cierran. Lo puedes restaurar cuando quieras. Igual se archiva solo 7 días después de la fecha del intercambio."
        cancelLabel="Cancelar"
        confirmLabel="Archivar"
        icon={<Archive aria-hidden="true" />}
        busy={busy}
        onConfirm={archive}
      />
    </>
  )
}

export function HideButton({
  groupId,
  hidden,
  onChange,
}: {
  groupId: string
  hidden: boolean
  onChange: () => void
}) {
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    setBusy(true)
    const { error } = await createClient().rpc('set_group_hidden', {
      p_group_id: groupId,
      p_hidden: !hidden,
    })
    setBusy(false)
    if (error) return toast.error(getUserFriendlyError(error))
    toast.success(hidden ? 'Volvió a tus grupos activos' : 'Lo moviste a Anteriores, solo para ti')
    onChange()
  }
  return (
    <Button variant="outline" className="justify-start" disabled={busy} onClick={toggle}>
      {hidden ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
      {hidden ? 'Mostrar en mis grupos' : 'Ocultar de mis grupos'}
    </Button>
  )
}

interface Pending {
  user_id: string
  name: string
  avatar_url: string | null
  declined: boolean
}

export function PendingInvitations({
  groupId,
  isAdmin,
  refreshKey,
}: {
  groupId: string
  isAdmin: boolean
  refreshKey: unknown
}) {
  const [list, setList] = useState<Pending[]>([])

  const load = useCallback(() => {
    createClient()
      .rpc('group_pending_invitations', { p_group_id: groupId })
      .then(({ data }) => setList((data ?? []) as Pending[]))
  }, [groupId])
  useEffect(load, [load, refreshKey])

  const act = async (fn: 'cancel_invitation' | 'reinvite', userId: string, done: string) => {
    const { error } = await createClient().rpc(fn, { p_group_id: groupId, p_user: userId })
    if (error) return toast.error(getUserFriendlyError(error))
    toast.success(done)
    load()
  }

  const pending = list.filter((p) => !p.declined)
  const declined = list.filter((p) => p.declined)
  if (!list.length) return null

  const row = (p: Pending, action: React.ReactNode) => (
    <li key={p.user_id} className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-3">
        <GhostAvatar seed={p.user_id} src={p.avatar_url ?? undefined} size={32} />
        <span className="text-graphite truncate">{p.name}</span>
      </span>
      {isAdmin && action}
    </li>
  )

  return (
    <div className="border-rule mt-4 space-y-4 border-t pt-4">
      {pending.length > 0 && (
        <div>
          <p className="text-graphite mb-1 text-[15px]">
            Invitados que aún no responden ({pending.length})
          </p>
          <ul className="divide-rule divide-y">
            {pending.map((p) =>
              row(
                p,
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => act('cancel_invitation', p.user_id, 'Invitación quitada')}
                  aria-label={`Quitar la invitación de ${p.name}`}
                  title="Quitar la invitación"
                >
                  <X aria-hidden="true" />
                </Button>
              )
            )}
          </ul>
        </div>
      )}
      {declined.length > 0 && (
        <div>
          <p className="text-graphite mb-1 text-[15px]">No van esta vez ({declined.length})</p>
          <ul className="divide-rule divide-y">
            {declined.map((p) =>
              row(
                p,
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => act('reinvite', p.user_id, `Volvimos a invitar a ${p.name}`)}
                >
                  <RotateCcw aria-hidden="true" />
                  Volver a invitar
                </Button>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

interface Edition {
  group_id: string
  name: string
  exchange_date: string | null
  budget: number | null
  currency: string
  participants: string[]
  you_gave_to: string | null
}

export function EditionHistory({ groupId }: { groupId: string }) {
  const [editions, setEditions] = useState<Edition[] | null>(null)
  useEffect(() => {
    createClient()
      .rpc('group_history', { p_group_id: groupId })
      .then(({ data }) => setEditions((data ?? []) as Edition[]))
  }, [groupId])

  if (!editions?.length) return null
  return (
    <section className="border-rule rounded-[4px] border p-6 md:p-8">
      <h2 className="text-xl font-bold">Ediciones anteriores</h2>
      <p className="text-graphite mt-1 text-[15px]">
        De cada una solo ves a quién le regalaste tú.
      </p>
      <ol className="divide-rule mt-5 divide-y">
        {editions.map((e) => (
          <li key={e.group_id} className="py-4 first:pt-0 last:pb-0">
            <a
              href={groupPath(e.group_id)}
              className="font-bold underline-offset-4 hover:underline"
            >
              {e.name}
            </a>
            <p className="text-graphite text-[15px]">
              {[
                e.exchange_date && longDate(e.exchange_date),
                e.budget != null && `$${e.budget.toLocaleString('es-CL')} ${e.currency}`,
                `${e.participants.length} personas`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {e.you_gave_to && (
              <p className="mt-1 text-[15px]">
                Le regalaste a <strong>{e.you_gave_to}</strong>
              </p>
            )}
            <p className="text-graphite mt-1 text-sm">{e.participants.join(', ')}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

// After the exchange, the giver can choose to tell their receiver who they were.
export function RevealYourself({
  groupId,
  receiverName,
  revealed,
  onChange,
}: {
  groupId: string
  receiverName: string
  revealed: boolean
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const reveal = async () => {
    setBusy(true)
    const { error } = await createClient().rpc('reveal_myself', { p_group_id: groupId })
    setBusy(false)
    setOpen(false)
    if (error) return toast.error(getUserFriendlyError(error))
    toast.success(`Le contamos a ${receiverName} que fuiste tú`)
    onChange()
  }
  if (revealed) {
    return (
      <p className="text-graphite bg-slip rounded-[3px] px-4 py-3 text-[15px]">
        {receiverName} ya sabe que fuiste tú.
      </p>
    )
  }
  return (
    <div className="bg-slip space-y-3 rounded-[3px] px-4 py-4">
      <p className="text-[15px]">
        Ya pasó el intercambio. Si quieres, puedes contarle a {receiverName} que fuiste tú. Solo lo
        sabrá esa persona.
      </p>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Gift aria-hidden="true" />
        Contarle que fui yo
      </Button>
      <LazyConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Le cuentas a ${receiverName} que fuiste tú?`}
        description="Le avisamos en la app y por correo. Nadie más del grupo se entera, y no se puede deshacer."
        cancelLabel="Mejor no"
        confirmLabel="Contarle"
        icon={<Gift aria-hidden="true" />}
        busy={busy}
        onConfirm={reveal}
      />
    </div>
  )
}

// What the receiver sees if their giver chose to reveal themselves.
export function RevealedGiver({ groupId }: { groupId: string }) {
  const [giver, setGiver] = useState<string | null>(null)
  useEffect(() => {
    createClient()
      .rpc('my_revealed_giver', { p_group_id: groupId })
      .then(({ data }) => setGiver((data as string) ?? null))
  }, [groupId])
  if (!giver) return null
  return (
    <section className="border-rule bg-raised flex items-center gap-4 rounded-[4px] border p-6">
      <Gift className="text-hanko size-7 shrink-0" aria-hidden="true" />
      <p>
        Quien te regaló quiso contártelo: fue <strong>{giver}</strong>.
      </p>
    </section>
  )
}
