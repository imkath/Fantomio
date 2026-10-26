'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Eye, Loader2, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GhostMark } from '@/components/ghost-mark'
import { AnonymousChat } from '@/components/anonymous-chat'
import { createClient } from '@/lib/supabase'
import { getUserFriendlyError } from '@/lib/errors'

// "Sorteo a ciegas". Until the reveal the database gives the giver only the list and the chat
// (my_blind_assignment); names never reach the browser. See 20261026m_blind_mode.sql.

type Item = { description: string; url?: string }

const revealTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

export function BlindAssignment({
  groupId,
  people,
  revealAt,
  isAdmin,
  onRevealed,
}: {
  groupId: string
  // Everyone in the group but you: the options for the guess.
  people: Array<{ id: string; name: string }>
  revealAt: string | null
  isAdmin: boolean
  onRevealed: () => void
}) {
  const [assignment, setAssignment] = useState<{ match_id: string; items: Item[] } | null>(null)
  const [guess, setGuess] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .rpc('my_blind_assignment', { p_group_id: groupId })
      .then(({ data }) => setAssignment(data as typeof assignment))
    supabase
      .rpc('my_guess', { p_group_id: groupId })
      .then(({ data }) => setGuess((data as string) ?? ''))
  }, [groupId])

  const saveGuess = async (value: string) => {
    setGuess(value)
    if (!value) return
    setSaving(true)
    const { error } = await createClient().rpc('place_guess', {
      p_group_id: groupId,
      p_guessed: value,
    })
    setSaving(false)
    if (error) return toast.error(getUserFriendlyError(error))
    toast.success('Apuesta guardada. La puedes cambiar hasta la revelación.')
  }

  if (!assignment) {
    return (
      <section className="border-rule rounded-[4px] border p-6 md:p-8">
        <Loader2 className="text-faint h-6 w-6 animate-spin" />
      </section>
    )
  }

  return (
    <section className="border-rule bg-raised space-y-7 rounded-[4px] border p-6 md:p-8">
      <div className="flex items-center gap-5">
        <GhostMark className="text-ink h-[64px] w-[56px] shrink-0" />
        <div>
          <p className="text-graphite text-[15px] font-medium">Sorteo a ciegas</p>
          <p className="text-[26px] leading-tight font-bold">Le regalas a alguien de este grupo</p>
          <p className="text-graphite">
            {revealAt
              ? `Se revela cuando quien organiza toque "Revelar ahora", o el ${revealTime(revealAt)}.`
              : 'Se revela cuando quien organiza toque "Revelar ahora", el día del intercambio.'}
          </p>
        </div>
      </div>

      <div>
        <p className="text-graphite mb-3 text-[15px] font-medium">Lo que le gustaría</p>
        <ul className="grid gap-2">
          {assignment.items.map((item, i) => (
            <li
              key={i}
              className="bg-slip flex items-baseline justify-between gap-4 rounded-[3px] px-4 py-3"
            >
              <span className="min-w-0 break-words">{item.description}</span>
              {item.url && (
                <a
                  href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-hanko inline-flex shrink-0 items-center gap-1.5 text-[15px] underline underline-offset-[3px]"
                >
                  Ver link
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="blind-guess" className="text-[15px] font-medium">
          ¿De quién crees que es esta lista?
        </label>
        <select
          id="blind-guess"
          value={guess}
          disabled={saving}
          onChange={(e) => saveGuess(e.target.value)}
          className="border-rule bg-paper min-h-11 max-w-sm rounded-[4px] border px-3 text-[17px]"
        >
          <option value="">Todavía no sé</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-graphite text-sm">
          Solo tú ves tu apuesta. Al revelar te decimos si acertaste.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-graphite text-sm">
          Puedes pedirle pistas por el chat. Hasta la revelación, los nombres de todos se tapan
          automáticamente, también el tuyo.
        </p>
        <AnonymousChat matchId={assignment.match_id} groupId={groupId} role="giver" />
      </div>

      {isAdmin && <RevealNowButton groupId={groupId} onRevealed={onRevealed} />}
    </section>
  )
}

function RevealNowButton({ groupId, onRevealed }: { groupId: string; onRevealed: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const reveal = async () => {
    setBusy(true)
    const { error } = await createClient().rpc('reveal_blind', { p_group_id: groupId })
    setBusy(false)
    setOpen(false)
    if (error) return toast.error(getUserFriendlyError(error))
    onRevealed()
  }
  return (
    <div className="border-rule border-t pt-6">
      <p className="mb-3 text-[15px]">
        Cuando estén todos juntos y hayan apostado, revélalo: a cada uno le aparece al mismo tiempo
        a quién le regala.
      </p>
      <Button onClick={() => setOpen(true)}>
        <Eye aria-hidden="true" />
        Revelar ahora
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Revelamos el sorteo?</DialogTitle>
            <DialogDescription>
              Todos verán a quién le regalan y si acertaron. Las apuestas se cierran y no se puede
              volver a ocultar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Todavía no
            </Button>
            <Button onClick={reveal} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Eye aria-hidden="true" />}
              Revelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// After the reveal: did you guess right, and how did the group do.
export function BlindResults({ groupId }: { groupId: string }) {
  const [res, setRes] = useState<{
    my_guess: string | null
    correct: boolean | null
    correct_count: number
    guess_count: number
    total: number
  } | null>(null)
  useEffect(() => {
    createClient()
      .rpc('blind_results', { p_group_id: groupId })
      .then(({ data }) => setRes(data as typeof res))
  }, [groupId])
  if (!res) return null
  return (
    <section className="border-ink flex items-start gap-4 rounded-[4px] border p-6">
      <PartyPopper className="text-hanko mt-1 size-7 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-bold">
          {res.my_guess == null
            ? 'No apostaste esta vez.'
            : res.correct
              ? `¡Acertaste! Era ${res.my_guess}.`
              : `Creías que era ${res.my_guess}. No era.`}
        </p>
        <p className="text-graphite text-[15px]">
          {res.correct_count} de {res.guess_count}{' '}
          {res.guess_count === 1
            ? 'persona que apostó adivinó'
            : 'personas que apostaron adivinaron'}
          {res.guess_count < res.total && ` (de ${res.total} en el grupo)`}.
        </p>
      </div>
    </section>
  )
}

// Before a blind draw: everyone needs a list. Returns who's missing so the page can block the
// draw button too.
export function BlindListsNotice({ missing, isAdmin }: { missing: string[]; isAdmin: boolean }) {
  if (!missing.length) {
    return (
      <p className="text-graphite text-[15px]">
        Todos anotaron su lista.{' '}
        {isAdmin ? 'Ya puedes hacer el sorteo.' : 'Falta que quien organiza haga el sorteo.'}
      </p>
    )
  }
  return (
    <p className="text-[15px]">
      Para sortear a ciegas, todos tienen que anotar su lista. Faltan las de{' '}
      <strong>{missing.join(', ')}</strong>.
    </p>
  )
}
