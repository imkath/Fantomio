import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { GUIDES, guideBySlug } from '@/lib/guides'
import { GuideArt, NoteGhost } from '@/components/guide-art'
import type { LucideIcon } from 'lucide-react'

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
export function GuideLayout({
  slug,
  summary,
  children,
}: {
  slug: string
  // The answer in two or three sentences, first thing on the page: what someone who searched
  // the question needs, and what an AI answer can quote. Real text, never only in the picture.
  summary: React.ReactNode[]
  children: React.ReactNode
}) {
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
        <header className="mb-10 grid items-center gap-6 md:grid-cols-[1fr_260px] md:gap-10">
          <div>
            <h1 className="mb-4 text-[34px] leading-tight font-light text-balance md:text-[44px]">
              {guide.title}
            </h1>
            <p className="text-graphite mb-3 text-lg">{guide.description}</p>
            <p className="text-faint text-[15px]">
              {guide.minutes} min de lectura · Actualizada el{' '}
              <time dateTime={guide.updated}>{longDate(guide.updated)}</time>
            </p>
          </div>
          <GuideArt
            name={guide.art}
            className="text-ink order-first w-full max-w-[280px] md:order-none md:max-w-none"
          />
        </header>

        <section
          aria-labelledby="en-corto"
          className="border-rule bg-slip relative mb-12 rounded-[6px] border border-dashed p-6 md:p-7"
        >
          <h2 id="en-corto" className="mb-3 flex items-center gap-2.5 text-lg font-bold">
            <NoteGhost className="text-ink h-7 w-6 shrink-0" />
            En corto
          </h2>
          <ul className="text-ink space-y-2.5 text-[17px] leading-relaxed">
            {summary.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="bg-ink mt-[0.6em] size-1.5 shrink-0 rounded-full"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <article className="space-y-14">{children}</article>

        <aside className="border-rule bg-raised mt-16 grid items-center gap-6 rounded-[6px] border p-6 sm:grid-cols-[1fr_150px] md:p-8">
          <div>
            <h2 className="mb-2 text-xl font-bold">Arma tu amigo secreto en Fantomio</h2>
            <p className="text-graphite mb-5">
              Creas el grupo, mandas el link y Fantomio hace el sorteo. Cada persona ve solo a quién
              le regala, y es gratis.
            </p>
            <Button asChild size="lg">
              <Link href="/register">Crear un grupo</Link>
            </Button>
          </div>
          <GuideArt name="reglas" className="text-ink hidden w-full sm:block" />
        </aside>

        <nav aria-labelledby="otras-guias" className="mt-12">
          <h2 id="otras-guias" className="mb-3 text-xl font-bold">
            Otras guías
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {others.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/${g.slug}`}
                  className="border-rule hover:border-ink group flex h-full flex-col gap-3 rounded-[6px] border p-4 no-underline transition-colors"
                >
                  <GuideArt name={g.art} className="text-ink w-full" />
                  <span className="text-ink font-medium group-hover:underline">{g.short}</span>
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
      <h2 className="mb-4 text-[26px] leading-tight font-normal text-balance">{title}</h2>
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

// Steps as numbered paper slips: easier to follow on a phone than a long numbered list.
export function GuideSteps({
  items,
}: {
  items: Array<{ title: string; text: React.ReactNode; icon: LucideIcon }>
}) {
  return (
    // An odd last step takes the whole row instead of sitting alone in half of it.
    <ol className="grid gap-4 sm:grid-cols-2 sm:[&>li:last-child:nth-child(odd)]:col-span-2">
      {items.map(({ title, text, icon: Icon }, i) => (
        <li
          key={title}
          className="border-rule bg-raised relative flex flex-col gap-2 rounded-[6px] border p-5"
        >
          <span className="flex items-center gap-3">
            <span className="bg-ink text-paper grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-bold tabular-nums">
              {i + 1}
            </span>
            <Icon aria-hidden="true" className="text-graphite size-5" />
          </span>
          <strong className="text-ink text-[18px] leading-snug">{title}</strong>
          <span className="text-graphite leading-relaxed">{text}</span>
        </li>
      ))}
    </ol>
  )
}

// A short aside with the ghost: a tip, or how Fantomio handles it.
export function GuideNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="bg-slip flex gap-4 rounded-[6px] p-5">
      <NoteGhost className="text-ink mt-0.5 h-9 w-8 shrink-0" />
      <div>
        <p className="text-ink mb-1 font-bold">{title}</p>
        <div className="text-graphite leading-relaxed">{children}</div>
      </div>
    </aside>
  )
}

// Questions people actually run into, as cards. The question is a heading, the way it is asked.
export function GuideCards({
  items,
}: {
  items: Array<{ title: string; text: React.ReactNode; icon?: LucideIcon }>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ title, text, icon: Icon }) => (
        <div key={title} className="border-rule rounded-[6px] border p-5">
          <h3 className="text-ink mb-2 flex items-start gap-2.5 text-[18px] leading-snug font-bold">
            {Icon && <Icon aria-hidden="true" className="text-graphite mt-0.5 size-5 shrink-0" />}
            {title}
          </h3>
          <p className="text-graphite leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  )
}

// Two ways side by side; the second is the one the guide recommends.
export function GuideCompare({
  left,
  right,
}: {
  left: { title: string; points: string[] }
  right: { title: string; points: string[] }
}) {
  const col = (side: { title: string; points: string[] }, chosen: boolean) => (
    <div
      className={`rounded-[6px] border p-5 ${chosen ? 'border-ink bg-raised' : 'border-rule bg-slip'}`}
    >
      <p className="text-ink mb-3 font-bold">{side.title}</p>
      <ul className="text-graphite space-y-2">
        {side.points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <span aria-hidden="true" className="text-ink shrink-0">
              {chosen ? '✓' : '·'}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {col(left, false)}
      {col(right, true)}
    </div>
  )
}

// Budget tiers as paper price tags, each with its own slip color (fixed, like the draw demo).
const TAG_COLORS = ['#d9efdf', '#fbedc2', '#f9dbe4']
export function GuideTags({ tiers }: { tiers: Array<{ title: string; items: string[] }> }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {tiers.map((tier, i) => (
        <section
          key={tier.title}
          aria-label={tier.title}
          className="relative rounded-[6px] p-5 pt-6 text-[#1b1b1a]"
          style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}
        >
          <span
            aria-hidden="true"
            className="bg-paper absolute top-3 right-3 size-3.5 rounded-full border-[1.5px] border-[#1b1b1a]"
          />
          <h3 className="mb-3 pr-6 text-[18px] font-bold">{tier.title}</h3>
          <ul className="space-y-2 text-[16px] leading-snug">
            {tier.items.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[#1b1b1a]"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// Things to avoid, each marked so the list reads at a glance.
export function GuideDont({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item} className="border-rule flex gap-3 rounded-[6px] border p-4">
          <span
            aria-hidden="true"
            className="text-destructive grid size-6 shrink-0 place-items-center rounded-full border border-current text-[14px] font-bold"
          >
            ✕
          </span>
          <span className="text-graphite leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

// A group chat as it looks when the link goes in: shows the flow without a screenshot.
export function GuideChat({
  title,
  lines,
}: {
  title: string
  lines: Array<{ who: string; text: string; me?: boolean; link?: boolean }>
}) {
  return (
    <figure className="border-rule bg-slip mx-auto w-full max-w-[420px] overflow-hidden rounded-[18px] border">
      <figcaption className="border-rule bg-raised text-ink border-b px-4 py-3 text-[15px] font-bold">
        {title}
      </figcaption>
      <ol className="space-y-2.5 p-4">
        {lines.map((line, i) => (
          <li key={i} className={`flex ${line.me ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-[14px] px-3.5 py-2 text-[15px] leading-snug ${
                line.me
                  ? 'bg-ink text-paper rounded-br-[4px]'
                  : 'bg-raised text-ink rounded-bl-[4px]'
              }`}
            >
              {!line.me && (
                <span className="text-graphite block text-[13px] font-bold">{line.who}</span>
              )}
              {line.link ? (
                <span className="underline underline-offset-2">{line.text}</span>
              ) : (
                line.text
              )}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  )
}
