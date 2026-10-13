'use client'

import { groupPath } from '@/lib/routes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/auth-shell'
import { createClient, getSessionUser } from '@/lib/supabase'
import { formatLocalDate } from '@/lib/utils'

// Join by invite code. Used by the /join page (invite links land there, and it joins right
// away when the link carries a code) and by the "Unirme con código" modal in the dashboard.

interface GroupPreview {
  id: string
  name: string
  exchange_date: string | null
  member_count: number
}

// Pull a valid invite code (12 hex chars) out of whatever was pasted, link included.
export function extractInviteCode(input: string): string {
  const hexMatch = input.match(/[0-9a-f]{12}/i)
  return hexMatch ? hexMatch[0].toLowerCase() : input.trim()
}

export function JoinGroupForm({
  initialCode = '',
  autoJoin = false,
  onDirtyChange,
}: {
  initialCode?: string
  autoJoin?: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState(initialCode)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<GroupPreview | null>(null)
  const [joined, setJoined] = useState(false)
  const autoTried = useRef(false)

  const dirty = inviteCode.trim() !== '' && inviteCode !== initialCode
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const fetchPreview = useCallback(async (code: string) => {
    const { data, error } = await createClient().rpc('get_group_by_invite_code', { code })
    setPreview(!error && data?.length ? data[0] : null)
  }, [])

  // `quiet`: an automatic attempt from an invite link fails silently and leaves the form.
  const join = useCallback(
    async (code: string, quiet = false) => {
      setIsLoading(true)
      setError('')
      const fail = (message: string) => {
        if (!quiet) setError(message)
        setIsLoading(false)
      }
      try {
        const supabase = createClient()
        const user = await getSessionUser()
        if (!user) {
          router.push(`/login?redirectTo=${encodeURIComponent(`/join?code=${code}`)}`)
          return
        }

        const { data: groups } = await supabase.rpc('get_group_by_invite_code', { code })
        const group = groups?.[0]
        if (!group) return fail('No encontramos un grupo con ese código. Revisa que esté completo.')

        const { data: existing } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', group.id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (existing) {
          router.push(groupPath(group.id))
          return
        }
        if (group.status === 'DRAWN') {
          // Shown even on the automatic attempt: it's the answer to the link they opened.
          setError('Este grupo ya hizo el sorteo, así que no se pueden sumar personas nuevas.')
          setIsLoading(false)
          return
        }

        const { error: joinError } = await supabase
          .from('members')
          .insert({ group_id: group.id, user_id: user.id, is_admin: false })
        if (joinError) return fail(joinError.message)

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
        await supabase.from('activities').insert({
          group_id: group.id,
          user_id: user.id,
          type: 'USER_JOINED',
          message: `${profile?.full_name || 'Alguien'} se unió al grupo`,
        })

        setJoined(true)
        setTimeout(() => router.push(groupPath(group.id)), 1200)
      } catch {
        fail('No pudimos conectar. Revisa tu internet e intenta de nuevo.')
      }
    },
    [router]
  )

  useEffect(() => {
    if (!initialCode) return
    fetchPreview(initialCode)
    if (autoJoin && !autoTried.current) {
      autoTried.current = true
      join(initialCode, true)
    }
  }, [initialCode, autoJoin, fetchPreview, join])

  if (joined) {
    return (
      <div role="status">
        <p className="text-2xl font-light">Ya estás adentro</p>
        <p className="text-graphite">Te llevamos al grupo…</p>
      </div>
    )
  }

  return (
    <div>
      {preview && (
        <div className="border-rule bg-slip mb-6 rounded-[4px] border px-5 py-4">
          <p className="text-lg font-bold">{preview.name}</p>
          <p className="text-graphite mt-1 text-[15px]">
            {preview.member_count} {preview.member_count === 1 ? 'persona' : 'personas'}
            {preview.exchange_date && ` · intercambio ${formatLocalDate(preview.exchange_date)}`}
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!inviteCode) return setError('Escribe el código que te mandaron.')
          join(inviteCode)
        }}
        className="space-y-5"
      >
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
            className="font-detail tracking-wider"
            value={inviteCode}
            onChange={(e) => {
              const value = e.target.value
              const clean = value.length > 12 ? extractInviteCode(value) : value
              setInviteCode(clean)
              if (clean.length >= 12) fetchPreview(clean)
              else setPreview(null)
            }}
            required
          />
          <p className="text-graphite text-sm">
            Son 12 letras y números. También puedes pegar el link.
          </p>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              Unirme
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
