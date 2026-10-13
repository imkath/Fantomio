'use client'

import Link from 'next/link'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

// Shared frame for login, register, password recovery and join.
export function AuthShell({
  back = '/',
  title,
  lede,
  children,
}: {
  back?: string
  title: ReactNode
  lede?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-paper text-ink flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4 px-4 py-[22px] md:px-8">
        <Logo />
        <div className="flex items-center gap-5">
          <ThemeToggle compact />
          <Link
            href={back}
            className="text-graphite hover:text-ink text-base underline underline-offset-4"
          >
            Volver
          </Link>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-6 pb-20 md:items-center md:pt-0">
        <div className="w-full max-w-[420px]">
          <h1 className="mb-2 text-[34px] leading-tight font-light md:text-[40px]">{title}</h1>
          {lede && <p className="text-graphite mb-8">{lede}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}

export function Notice({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'ok'
  children: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-[2px] border px-4 py-3 text-[15px] ${
        tone === 'error' ? 'border-destructive text-destructive' : 'border-ink bg-slip text-ink'
      }`}
    >
      {children}
    </div>
  )
}

type FieldProps = ComponentProps<typeof Input> & { label: string; hint?: string }

export function Field({ label, hint, ...props }: FieldProps) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[15px] font-medium">
        {label}
      </label>
      <Input id={id} {...props} />
      {hint && <p className="text-faint text-sm">{hint}</p>}
    </div>
  )
}

export function PasswordField({ label, hint, ...props }: FieldProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-graphite hover:text-ink min-h-8 font-mono text-[13px] underline underline-offset-[3px]"
          aria-controls={id}
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {show ? 'ocultar' : 'mostrar'}
        </button>
      </div>
      <Input id={id} type={show ? 'text' : 'password'} {...props} />
      {hint && <p className="text-faint text-sm">{hint}</p>}
    </div>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="text-faint flex items-center gap-3 font-mono text-[13px]">
      <span className="bg-rule h-px flex-1" />
      {children}
      <span className="bg-rule h-px flex-1" />
    </div>
  )
}
