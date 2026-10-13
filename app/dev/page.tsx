'use client'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

// Dev-only index of every screen, so the redesign can be reviewed locally. 404 in production.
const SCREENS: Array<{ section: string; items: Array<[string, string, string?]> }> = [
  {
    section: 'Afuera',
    items: [
      ['/', 'Landing'],
      ['/privacy', 'Política de privacidad'],
      ['/terms', 'Términos'],
      ['/no-existe', 'Página 404'],
    ],
  },
  {
    section: 'Acceso',
    items: [
      ['/login?preview', 'Entrar'],
      ['/login?preview&verified=true', 'Entrar, con cuenta recién confirmada'],
      ['/login?preview&error=Ejemplo de error', 'Entrar, con un error'],
      ['/register?preview', 'Crear cuenta'],
      ['/forgot-password', 'Recuperar contraseña'],
      ['/reset-password', 'Contraseña nueva', 'necesita sesión abierta'],
    ],
  },
  {
    section: 'Adentro',
    items: [
      ['/dashboard', 'Mis grupos'],
      ['/groups/new', 'Crear grupo'],
      ['/join', 'Unirme con código'],
      ['/join?code=000000000000', 'Unirme, con un código que no existe'],
    ],
  },
]

interface GroupRow {
  group_id: string
  is_admin: boolean
  groups: { name: string; status: string } | null
}

export default function DevScreens() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [groups, setGroups] = useState<GroupRow[] | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setSignedIn(!!user)
      if (!user) return
      const { data } = await supabase
        .from('members')
        .select('group_id, is_admin, groups (name, status)')
        .eq('user_id', user.id)
      setGroups((data as unknown as GroupRow[]) ?? [])
    })
  }, [])

  return (
    <div className="bg-paper text-ink mx-auto min-h-screen max-w-[1040px] px-4 pb-20 md:px-8">
      <header className="flex items-center justify-between py-[22px]">
        <Logo />
        <ThemeToggle />
      </header>

      <h1 className="mt-6 mb-2 text-[34px] font-light md:text-[44px]">Todas las pantallas</h1>
      <p className="text-graphite mb-6 max-w-[60ch]">
        Solo existe en local. Cada link abre la pantalla real; el botón de tema cambia claro y
        oscuro en todas.
      </p>

      <div className="border-destructive text-destructive mb-10 max-w-[70ch] rounded-[2px] border px-4 py-3 text-[15px]">
        Ojo: en local la app usa la misma base de datos que ghostswap.nvrkth.com. Sortear,
        reiniciar, quitar personas o eliminar un grupo pasa de verdad. Para probar eso, crea un
        grupo de prueba y bórralo al terminar.
      </div>

      {signedIn === false && (
        <p className="mb-10">
          No tienes sesión en localhost.{' '}
          <Link href="/login" className="underline underline-offset-4">
            Entra con Google
          </Link>{' '}
          para ver lo de adentro.
        </p>
      )}

      <div className="grid gap-10 md:grid-cols-2">
        {SCREENS.map(({ section, items }) => (
          <section key={section}>
            <h2 className="text-graphite mb-3 font-mono text-sm tracking-[0.12em] uppercase">
              {section}
            </h2>
            <ul className="divide-rule border-rule divide-y border-y">
              {items.map(([href, label, note]) => (
                <li key={href} className="flex items-baseline justify-between gap-4 py-2.5">
                  <Link href={href} className="underline underline-offset-4">
                    {label}
                  </Link>
                  <span className="text-faint truncate font-mono text-xs">{note ?? href}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h2 className="text-graphite mb-3 font-mono text-sm tracking-[0.12em] uppercase">
            Tus grupos
          </h2>
          {groups === null ? (
            <p className="text-faint font-mono text-sm">
              {signedIn === false ? 'sin sesión' : 'cargando…'}
            </p>
          ) : groups.length === 0 ? (
            <p className="text-graphite">No tienes grupos. Crea uno de prueba.</p>
          ) : (
            <ul className="divide-rule border-rule divide-y border-y">
              {groups.map((g) => (
                <li key={g.group_id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <Link href={`/groups/${g.group_id}`} className="underline underline-offset-4">
                    {g.groups?.name ?? 'Grupo'}
                  </Link>
                  <span className="text-faint shrink-0 font-mono text-xs">
                    {g.groups?.status === 'DRAWN' ? 'sorteado' : 'sin sortear'}
                    {g.is_admin ? ' · organizas' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-faint mt-3 text-sm">
            En uno sorteado ves la revelación con el sello, el chat anónimo y tu lista. En uno sin
            sortear que organices ves los botones de admin y los diálogos.
          </p>
        </section>
      </div>
    </div>
  )
}
