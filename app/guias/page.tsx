import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { GUIDES } from '@/lib/guides'
import { GuideArt } from '@/components/guide-art'

export const metadata = {
  title: { absolute: 'Guías para organizar el amigo secreto | Fantomio' },
  description:
    'Reglas del amigo secreto, cómo hacerlo por WhatsApp o en la oficina e ideas de regalo según el presupuesto.',
  alternates: { canonical: '/guias' },
}

export default function GuiasPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />
      <main className="text-ink w-full flex-1 py-10 md:py-16">
        <nav aria-label="Ruta" className="text-graphite mb-2 text-[15px] font-medium">
          <Link href="/" className="hover:text-ink underline underline-offset-[3px]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Guías</span>
        </nav>
        <h1 className="mb-4 text-[34px] leading-tight font-light md:text-[44px]">Guías</h1>
        <p className="text-graphite mb-10 max-w-[56ch] text-lg">
          Lo que conviene saber para que el amigo secreto salga bien.
        </p>
        <ul className="grid gap-5 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/${g.slug}`}
                className="border-rule hover:border-ink group flex h-full flex-col gap-4 rounded-[6px] border p-5 no-underline transition-colors md:p-6"
              >
                <GuideArt name={g.art} className="text-ink bg-slip w-full rounded-[4px] p-3" />
                <span>
                  <h2 className="text-ink mb-1.5 text-xl leading-snug font-bold text-balance group-hover:underline">
                    {g.title}
                  </h2>
                  <span className="text-graphite block">{g.description}</span>
                  <span className="text-faint mt-2 block text-[15px]">
                    {g.minutes} min de lectura
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  )
}
