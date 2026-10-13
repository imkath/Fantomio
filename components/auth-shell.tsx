'use client'

import Link from 'next/link'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
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
          <Button asChild variant="outline" size="sm">
            <Link href={back}>
              <ArrowLeft aria-hidden="true" />
              Volver
            </Link>
          </Button>
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
      {hint && <p className="text-graphite text-sm">{hint}</p>}
    </div>
  )
}

export function PasswordField({ label, hint, ...props }: FieldProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[15px] font-medium">
        {label}
      </label>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} className="pr-12" {...props} />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-graphite hover:text-ink absolute inset-y-0 right-0 grid w-11 place-items-center"
          aria-controls={id}
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {hint && <p className="text-graphite text-sm">{hint}</p>}
    </div>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="text-graphite flex items-center gap-3 text-[15px]">
      <span className="bg-rule h-px flex-1" />
      {children}
      <span className="bg-rule h-px flex-1" />
    </div>
  )
}
