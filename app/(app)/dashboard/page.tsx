'use client'

import { groupPath } from '@/lib/routes'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GhostMark } from '@/components/ghost-mark'
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronDown,
  CalendarDays,
  KeyRound,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InstallApp } from '@/components/install-app'
import { JoinGroupForm } from '@/components/join-group-form'
import { NewGroupForm } from '@/components/new-group-form'
import { toast } from 'sonner'

// On phones the modal takes the whole screen, like its own view; on wider screens it's a dialog.
// A column with a fixed header (title and X), a scrolling middle and, in the forms, a fixed
// footer with the main button: nothing important scrolls away. Full screen on phones.
const sheet =
  'flex max-h-[min(90dvh,860px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px] max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0'
import { createClient, getSessionUser } from '@/lib/supabase'
import { DashboardSkeleton } from '@/components/skeletons'
import { getUserFriendlyError } from '@/lib/errors'
import { parseLocalDate } from '@/lib/utils'

interface Group {
  id: string
  name: string
  budget: number | null
  exchange_date: string | null
  status: 'PLANNING' | 'DRAWN'
  member_count: number
  is_admin: boolean
  archived: boolean
  hidden: boolean
}

interface Invitation {
  group_id: string
  name: string
  organizer: string | null
  exchange_date: string | null
}

const shortDate = (iso: string) =>
  parseLocalDate(iso)
    .toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '')

// One line of a group card: icon in a soft circle, then the value. The label is for screen
// readers; the icon carries it visually.
function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="bg-slip border-rule text-ink grid size-9 shrink-0 place-items-center rounded-full border"
        aria-hidden="true"
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="sr-only">{label}: </span>
      <span className="text-ink font-medium">{children}</span>
    </li>
  )
}

function GroupCard({ group }: { group: Group }) {
  const badge = group.archived
    ? 'Archivado'
    : group.hidden
      ? 'Oculto'
      : group.status === 'DRAWN'
        ? 'Sorteado'
        : 'Sin sortear'
  return (
    <Link
      href={groupPath(group.id)}
      className={`border-rule bg-raised hover:border-ink group relative flex h-full flex-col rounded-[4px] border p-6 pt-8 transition-colors ${
        group.archived || group.hidden ? 'opacity-80' : ''
      }`}
    >
      <h2 className="mb-5 text-xl leading-snug font-bold break-words">{group.name}</h2>
      {/* Sits on the card's top edge so the title gets the full width. */}
      <span
        className={`absolute -top-3.5 left-5 rounded-full px-3 py-1.5 text-[15px] leading-none font-medium ${
          badge === 'Sorteado' ? 'bg-ink text-paper' : 'border-rule bg-paper text-graphite border'
        }`}
      >
        {badge}
      </span>
      <ul className="grid gap-2.5 text-[17px]">
        <Meta icon={Users} label="Personas">
          {group.member_count} {group.member_count === 1 ? 'persona' : 'personas'}
        </Meta>
        {group.exchange_date && (
          <Meta icon={CalendarDays} label="Intercambio">
            {shortDate(group.exchange_date)}
          </Meta>
        )}
        {group.budget != null && (
          <Meta icon={Banknote} label="Presupuesto">
            ${group.budget.toLocaleString('es-CL')}
          </Meta>
        )}
      </ul>
      <div className="mt-auto flex items-center justify-between pt-6">
        {/* The whole card is the link; this only looks like a button. */}
        <span className="btn-paper btn-single text-ink group-hover:text-paper inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[15px] font-medium transition-colors [--edge:var(--ink)] [--face:var(--paper)] group-hover:[--face:var(--ink)]">
          Abrir grupo
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
        {group.is_admin && <span className="text-graphite text-[15px]">Lo organizas tú</span>}
      </div>
    </Link>
  )
}

// Archived or hidden groups: a collapsed section of compact rows, closed by default. The
// browser remembers whether it was left open.
const PAST_OPEN = 'fantomio:past-open'

