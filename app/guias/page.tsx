import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { GUIDES } from '@/lib/guides'

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
      <main className="text-ink w-full max-w-[720px] flex-1 py-10 md:py-16">
        <nav aria-label="Ruta" className="text-graphite mb-2 text-[15px] font-medium">
          <Link href="/" className="hover:text-ink underline underline-offset-[3px]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Guías</span>
        </nav>
        <h1 className="mb-4 text-[34px] leading-tight font-light md:text-[44px]">Guías</h1>
        <p className="text-graphite mb-10 text-lg">
          Lo que conviene saber para que el amigo secreto salga bien.
        </p>
        <ul className="divide-rule border-rule divide-y border-y">
          {GUIDES.map((g) => (
            <li key={g.slug} className="py-6">
              <h2 className="mb-1 text-xl font-bold">
                <Link href={`/${g.slug}`} className="underline underline-offset-[3px]">
                  {g.title}
                </Link>
              </h2>
              <p className="text-graphite">{g.description}</p>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  )
}
