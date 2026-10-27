import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { ScrambleTitle } from '@/components/scramble-title'
import { InsideDemo } from '@/components/landing/inside-demo'
import { HeroEyes } from '@/components/landing/hero-eyes'
import { DrawDemo } from '@/components/landing/draw-demo'
import { StepsStory } from '@/components/landing/steps-story'
import s from '@/components/landing/landing.module.css'
import { GUIDES } from '@/lib/guides'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const STEPS = [
  {
    title: 'Crea el grupo',
    text: 'Ponle nombre, la fecha del intercambio y el presupuesto (en pesos o en la moneda que usen).',
  },
  {
    title: 'Comparte el link',
    text: 'Mándalo por WhatsApp o por donde quieras. Cada uno entra con su cuenta y anota lo que le gustaría recibir.',
  },
  {
    title: 'Sortea',
    text: 'Si hay personas que no deberían tocarse, como una pareja, lo marcas antes de sortear. Después cada uno ve a quién le tocó.',
  },
]

const INSIDE = [
  {
    title: 'Lo abres cuando quieras',
    text: 'El nombre queda tapado hasta que tú lo destapas, por si estás con gente al lado.',
  },
  { title: 'Ves lo que le gustaría', text: 'Su lista de deseos, con links si los puso.' },
  {
    title: 'Le preguntas sin delatarte',
    text: 'Los mensajes llegan sin tu nombre. Te responde sin saber quién pregunta.',
  },
]

const FAQ = [
  {
    q: '¿Hay que descargar algo?',
    a: 'No. Se usa desde el navegador del celular y entras con Google o con correo y contraseña.',
  },
  {
    q: '¿Y si alguien se suma tarde?',
    a: 'Si todavía no se sortea, entra con el mismo link. Si ya se sorteó, quien organiza puede hacer el sorteo de nuevo.',
  },
  {
    q: '¿Cuántas personas pueden participar?',
    a: 'Desde tres. Sirve igual para una oficina de cuarenta que para una familia de seis.',
  },
  {
    q: '¿Puedo preguntarle algo a mi amigo secreto?',
    a: 'Sí, con los mensajes anónimos del grupo. Te responde sin saber quién le está preguntando.',
  },
  {
    q: '¿Puedo contarle que fui yo?',
    a: 'Sí, si quieres. Después del intercambio puedes revelarle que fuiste tú. Nadie más del grupo se entera.',
  },
  {
    q: '¿Por qué se llama Fantomio?',
    a: 'Porque hasta el intercambio, quien te regala es tu fantasma.',
  },
]

// The site, who runs it and the app itself, each in its own block (some validators don't
// read @graph). Everything here is visible on the page, except the old name in alternateName.
const jsonLdBlocks = [
  {
    '@type': 'WebSite',
    '@id': 'https://fantomio.com/#website',
    name: 'Fantomio',
    // The site's previous name, so search engines tie the old results to this one.
    alternateName: 'GhostSwap',
    url: 'https://fantomio.com',
    inLanguage: 'es',
    publisher: { '@id': 'https://fantomio.com/#organization' },
  },
  {
    '@type': 'Organization',
    '@id': 'https://fantomio.com/#organization',
    name: 'Fantomio',
    url: 'https://fantomio.com',
    logo: 'https://fantomio.com/icon-512.png',
  },
  {
    '@type': 'WebApplication',
    name: 'Fantomio',
    description:
      'Organiza tu Amigo Secreto online gratis, con sorteo automático, listas de deseos y mensajes anónimos con tu amigo secreto.',
    url: 'https://fantomio.com',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: 'es',
    publisher: { '@id': 'https://fantomio.com/#organization' },
  },
].map((block) => ({ '@context': 'https://schema.org', ...block }))

