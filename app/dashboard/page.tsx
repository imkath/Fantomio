'use client'

import { AppHeader } from '@/components/app-header'
import { Button } from '@/components/ui/button'
import { GhostMark } from '@/components/ghost-mark'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { DashboardSkeleton } from '@/components/skeletons'
import { getUserFriendlyError } from '@/lib/errors'
import { formatLocalDate } from '@/lib/utils'

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
    const supabase = createClient()

    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
            admin_id
          )
        `
        )
        .eq('user_id', userId)

      if (error) throw error

      if (memberGroups) {
        // Get member counts for each group
        const groupIds = memberGroups.map((mg) => mg.group_id)

        const { data: counts } = await supabase
          .from('members')
          .select('group_id')
          .in('group_id', groupIds)

        const countMap: Record<string, number> = {}
        counts?.forEach((c) => {
          countMap[c.group_id] = (countMap[c.group_id] || 0) + 1
        })

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
            }
            return {
              id: group.id,
              name: group.name,
              budget: group.budget,
              exchange_date: group.exchange_date,
              status: group.status,
              member_count: countMap[mg.group_id] || 0,
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
          <div>
            <p className="text-graphite mb-2 font-mono text-sm tracking-[0.12em] uppercase">
              Tus grupos
            </p>
            <h1 className="text-[34px] leading-tight font-light md:text-[44px]">Mis grupos</h1>
          </div>
          <div className="flex w-full gap-3 md:w-auto">
            <Button asChild variant="outline" className="flex-1 md:flex-initial">
              <Link href="/join">Unirme con código</Link>
            </Button>
            <Button asChild className="flex-1 md:flex-initial">
              <Link href="/groups/new">Crear grupo</Link>
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
                  className="border-rule bg-raised hover:border-ink group flex h-full flex-col rounded-[4px] border p-6 transition-colors"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-xl leading-snug font-bold break-words">
                      {group.name}
                    </h2>
                    <span
                      className={`shrink-0 rounded-[2px] border px-2 py-0.5 font-mono text-xs ${
                        group.status === 'DRAWN'
                          ? 'border-ink text-ink'
                          : 'border-rule text-graphite'
                      }`}
                    >
                      {group.status === 'DRAWN' ? 'sorteado' : 'sin sortear'}
                    </span>
                  </div>
                  <dl className="text-graphite grid gap-1.5 font-mono text-sm">
                    <div className="flex gap-2">
                      <dt className="sr-only">Personas</dt>
                      <dd>
                        {group.member_count} {group.member_count === 1 ? 'persona' : 'personas'}
                      </dd>
                    </div>
                    {group.exchange_date && (
                      <div className="flex gap-2">
                        <dt>intercambio</dt>
                        <dd>{formatLocalDate(group.exchange_date)}</dd>
                      </div>
                    )}
                    {group.budget != null && (
                      <div className="flex gap-2">
                        <dt>presupuesto</dt>
                        <dd>${group.budget.toLocaleString('es-CL')}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-auto flex items-center justify-between pt-6">
                    <span className="text-ink text-[15px] underline underline-offset-4">
                      Abrir grupo
                    </span>
                    {group.is_admin && (
                      <span className="text-faint font-mono text-xs">lo administras</span>
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
                <span className="text-3xl leading-none font-light" aria-hidden="true">
                  +
                </span>
                <span className="text-[17px]">Crear otro grupo</span>
              </Link>
            </li>
          </ul>
        )}
      </main>
    </div>
  )
}
