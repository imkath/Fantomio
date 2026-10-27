import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { GUIDES, guideBySlug } from '@/lib/guides'

const SITE = 'https://fantomio.com'

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// Static constants only. Escaping "<" keeps the JSON from ever closing the script tag,
// as the Next.js docs recommend for JSON-LD.
const ld = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') })

// Shared page for every guide: breadcrumb, title, the text, one way into the app and the
// other guides. Article and BreadcrumbList JSON-LD describe what is visible on the page.
export function GuideLayout({ slug, children }: { slug: string; children: React.ReactNode }) {
  const guide = guideBySlug(slug)
  const url = `${SITE}/${slug}`
  const blocks = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Guías', item: `${SITE}/guias` },
        { '@type': 'ListItem', position: 3, name: guide.short, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.title,
      description: guide.description,
      inLanguage: 'es',
      mainEntityOfPage: url,
      datePublished: guide.updated,
      dateModified: guide.updated,
      author: { '@id': `${SITE}/#organization` },
      publisher: { '@id': `${SITE}/#organization` },
      image: `${SITE}/og-image.png`,
    },
  ]
  const others = GUIDES.filter((g) => g.slug !== slug)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />
      <main className="text-ink w-full max-w-[720px] flex-1 py-10 md:py-16">
        {blocks.map((block) => (
          <script
            key={block['@type']}
            type="application/ld+json"
            dangerouslySetInnerHTML={ld(block)}
          />
        ))}
        <nav aria-label="Ruta" className="text-graphite mb-2 text-[15px] font-medium">
          <Link href="/" className="hover:text-ink underline underline-offset-[3px]">
            Inicio
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/guias" className="hover:text-ink underline underline-offset-[3px]">
            Guías
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{guide.short}</span>
        </nav>
        <h1 className="mb-4 text-[34px] leading-tight font-light text-balance md:text-[44px]">
          {guide.title}
        </h1>
        <p className="text-graphite mb-2 text-lg">{guide.description}</p>
        <p className="text-faint mb-10 text-[15px]">
          Actualizada el <time dateTime={guide.updated}>{longDate(guide.updated)}</time>
        </p>

        <article className="space-y-10">{children}</article>

        <aside className="border-rule bg-slip mt-14 rounded-[4px] border p-6 md:p-8">
          <h2 className="mb-2 text-xl font-bold">Arma tu amigo secreto en Fantomio</h2>
          <p className="text-graphite mb-5">
            Creas el grupo, mandas el link y Fantomio hace el sorteo. Cada persona ve solo a quién
            le regala, y es gratis.
          </p>
          <Button asChild size="lg">
            <Link href="/register">Crear un grupo</Link>
          </Button>
        </aside>

        <nav aria-labelledby="otras-guias" className="mt-12">
          <h2 id="otras-guias" className="mb-3 text-xl font-bold">
            Otras guías
          </h2>
          <ul className="space-y-2">
            {others.map((g) => (
              <li key={g.slug}>
                <Link href={`/${g.slug}`} className="underline underline-offset-[3px]">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <Footer />
    </div>
  )
}

export function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-normal">{title}</h2>
      <div className="text-graphite space-y-4 leading-relaxed">{children}</div>
    </section>
  )
}

export function GuideList({
  ordered = false,
  items,
}: {
  ordered?: boolean
  items: React.ReactNode[]
}) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`space-y-2 pl-6 ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  )
}

export function guideMetadata(slug: string) {
  const guide = guideBySlug(slug)
  return {
    title: { absolute: `${guide.title} | Fantomio` },
    description: guide.description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: 'article' as const,
      url: `${SITE}/${slug}`,
      title: guide.title,
      description: guide.description,
    },
  }
}
