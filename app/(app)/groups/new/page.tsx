'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { BackLink } from '@/components/back-link'
import { NewGroupForm } from '@/components/new-group-form'
import { getSessionUser } from '@/lib/supabase'

export default function NewGroupPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getSessionUser().then((user) => (user ? setReady(true) : router.push('/login')))
  }, [router])

  if (!ready) {
    return (
      <div className="bg-paper flex min-h-[calc(100vh-69px)] items-center justify-center">
        <Loader2 className="text-faint h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
      <main className="mx-auto max-w-[560px] px-4 pt-8 pb-10 md:pb-16">
        <BackLink />
        <h1 className="mt-6 mb-2 text-[34px] leading-tight font-light min-[1440px]:mt-0 md:text-[40px]">
          Crear grupo
        </h1>
        <p className="text-graphite mb-8">
          Solo el nombre es obligatorio. Lo demás lo puedes cambiar después.
        </p>
        <NewGroupForm />
      </main>
    </div>
  )
}
