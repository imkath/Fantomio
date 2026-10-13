'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Logo } from '@/components/logo'
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
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (authUser) {
        // Get profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', authUser.id)
          .single()

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url,
        })
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
          <Avatar className="border-rule h-9 w-9 border">
            <AvatarImage src={user.avatar_url || '/placeholder.svg'} alt="" />
            <AvatarFallback className="bg-slip text-ink text-sm font-bold">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <ThemeToggle compact />
          <button
            type="button"
            onClick={handleSignOut}
            className="text-graphite hover:text-ink min-h-11 text-[15px] underline underline-offset-4"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
