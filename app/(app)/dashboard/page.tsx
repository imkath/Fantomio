'use client'

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
import { JoinGroupForm } from '@/components/join-group-form'
import { NewGroupForm } from '@/components/new-group-form'

// On phones the modal takes the whole screen, like its own view; on wider screens it's a dialog.
const sheet =
  'max-h-[100dvh] overflow-y-auto sm:max-w-[520px] max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:content-start max-sm:rounded-none max-sm:border-0 max-sm:p-6 max-sm:pt-14'
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
}

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

// Groups from the last visit in this tab, shown instantly when coming back to the dashboard
// while the fresh list loads. ponytail: in memory only, a reload starts empty.
let lastGroups: { userId: string; groups: Group[] } | null = null

export default function DashboardPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
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
      // Get groups where user is a member
      const { data: memberGroups, error } = await supabase
        .from('members')
        .select(
          `
          group_id,
          is_admin,
          groups (
            id,
            name,
            budget,
            exchange_date,
            status,
            admin_id,
            members (count)
          )
        `
        )
        .eq('user_id', userId)

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
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <h1 className="text-[34px] leading-tight font-light md:text-[44px]">Mis grupos</h1>
          <div className="flex w-full gap-3 md:w-auto">
            <Button
              variant="outline"
              className="flex-1 md:flex-initial"
              onClick={() => setModal('join')}
            >
              <KeyRound aria-hidden="true" />
              Unirme con código
            </Button>
            <Button className="flex-1 md:flex-initial" onClick={() => setModal('new')}>
              <Plus aria-hidden="true" />
              Crear grupo
            </Button>
          </div>
        </div>

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
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="border-rule bg-raised hover:border-ink group relative flex h-full flex-col rounded-[4px] border p-6 pt-8 transition-colors"
                >
                  <h2 className="mb-5 text-xl leading-snug font-bold break-words">{group.name}</h2>
                  {/* Sits on the card's top edge so the title gets the full width. */}
                  <span
                    className={`absolute -top-3.5 left-5 rounded-full px-3 py-1.5 text-[15px] leading-none font-medium ${
                      group.status === 'DRAWN'
                        ? 'bg-ink text-paper'
                        : 'border-rule bg-paper text-graphite border'
                    }`}
                  >
                    {group.status === 'DRAWN' ? 'Sorteado' : 'Sin sortear'}
                  </span>
                  <ul className="grid gap-2.5 text-[17px]">
                    <Meta icon={Users} label="Personas">
                      {group.member_count} {group.member_count === 1 ? 'persona' : 'personas'}
                    </Meta>
                    {group.exchange_date && (
                      <Meta icon={CalendarDays} label="Intercambio">
                        {parseLocalDate(group.exchange_date)
                          .toLocaleDateString('es-CL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                          .replace('.', '')}
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
                    <span className="btn-paper text-ink group-hover:text-paper inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[15px] font-medium transition-colors [--edge:var(--ink)] [--face:var(--paper)] [--slip-dir:-1] [--slip-x:-3px] group-hover:[--face:var(--ink)]">
                      Abrir grupo
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {group.is_admin && (
                      <span className="text-graphite text-[15px]">Lo organizas tú</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setModal('new')}
                className="border-rule text-graphite hover:border-ink hover:text-ink bg-slip flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-[4px] border transition-colors"
              >
                <Plus className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-[17px]">Crear otro grupo</span>
              </button>
            </li>
          </ul>
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
        <DialogContent className={sheet}>
          <DialogHeader>
            <DialogTitle className="text-[30px] leading-tight font-light">
              {modal === 'join' ? 'Unirme a un grupo' : 'Crear grupo'}
            </DialogTitle>
            <DialogDescription className="text-[17px]">
              {modal === 'join'
                ? 'Pega el código o el link que te mandó quien organiza.'
                : 'Solo el nombre es obligatorio. Lo demás lo puedes cambiar después.'}
            </DialogDescription>
          </DialogHeader>
          {modal === 'join' ? (
            <JoinGroupForm onDirtyChange={setDirty} />
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
            <AlertDialogDescription>
              Lo que escribiste no se va a guardar.
            </AlertDialogDescription>
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
