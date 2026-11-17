import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { CreateGroupAside, GiftListCard } from '@/components/gift-list'
import { GIFT_LISTS } from '@/lib/regalos'

export const metadata = {
  title: { absolute: 'Ideas de regalo para el amigo secreto, con precio y link | Fantomio' },
  description:
    'Listas de regalos para el amigo secreto en Chile: por presupuesto y por tipo de persona, con el precio revisado y el link a la tienda.',
  alternates: { canonical: '/regalos' },
}

export default function RegalosPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />
      <main className="text-ink w-full flex-1 py-10 md:py-16">
        <nav aria-label="Ruta" className="text-graphite mb-2 text-[15px] font-medium">
          <Link href="/" className="hover:text-ink underline underline-offset-[3px]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Regalos</span>
        </nav>
        <h1 className="mb-4 text-[34px] leading-tight font-light md:text-[44px]">
          Regalos para el amigo secreto
        </h1>
        <p className="text-graphite mb-10 max-w-[56ch] text-lg">
          Ideas por presupuesto y por tipo de persona, con el precio revisado y el link a la tienda.
          Si buscas consejos más generales, están en las{' '}
          <Link href="/guias" className="text-ink underline underline-offset-[3px]">
            guías
          </Link>
          .
        </p>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {GIFT_LISTS.map((l) => (
            <li key={l.slug}>
              <GiftListCard list={l} />
            </li>
          ))}
        </ul>
        <div className="mt-14">
          <CreateGroupAside />
        </div>
      </main>
      <Footer />
    </div>
  )
}
