import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { CreateGroupAside, GiftCard, GiftListCard, longDate } from '@/components/gift-list'
import { GIFT_LISTS, giftListBySlug } from '@/lib/regalos'

const SITE = 'https://fantomio.com'

export const dynamicParams = false
export const generateStaticParams = () => GIFT_LISTS.map((l) => ({ slug: l.slug }))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const list = giftListBySlug((await params).slug)
  if (!list) return {}
  return {
    title: { absolute: `${list.title} | Fantomio` },
    description: list.description,
    alternates: { canonical: `/regalos/${list.slug}` },
    openGraph: {
      type: 'article' as const,
      url: `${SITE}/regalos/${list.slug}`,
      title: list.title,
      description: list.description,
      images: [`${SITE}${list.cover}`],
    },
  }
}

export default async function GiftListPage({ params }: { params: Promise<{ slug: string }> }) {
  const list = giftListBySlug((await params).slug)
  if (!list) notFound()
  const others = GIFT_LISTS.filter((l) => l.slug !== list.slug)
  const hasAffiliate = list.products.some((p) => p.affiliate)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />
      <main className="text-ink w-full flex-1 py-10 md:py-16">
        <nav aria-label="Ruta" className="text-graphite mb-2 text-[15px] font-medium">
          <Link href="/" className="hover:text-ink underline underline-offset-[3px]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/regalos" className="hover:text-ink underline underline-offset-[3px]">
            Regalos
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{list.short}</span>
        </nav>
        <header className="mb-10 max-w-[720px]">
          <h1 className="mb-4 text-[34px] leading-tight font-light text-balance md:text-[44px]">
            {list.title}
          </h1>
          <p className="text-graphite mb-3 text-lg">{list.description}</p>
          <p className="text-faint text-[15px]">
            Precios revisados el <time dateTime={list.checked}>{longDate(list.checked)}</time>.
            Pueden cambiar en la tienda.
          </p>
        </header>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.products.map((p, i) => (
            <GiftCard key={p.url} product={p} index={i} />
          ))}
        </ul>
        {hasAffiliate && (
          <p className="text-faint mt-5 text-[15px]">
            Si compras desde algunos de estos links, la tienda le paga una comisión a Fantomio. A ti
            no te cuesta más.
          </p>
        )}

        <div className="mt-14">
          <CreateGroupAside />
        </div>

        {others.length > 0 && (
          <nav aria-labelledby="otras-listas" className="mt-12">
            <h2 id="otras-listas" className="mb-4 text-xl font-bold">
              Otras listas
            </h2>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {others.map((l) => (
                <li key={l.slug}>
                  <GiftListCard list={l} />
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <Footer />
    </div>
  )
}
