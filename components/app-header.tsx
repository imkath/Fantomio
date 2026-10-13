'use client'

import { GhostAvatar } from '@/components/ghost-avatar'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase'
import { Logo } from '@/components/logo'
import { formatName } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

export function AppHeader() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const getUser = async () => {
      const authUser = await getSessionUser()
      if (!authUser) return
      const fallbackName = formatName(authUser.user_metadata?.name) || authUser.email?.split('@')[0]
      // Show what the session already knows right away, then refine with the profile row.
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: fallbackName,
        avatar_url: authUser.user_metadata?.avatar_url,
      })
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', authUser.id)
        .single()
      if (profile) {
        setUser(
          (u) =>
            u && {
              ...u,
              name: formatName(profile.full_name) || u.name,
              avatar_url: profile.avatar_url || u.avatar_url,
            }
        )
      }
    }

    getUser()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!user) return null

  return (
    <header className="border-rule bg-paper/90 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-[68px] max-w-[1040px] items-center justify-between gap-4 px-4 md:px-8">
        <Link
          href="/dashboard"
          aria-label="Mis grupos"
          className="transition-opacity hover:opacity-80"
        >
          <Logo linkToHome={false} />
        </Link>

        <div className="flex items-center gap-3 md:gap-5">
          <span className="text-graphite hidden text-[15px] md:block">{user.name}</span>
          <GhostAvatar seed={user.id} src={user.avatar_url} size={36} />
          <ThemeToggle compact />
          <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut aria-hidden="true" />
            <span className="sr-only md:not-sr-only">Salir</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
