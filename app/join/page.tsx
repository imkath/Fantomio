'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/auth-shell'
import { AppHeader } from '@/components/app-header'
import { Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatLocalDate } from '@/lib/utils'

interface GroupPreview {
  id: string
  name: string
  exchange_date: string | null
  member_count: number
}

// Extract valid invite code (12 hex chars) from text that might contain extra content
const extractInviteCode = (input: string): string => {
  // First try to find a 12-char hex string in the input
  const hexMatch = input.match(/[0-9a-f]{12}/i)
  if (hexMatch) {
    return hexMatch[0].toLowerCase()
  }
  // If no valid code found, return the trimmed input (will fail validation later)
  return input.trim()
}

function JoinGroupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null)
  const [joined, setJoined] = useState(false)

  const autoJoinGroup = useCallback(
    async (code: string, userId: string) => {
      setIsLoading(true)
      const supabase = createClient()

      try {
        // Find group by invite code
        const { data: groupData } = await supabase.rpc('get_group_by_invite_code', { code })

        if (!groupData || groupData.length === 0) {
          setIsLoading(false)
          return // Invalid code, let user try manually
        }

        const group = groupData[0]

        // Check if already a member
        const { data: existingMember } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', group.id)
          .eq('user_id', userId)
          .single()

        if (existingMember) {
          // Already a member, redirect to group
          router.push(`/groups/${group.id}`)
          return
        }

        // Check if group is already drawn
        if (group.status === 'DRAWN') {
          setError('Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.')
          setIsLoading(false)
          return
        }

        // Add user as member
        const { error: joinError } = await supabase.from('members').insert({
          group_id: group.id,
          user_id: userId,
          is_admin: false,
        })

        if (joinError) {
          setError(joinError.message)
          setIsLoading(false)
          return
        }

        // Get user profile for activity message
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single()

        // Log activity
        await supabase.from('activities').insert({
          group_id: group.id,
          user_id: userId,
          type: 'USER_JOINED',
          message: `${profile?.full_name || 'Alguien'} se unió al grupo`,
        })

        setJoined(true)
        setTimeout(() => {
          router.push(`/groups/${group.id}`)
        }, 1500)
      } catch {
        setIsLoading(false)
      }
    },
    [router]
  )

  const fetchGroupPreview = useCallback(async (code: string) => {
    const supabase = createClient()

    const { data, error } = await supabase.rpc('get_group_by_invite_code', { code })

    if (!error && data && data.length > 0) {
      setGroupPreview({
        id: data[0].id,
        name: data[0].name,
        exchange_date: data[0].exchange_date,
        member_count: data[0].member_count,
      })
    }
  }, [])

  useEffect(() => {
    const rawCode = searchParams.get('code')
    const code = rawCode ? extractInviteCode(rawCode) : null

    if (code) {
      setInviteCode(code)
      // Auto-fetch group preview
      fetchGroupPreview(code)
    }

    const checkAuthAndAutoJoin = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        const redirectUrl = code ? `/join?code=${code}` : '/join'
        router.push(`/login?redirectTo=${encodeURIComponent(redirectUrl)}`)
        return
      }
      setIsCheckingAuth(false)

      // Auto-join if coming with a code (e.g., from invite link after login)
      if (code) {
        autoJoinGroup(code, user.id)
      }
    }
    checkAuthAndAutoJoin()
  }, [searchParams, router, autoJoinGroup, fetchGroupPreview])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (!inviteCode) {
      setError('Escribe el código que te mandaron.')
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Find group by invite code
      const { data: groupData } = await supabase.rpc('get_group_by_invite_code', {
        code: inviteCode,
      })

      if (!groupData || groupData.length === 0) {
        setError('No encontramos un grupo con ese código. Revisa que esté completo.')
        setIsLoading(false)
        return
      }

      const group = groupData[0]

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        // Already a member, redirect to group
        router.push(`/groups/${group.id}`)
        return
      }

      // Check if group is already drawn
      if (group.status === 'DRAWN') {
        setError('Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.')
        setIsLoading(false)
        return
      }

      // Add user as member
      const { error: joinError } = await supabase.from('members').insert({
        group_id: group.id,
        user_id: user.id,
        is_admin: false,
      })

      if (joinError) {
        setError(joinError.message)
        setIsLoading(false)
        return
      }

      // Get user profile for activity message
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Log activity
      await supabase.from('activities').insert({
        group_id: group.id,
        user_id: user.id,
        type: 'USER_JOINED',
        message: `${profile?.full_name || 'Alguien'} se unió al grupo`,
      })

      setJoined(true)
      setTimeout(() => {
        router.push(`/groups/${group.id}`)
      }, 1500)
    } catch {
      setError('No pudimos conectar. Revisa tu internet e intenta de nuevo.')
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <Loader2 className="text-faint h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-[520px] px-4 py-10 md:py-16">
        <Link
          href="/dashboard"
          className="text-graphite hover:text-ink text-[15px] underline underline-offset-4"
        >
          Volver a mis grupos
        </Link>

        {joined ? (
          <div className="mt-8" role="status">
            <h1 className="mb-2 text-[34px] leading-tight font-light">Ya estás adentro</h1>
            <p className="text-graphite">Te llevamos al grupo…</p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 mb-2 text-[34px] leading-tight font-light md:text-[40px]">
              Unirme a un grupo
            </h1>
            <p className="text-graphite mb-8">
              Pega el código o el link que te mandó quien organiza.
            </p>

            {groupPreview && (
              <div className="border-rule bg-slip mb-6 rounded-[4px] border px-5 py-4">
                <p className="text-lg font-bold">{groupPreview.name}</p>
                <p className="text-graphite mt-1 font-mono text-sm">
                  {groupPreview.member_count}{' '}
                  {groupPreview.member_count === 1 ? 'persona' : 'personas'}
                  {groupPreview.exchange_date &&
                    ` · intercambio ${formatLocalDate(groupPreview.exchange_date)}`}
                </p>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-5">
              {error && <Notice>{error}</Notice>}
              <div className="grid gap-1.5">
                <label htmlFor="invite-code" className="text-[15px] font-medium">
                  Código de invitación
                </label>
                <Input
                  id="invite-code"
                  placeholder="a1b2c3d4e5f6"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono tracking-wider"
                  value={inviteCode}
                  onChange={(e) => {
                    const value = e.target.value
                    // Extract valid code if user pastes text with extra content
                    const cleanCode = value.length > 12 ? extractInviteCode(value) : value
                    setInviteCode(cleanCode)
                    if (cleanCode.length >= 12) {
                      fetchGroupPreview(cleanCode)
                    } else {
                      setGroupPreview(null)
                    }
                  }}
                  required
                />
                <p className="text-faint text-sm">Son 12 letras y números.</p>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unirme'}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

export default function JoinGroupPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper flex min-h-screen items-center justify-center">
          <Loader2 className="text-faint h-8 w-8 animate-spin" />
        </div>
      }
    >
      <JoinGroupContent />
    </Suspense>
  )
}