function PastGroups({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(PAST_OPEN) === '1')
    } catch {
      // Storage blocked: start closed.
    }
  }, [])
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(PAST_OPEN, o ? '0' : '1')
      } catch {
        // Nothing to remember.
      }
      return !o
    })
  }
  return (
    <section className="border-rule border-t pt-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="anteriores-lista"
        className="text-graphite hover:text-ink flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="text-ink text-xl font-light">Anteriores</span>
          <span className="ml-2 text-[15px]">· {groups.length}</span>
          <span className="mt-0.5 block text-sm">
            Grupos que ya terminaron o que ocultaste. Quedan como recuerdo.
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul id="anteriores-lista" className="divide-rule border-rule mt-4 divide-y border-y">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={groupPath(group.id)}
                className="hover:bg-slip flex items-center justify-between gap-4 px-2 py-3 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{group.name}</span>
                  <span className="text-graphite block text-sm">
                    {[
                      group.exchange_date && shortDate(group.exchange_date),
                      `${group.member_count} ${group.member_count === 1 ? 'persona' : 'personas'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="text-graphite border-rule shrink-0 rounded-full border px-2.5 py-1 text-sm leading-none">
                  {group.archived ? 'Archivado' : 'Oculto'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Groups from the last visit in this tab, shown instantly when coming back to the dashboard
// while the fresh list loads. ponytail: in memory only, a reload starts empty.
let lastGroups: { userId: string; groups: Group[] } | null = null

export default function DashboardPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [answering, setAnswering] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [modal, setModal] = useState<'join' | 'new' | null>(null)
  // Closing a form with something typed asks first; an empty one just closes.
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const closeModal = () => {
    setModal(null)
    setDirty(false)
    setConfirmClose(false)
  }

  // Old /groups/new links land here as ?new=1 (public/_redirects): open the create modal.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setModal('new')
      window.history.replaceState(null, '', '/dashboard')
    }
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const user = await getSessionUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser({ id: user.id, email: user.email || '' })
      if (lastGroups?.userId === user.id) {
        setGroups(lastGroups.groups)
        setIsLoading(false)
      }
      fetchGroups(user.id)
    }

    checkUser()
  }, [router])

  const fetchGroups = async (userId: string) => {
    const supabase = createClient()

    try {
      // Groups you're in, and invitations to new editions, in one round trip.
      const [{ data: memberGroups, error }, invitationsRes] = await Promise.all([
        supabase
          .from('members')
          .select(
            `
          group_id,
          is_admin,
          hidden_at,
          groups (
            id,
            name,
            budget,
            exchange_date,
            status,
            admin_id,
            archived_at,
            members (count)
          )
        `
          )
          .eq('user_id', userId),
        supabase.rpc('my_invitations'),
      ])
      setInvitations((invitationsRes.data ?? []) as Invitation[])

      if (error) throw error

      if (memberGroups) {
        const formattedGroups: Group[] = memberGroups
          .filter((mg) => mg.groups)
          .map((mg) => {
            const group = mg.groups as unknown as {
              id: string
              name: string
              budget: number | null
              exchange_date: string | null
              status: 'PLANNING' | 'DRAWN'
              admin_id: string
              archived_at: string | null
              members: Array<{ count: number }>
            }
            return {
              id: group.id,
              name: group.name,
              budget: group.budget,
              exchange_date: group.exchange_date,
              status: group.status,
              member_count: group.members[0]?.count ?? 0,
              is_admin: mg.is_admin as boolean,
              archived: !!group.archived_at,
              hidden: !!mg.hidden_at,
            }
          })

        setGroups(formattedGroups)
        lastGroups = { userId, groups: formattedGroups }
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
      // Show toast with friendly error message
      const friendlyError = getUserFriendlyError(error as { code?: string; message?: string })
      console.error(friendlyError)
    } finally {
      setIsLoading(false)
    }
  }

  const answer = async (groupId: string, accept: boolean) => {
    setAnswering(groupId)
    const { error } = await createClient().rpc('answer_invitation', {
      p_group_id: groupId,
      p_accept: accept,
    })
    setAnswering(null)
    if (error) {
      toast.error(getUserFriendlyError(error))
      if (user) fetchGroups(user.id)
      return
    }
    if (accept) {
      router.push(groupPath(groupId))
    } else {
      toast.success('Listo, avisamos que esta vez no participas')
      setInvitations((list) => list.filter((i) => i.group_id !== groupId))
    }
  }

  const active = groups.filter((g) => !g.archived && !g.hidden)
  const past = groups.filter((g) => g.archived || g.hidden)

  if (isLoading) {
    return (
      <div className="bg-paper min-h-[calc(100vh-69px)]">
        <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8">
          <DashboardSkeleton />
        </main>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
      <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8 md:py-14">
        <InstallApp />
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <h1 className="text-[34px] leading-tight font-light md:text-[44px]">Mis grupos</h1>
          <div className="flex w-full flex-wrap gap-3 pr-1.5 md:w-auto">
            <Button variant="outline" className="grow md:grow-0" onClick={() => setModal('join')}>
              <KeyRound aria-hidden="true" />
              Unirme con código
            </Button>
            <Button className="grow md:grow-0" onClick={() => setModal('new')}>
              <Plus aria-hidden="true" />
              Crear grupo
            </Button>
          </div>
        </div>

        {invitations.length > 0 && (
          <section aria-labelledby="invitaciones" className="mb-12">
            <h2 id="invitaciones" className="mb-5 text-2xl font-light">
              Te invitaron
            </h2>
            <ul className="grid gap-4">
              {invitations.map((inv) => (
                <li
                  key={inv.group_id}
                  className="border-ink flex flex-col gap-4 rounded-[4px] border p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-bold break-words">{inv.name}</p>
                    <p className="text-graphite text-[15px]">
                      {inv.organizer
                        ? `${inv.organizer} lo repitió con las mismas personas`
                        : 'Un amigo secreto con las mismas personas'}
                      {inv.exchange_date && ` · intercambio ${shortDate(inv.exchange_date)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      disabled={answering === inv.group_id}
                      onClick={() => answer(inv.group_id, true)}
                    >
                      <Check aria-hidden="true" />
                      Unirme
                    </Button>
                    <Button
                      variant="outline"
                      disabled={answering === inv.group_id}
                      onClick={() => answer(inv.group_id, false)}
                    >
                      Esta vez no
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {groups.length === 0 ? (
          <div className="border-rule bg-slip grid justify-items-center gap-4 rounded-[4px] border px-6 py-16 text-center">
            <GhostMark className="text-ink h-[64px] w-[56px]" />
            <h2 className="text-2xl">Todavía no tienes grupos</h2>
            <p className="text-graphite max-w-md">
              Crea uno y comparte el link, o entra a uno con el código que te mandaron.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => setModal('new')}>
                <Plus aria-hidden="true" />
                Crear mi primer grupo
              </Button>
              <Button variant="outline" onClick={() => setModal('join')}>
                <KeyRound aria-hidden="true" />
                Unirme con código
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {active.map((group) => (
                <li key={group.id}>
                  <GroupCard group={group} />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setModal('new')}
                  className="border-rule text-graphite hover:border-ink hover:text-ink bg-slip flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-[4px] border transition-colors"
                >
                  <Plus className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-[17px]">
                    {active.length ? 'Crear otro grupo' : 'Crear un grupo'}
                  </span>
                </button>
              </li>
            </ul>

            {past.length > 0 && <PastGroups groups={past} />}
          </div>
        )}
      </main>

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (open) return
          if (dirty) setConfirmClose(true)
          else closeModal()
        }}
      >
        {/* Creating a group gets more room on wide screens: fields side by side, two mode cards. */}
        <DialogContent className={`${sheet} ${modal === 'new' ? 'md:max-w-[720px]' : ''}`}>
          <DialogHeader className="border-rule shrink-0 border-b px-6 pt-6 pr-16 pb-4 text-left">
            <DialogTitle className="text-[28px] leading-tight font-light">
              {modal === 'join' ? 'Unirme a un grupo' : 'Crear grupo'}
            </DialogTitle>
            <DialogDescription className="text-[16px]">
              {modal === 'join'
                ? 'Pega el código o el link que te mandaron.'
                : 'Solo el nombre es obligatorio.'}
            </DialogDescription>
          </DialogHeader>
          {modal === 'join' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <JoinGroupForm onDirtyChange={setDirty} />
            </div>
          ) : (
            <NewGroupForm onDirtyChange={setDirty} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {modal === 'join' ? '¿Dejar el código sin usar?' : '¿Descartar el grupo?'}
            </AlertDialogTitle>
            <AlertDialogDescription>Lo que escribiste no se va a guardar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir escribiendo</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={closeModal}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
