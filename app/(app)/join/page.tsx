'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BackLink } from '@/components/back-link'
import { JoinGroupForm, extractInviteCode } from '@/components/join-group-form'
import { getSessionUser } from '@/lib/supabase'

// Invite links land here. With a code in the link it joins right away; the dashboard opens
// the same form in a modal instead.
function JoinGroupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCode = searchParams.get('code')
  const code = rawCode ? extractInviteCode(rawCode) : ''
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getSessionUser().then((user) => {
      if (!user) {
        const back = code ? `/join?code=${code}` : '/join'
        router.push(`/login?redirectTo=${encodeURIComponent(back)}`)
        return
      }
      setReady(true)
    })
  }, [code, router])

  if (!ready) return <JoinLoading />

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
      <main className="mx-auto max-w-[520px] px-4 pt-8 pb-10 md:pb-16">
        <BackLink />
        <h1 className="mt-6 mb-2 text-[34px] leading-tight font-light min-[1440px]:mt-0 md:text-[40px]">
          Unirme a un grupo
        </h1>
        <p className="text-graphite mb-8">Pega el código o el link que te mandó quien organiza.</p>
        <JoinGroupForm initialCode={code} autoJoin={!!code} />
      </main>
    </div>
  )
}

// What ships in the static HTML while the query and the session are read: the heading is
// already there, only the form waits.
function JoinLoading() {
  return (
    <main className="mx-auto max-w-[520px] px-4 pt-8 pb-10 md:pb-16">
      <h1 className="mt-6 mb-2 text-[34px] leading-tight font-light min-[1440px]:mt-0 md:text-[40px]">
        Unirme a un grupo
      </h1>
      <Loader2 className="text-faint mt-6 h-8 w-8 animate-spin" aria-label="Cargando" />
    </main>
  )
}

export default function JoinGroupPage() {
  return (
    <Suspense fallback={<JoinLoading />}>
      <JoinGroupContent />
    </Suspense>
  )
}
