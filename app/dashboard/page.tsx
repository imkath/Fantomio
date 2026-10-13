'use client'

import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { GhostMark } from '@/components/ghost-mark'
import { ArrowRight, KeyRound, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function DashboardPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const user = await getSessionUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser({ id: user.id, email: user.email || '' })
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
      <div className="bg-paper min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8">
          <DashboardSkeleton />
        </main>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8 md:py-14">
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <h1 className="text-[34px] leading-tight font-light md:text-[44px]">Mis grupos</h1>
          <div className="flex w-full gap-3 md:w-auto">
            <Button asChild variant="outline" className="flex-1 md:flex-initial">
              <Link href="/join">
                <KeyRound aria-hidden="true" />
                Unirme con código
              </Link>
            </Button>
            <Button asChild className="flex-1 md:flex-initial">
              <Link href="/groups/new">
                <Plus aria-hidden="true" />
                Crear grupo
              </Link>
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
              <Button asChild>
                <Link href="/groups/new">Crear mi primer grupo</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/join">Unirme con código</Link>
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
                  <ul className="text-graphite grid gap-1 text-base">
                    <li>
                      {group.member_count} {group.member_count === 1 ? 'persona' : 'personas'}
                    </li>
                    {group.exchange_date && (
                      <li>
                        Intercambio el{' '}
                        {parseLocalDate(group.exchange_date).toLocaleDateString('es-CL', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </li>
                    )}
                    {group.budget != null && (
                      <li>Presupuesto de ${group.budget.toLocaleString('es-CL')}</li>
                    )}
                  </ul>
                  <div className="mt-auto flex items-center justify-between pt-6">
                    {/* The whole card is the link; this only looks like a button. */}
                    <span className="border-ink text-ink group-hover:bg-ink group-hover:text-paper inline-flex h-10 items-center gap-2 rounded-[2px] border-[1.5px] px-3.5 text-[15px] font-medium transition-colors">
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
              <Link
                href="/groups/new"
                className="border-rule text-graphite hover:border-ink hover:text-ink bg-slip flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-[4px] border transition-colors"
              >
                <Plus className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                <span className="text-[17px]">Crear otro grupo</span>
              </Link>
            </li>
          </ul>
        )}
      </main>
    </div>
  )
}
