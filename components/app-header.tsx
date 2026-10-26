'use client'

import { GhostAvatar } from '@/components/ghost-avatar'
import { ChevronDown, LayoutList, LogOut, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase'
import { Logo } from '@/components/logo'
import { formatName } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/notification-bell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

// The account page fires this after changing the name or the photo, so the header follows.
export const PROFILE_UPDATED = 'ghostswap:profile-updated'
const THEME_APPLIED = 'ghostswap:theme-applied'

export function AppHeader() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const getUser = async () => {
      const authUser = await getSessionUser()
      if (!authUser) return
      const fallbackName = formatName(authUser.user_metadata?.name) || authUser.email?.split('@')[0]
      // Show what the session already knows right away, then refine with the profile row.
      setUser((u) =>
        u
          ? { ...u, email: authUser.email || u.email }
          : {
              id: authUser.id,
              email: authUser.email || '',
              name: fallbackName,
              avatar_url: authUser.user_metadata?.avatar_url,
            }
      )
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, theme')
        .eq('id', authUser.id)
        .single()
      if (profile) {
        setUser(
          (u) =>
            u && {
              ...u,
              name: formatName(profile.full_name) || u.name,
              // null means "no photo" (the ghost), not "unknown".
              avatar_url: profile.avatar_url ?? undefined,
            }
        )
        // The account's default theme applies once per visit; the sun/moon switch then
        // changes it for this device only.
        try {
          if (!sessionStorage.getItem(THEME_APPLIED)) {
            sessionStorage.setItem(THEME_APPLIED, '1')
            setTheme(profile.theme)
          }
        } catch {
          // Storage blocked: keep whatever this device already uses.
        }
      }
    }

    getUser()
    window.addEventListener(PROFILE_UPDATED, getUser)
    return () => window.removeEventListener(PROFILE_UPDATED, getUser)
  }, [setTheme])

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="border-rule bg-paper/90 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-[68px] max-w-[1040px] items-center justify-between gap-4 px-4 md:px-8">
        <Logo />

        <div className="flex items-center gap-3 md:gap-5">
          {/* Drawn right away; the user's parts fill in once the session is read. */}
          {user ? (
            <>
              <NotificationBell userId={user.id} />
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="hover:bg-slip flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors md:pl-3"
                  aria-label="Tu cuenta"
                >
                  <span className="text-graphite hidden max-w-[16ch] truncate text-[15px] md:block">
                    {user.name}
                  </span>
                  <GhostAvatar seed={user.id} src={user.avatar_url} size={36} />
                  <ChevronDown className="text-graphite size-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate font-bold">{user.name}</span>
                    <span className="text-graphite block truncate text-sm">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutList aria-hidden="true" />
                      Mis grupos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <UserRound aria-hidden="true" />
                      Mi cuenta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSignOut}>
                    <LogOut aria-hidden="true" />
                    Salir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <ThemeToggle />
              <span className="bg-slip size-9 rounded-full" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
