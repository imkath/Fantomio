'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ProfileSection } from '@/components/account/profile-section'
import { AccessSection, type AccessState } from '@/components/account/access-section'
import { PreferencesSection } from '@/components/account/preferences-section'
import { DataSection } from '@/components/account/data-section'
import { createClient } from '@/lib/supabase'
import { formatName } from '@/lib/utils'

// Everything about your account in one page: profile, how you sign in, preferences and your
// data. The rules live in the database (see 20261026h_account_settings.sql); this page only
// shows them and calls them.

interface Account extends AccessState {
  userId: string
  name: string
  avatarUrl: string | null
  googleAvatar: string | null
  theme: 'system' | 'light' | 'dark'
  emailNotifications: boolean
  drawnGroups: string[]
}

const SECTIONS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'acceso', label: 'Acceso' },
  { id: 'preferencias', label: 'Preferencias' },
  { id: 'datos', label: 'Seguridad y datos' },
]

function AccountPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [account, setAccount] = useState<Account | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    // getUser asks the auth server, so changes confirmed elsewhere show up here.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?redirectTo=/account')
      return
    }
    const [profileRes, statusRes, groupsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, avatar_url, theme, email_notifications')
        .eq('id', user.id)
        .single(),
      supabase.rpc('account_status'),
      supabase.from('members').select('groups(name, status)').eq('user_id', user.id),
    ])
    const google = user.identities?.find((i) => i.provider === 'google')
    const status = (statusRes.data ?? { has_password: false, providers: [] }) as {
      has_password: boolean
      providers: string[]
    }
    const drawn = (groupsRes.data ?? [])
      .map(
        (m) =>
          (Array.isArray(m.groups) ? m.groups[0] : m.groups) as {
            name: string
            status: string
          } | null
      )
      .filter((g): g is { name: string; status: string } => !!g && g.status === 'DRAWN')
      .map((g) => g.name)
    setAccount({
      userId: user.id,
      email: user.email ?? '',
      pendingEmail: user.new_email ?? null,
      hasPassword: status.has_password,
      providers: status.providers,
      googleEmail: (google?.identity_data?.email as string) ?? null,
      googleAvatar:
        ((google?.identity_data?.avatar_url ?? google?.identity_data?.picture) as string) ?? null,
      name: formatName(profileRes.data?.full_name) || '',
      avatarUrl: profileRes.data?.avatar_url ?? null,
      theme: profileRes.data?.theme ?? 'system',
      emailNotifications: profileRes.data?.email_notifications ?? true,
      drawnGroups: drawn,
    })
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  // The side index marks the section you're reading: the last one whose top has passed a
  // line a third of the way down the screen, or the last section once you hit the bottom.
  const [active, setActive] = useState(SECTIONS[0].id)
  const loaded = !!account
  useEffect(() => {
    if (!loaded) return
    const update = () => {
      const line = window.innerHeight / 3
      let current = SECTIONS[0].id
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      setActive(atBottom ? SECTIONS[SECTIONS.length - 1].id : current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [loaded])

  return (
    <div className="bg-paper text-ink min-h-[calc(100vh-69px)]">
      <main className="mx-auto max-w-[1040px] px-4 pt-8 pb-16 md:px-8">
        <Breadcrumbs
          items={[{ label: 'Mis grupos', href: '/dashboard' }, { label: 'Mi cuenta' }]}
        />
        <h1 className="mt-6 mb-10 text-[34px] leading-tight font-light md:text-[44px]">
          Mi cuenta
        </h1>

        {!account ? (
          <Loader2 className="text-faint h-8 w-8 animate-spin" aria-label="Cargando" />
        ) : (
          <div className="grid gap-10 md:grid-cols-[180px_minmax(0,1fr)]">
            <nav aria-label="Secciones de la cuenta" className="hidden md:block">
              <ul className="sticky top-24 space-y-1 text-[15px]">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={active === s.id ? 'location' : undefined}
                      className={`hover:text-ink inline-flex min-h-11 items-center underline-offset-4 transition-colors hover:underline ${
                        active === s.id ? 'text-ink font-bold' : 'text-graphite'
                      }`}
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-w-0 space-y-8">
              <ProfileSection
                key={`${account.name}-${account.avatarUrl}`}
                userId={account.userId}
                name={account.name}
                avatarUrl={account.avatarUrl}
                googleAvatar={account.googleAvatar}
                onChange={load}
              />
              <AccessSection
                state={account}
                status={params.get('correo') ?? params.get('google')}
                onChange={load}
              />
              <PreferencesSection
                userId={account.userId}
                theme={account.theme}
                emailNotifications={account.emailNotifications}
              />
              <DataSection
                userId={account.userId}
                email={account.email}
                drawnGroups={account.drawnGroups}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function AccountRoute() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  )
}
