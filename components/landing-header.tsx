import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function LandingHeader() {
  return (
    <header className="flex items-center justify-between gap-4 py-[22px]" role="banner">
      <Logo />
      <nav className="flex items-center gap-6" aria-label="Navegación principal">
        <Link
          href="/#por-dentro"
          className="text-graphite hover:text-ink hidden text-base no-underline md:inline"
        >
          Por dentro
        </Link>
        <Link
          href="/#privacidad"
          className="text-graphite hover:text-ink hidden text-base no-underline md:inline"
        >
          Privacidad
        </Link>
        <ThemeToggle compact />
        <Button asChild size="sm">
          <Link href="/login">
            Entrar
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </nav>
    </header>
  )
}
