import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { GhostMark } from '@/components/ghost-mark'

export default function NotFound() {
  return (
    <div className="text-ink mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />
      <main className="flex flex-1 flex-col items-start justify-center gap-5 py-16">
        <GhostMark className="h-[74px] w-[64px]" />
        <p className="text-graphite text-[15px]">Error 404</p>
        <h1 className="text-[34px] leading-tight font-light md:text-[48px]">
          Esta página no existe.
        </h1>
        <p className="text-graphite max-w-[42ch]">
          Puede que el link esté incompleto. Si te lo mandaron para unirte a un grupo, pide que te
          lo reenvíen o usa el código.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-5">
          <Link href="/" className={buttonVariants({ size: 'lg' })}>
            Ir al inicio
          </Link>
          <Link href="/join" className="text-graphite hover:text-ink underline underline-offset-4">
            Tengo un código
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