// Ratings collected inside the app (rate_app). Read once at build time; shown on the page and
// added to the WebApplication JSON-LD only with enough real ratings, as Google requires them to be
// genuine and visible.
const MIN_RATINGS = 5
type Rating = { count: number; average: number }
async function getRating(): Promise<Rating | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/app_rating_summary`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )
    if (!res.ok) return null
    const r = (await res.json()) as Rating
    return r.count >= MIN_RATINGS ? r : null
  } catch {
    return null
  }
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

// Static constants only. Escaping "<" keeps the JSON from ever closing the script tag,
// as the Next.js docs recommend for JSON-LD.
const ld = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') })

const len = (n: number) => ({ '--len': n }) as React.CSSProperties

export default async function LandingPage() {
  const rating = await getRating()
  const blocks = rating
    ? jsonLdBlocks.map((block) =>
        block['@type'] === 'WebApplication'
          ? {
              ...block,
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: rating.average,
                ratingCount: rating.count,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : block
      )
    : jsonLdBlocks
  return (
    <div className={s.page}>
      {blocks.map((block) => (
        <script
          key={block['@type']}
          type="application/ld+json"
          dangerouslySetInnerHTML={ld(block)}
        />
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(faqJsonLd)} />

      <div className={s.wrap}>
        <div className={s.first}>
          <LandingHeader />
          <div className={s.hero}>
            <div>
              <p className={s.kicker}>Para la familia, los amigos o la oficina</p>
              <h1 className={s.h1}>
                Arma tu <ScrambleTitle /> online en un minuto.
              </h1>
              <p className={s.lede}>
                Creas el grupo, mandas el link y Fantomio hace el sorteo. Cada persona ve solo a
                quién le regala y lo que esa persona anotó en su lista.
              </p>
              <div className={s.actions}>
                <Link className={`${s.btn} btn-paper`} href="/login">
                  Crear un grupo
                </Link>
                <Link className={s.quiet} href="/join">
                  Tengo un código de invitación
                </Link>
              </div>
            </div>
            <svg
              className={s.sketch}
              viewBox="0 0 300 330"
              role="img"
              aria-label="Dibujo a mano de un fantasma que sostiene un papelito doblado"
            >
              <path
                className={`${s.line} ${s.draw}`}
                style={len(900)}
                d="M70 300c-6-60-14-120-2-168 12-50 52-84 96-82 46 2 80 40 86 92 6 52-4 104-8 158-12-8-22-18-34-10-10 8-18 18-30 10-12-8-20-20-34-12-12 8-20 20-34 14-14-6-26-12-40-2"
              />
              <HeroEyes className={s.dot} />
              <path
                className={`${s.line} ${s.draw}`}
                style={len(220)}
                d="M200 188l58-14 10 44-58 14z M229 181l10 44"
              />
              <path className={`${s.line} ${s.draw}`} style={len(80)} d="M186 200c8-2 14 2 18 8" />
            </svg>
          </div>
        </div>

        <main>
          <section
            id="por-dentro"
            className={`${s.section} ${s.fullscreen}`}
            aria-labelledby="t-dentro"
          >
            <p className={s.label}>Por dentro</p>
            <div className={s.inside}>
              <InsideDemo />
              <div>
                <h2 id="t-dentro" className={s.h2}>
                  Así se ve cuando te toca
                </h2>
                <p className={s.sub}>
                  Cuando entras al grupo ves a quién le regalas y lo que anotó en su lista. Desde
                  ahí mismo le puedes escribir sin que sepa que eres tú. Prueba la pantalla de al
                  lado.
                </p>
                <ol className={s.notes}>
                  {INSIDE.map((item, i) => (
                    <li key={item.title}>
                      <span className={s.n}>{i + 1}</span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className={`${s.section} ${s.fullscreen}`} aria-labelledby="t-pasos">
            <p className={s.label}>Pasos</p>
            <h2 id="t-pasos" className={s.h2}>
              Cómo se arma
            </h2>
            <StepsStory steps={STEPS} />
          </section>

          <section
            id="a-ciegas"
            className={`${s.section} ${s.fullscreen}`}
            aria-labelledby="t-ciegas"
          >
            <div className={s.privacy}>
              <div>
                <p className={s.label}>A ciegas</p>
                <h2 id="t-ciegas" className={s.h2}>
                  Regalas sin saber a quién, solo por lo que anotó
                </h2>
                <p className={s.sub}>
                  En el sorteo a ciegas no ves el nombre de tu persona hasta la revelación. Tienes
                  su lista, sus respuestas y tu intuición.
                </p>
              </div>
              <div className={s.sealCard}>
                <dl>
                  <dt>Antes de la revelación</dt>
                  <dd>Ves la lista de tu persona, pero no su nombre.</dd>
                  <dt>En el chat</dt>
                  <dd>
                    Los nombres del grupo se tapan solos al escribir, para que nadie se delate. Rosa
                    la persona se tapa, el color rosa no.
                  </dd>
                  <dt>Las apuestas</dt>
                  <dd>
                    Cada quien anota quién cree que le toca. Al revelar, se ve cuántos acertaron.
                  </dd>
                  <dt>La revelación</dt>
                  <dd>Con un botón o a la hora que elija quien organiza.</dd>
                </dl>
              </div>
            </div>
          </section>

          <ul className={s.facts} aria-label="Lo que incluye">
            <li>
              <b>Gratis</b> sin plan pagado
            </li>
            <li>
              <b>Mensajes anónimos</b> con tu amigo secreto
            </li>
            <li>
              <b>Parejas o hermanos</b> separados, si quieres
            </li>
            <li>
              <b>Tu lista</b> la ve solo quien te regala
            </li>
          </ul>

          <section className={`${s.section} ${s.fullscreen}`} aria-labelledby="t-prueba">
            <p className={s.label}>Pruébalo</p>
            <h2 id="t-prueba" className={s.h2}>
              Un sorteo de mentira, para que veas cómo queda
            </h2>
            <p className={s.sub}>
              Seis personas, un botón. Cada una le regala a otra y nadie se saca a sí misma.
            </p>
            <DrawDemo />
          </section>

          <section className={`${s.section} ${s.fullscreen}`} aria-labelledby="t-faq">
            <p className={s.label}>Preguntas</p>
            <h2 id="t-faq" className={s.h2}>
              Lo que suelen preguntar
            </h2>
            <div className={s.faq}>
              {FAQ.map(({ q, a }) => (
                <div key={q}>
                  <h3>{q}</h3>
                  <p>{a}</p>
                </div>
              ))}
            </div>
            <nav className={s.guides} aria-labelledby="t-guias">
              <h3 id="t-guias">Guías</h3>
              <ul>
                {GUIDES.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/${g.slug}`}>{g.title}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </section>

          <section className={`${s.section} ${s.closing}`} aria-labelledby="t-end">
            <h2 id="t-end" className={s.h2}>
              ¿Armamos el de este año?
            </h2>
            <Link className={`${s.btn} btn-paper`} href="/login">
              Crear un grupo
            </Link>
            {rating && (
              <p className={s.rating}>
                Nota {rating.average.toLocaleString('es-CL')} de 5, según {rating.count} personas
                que lo usaron.
              </p>
            )}
          </section>
        </main>

        <Footer />
      </div>
    </div>
  )
}
