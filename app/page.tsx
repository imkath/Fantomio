import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { ScrambleTitle } from '@/components/scramble-title'
import { InsideDemo } from '@/components/landing/inside-demo'
import s from '@/components/landing/landing.module.css'

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
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'GhostSwap',
  description:
    'Organiza tu Amigo Secreto o intercambio de regalos online gratis con sorteos automáticos y listas de deseos.',
  url: 'https://ghostswap.nvrkth.com',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  inLanguage: 'es',
  keywords: 'amigo secreto, secret santa, intercambio de regalos, sorteo',
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

export default function LandingPage() {
  return (
    <div className={s.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(jsonLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(faqJsonLd)} />

      <div className={s.wrap}>
        <div className={s.first}>
          <LandingHeader />
          <div className={s.hero}>
            <div>
              <p className={s.kicker}>Para la familia, los amigos o la oficina</p>
              <h1 className={s.h1}>
                Arma tu <ScrambleTitle /> en un minuto.
              </h1>
              <p className={s.lede}>
                Creas el grupo, mandas el link y GhostSwap hace el sorteo. Cada persona ve solo a
                quién le regala, y eso también corre para quien organiza.
              </p>
              <div className={s.actions}>
                <Link className={s.btn} href="/login">
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
              <circle className={s.dot} cx="128" cy="134" r="5" />
              <circle className={s.dot} cx="172" cy="134" r="5" />
              <path
                className={`${s.line} ${s.draw}`}
                style={len(220)}
                d="M200 188l58-14 10 44-58 14z M229 181l10 44"
              />
              <path className={`${s.line} ${s.draw}`} style={len(80)} d="M186 200c8-2 14 2 18 8" />
              <text className={s.note} x="216" y="262">
                p/ ti
              </text>
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
            <ol className={s.steps}>
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className={s.n}>{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section
            id="privacidad"
            className={`${s.section} ${s.fullscreen}`}
            aria-labelledby="t-priv"
          >
            <div className={s.privacy}>
              <div>
                <p className={s.label}>Privacidad</p>
                <h2 id="t-priv" className={s.h2}>
                  Quien organiza tampoco sabe a quién te tocó
                </h2>
                <p className={s.sub}>
                  La base de datos le muestra cada asignación solo a la persona que regala. Esa
                  regla vive en la base, así que nadie se la puede saltar desde la app, ni siquiera
                  quien armó el grupo.
                </p>
              </div>
              <div className={s.sealCard}>
                <div className={s.stamp} aria-hidden="true">
                  SOLO
                  <br />
                  PARA
                  <br />
                  TI
                </div>
                <dl>
                  <dt>Tú ves</dt>
                  <dd>
                    A quién le regalas, su lista de deseos y lo que te responde en los mensajes
                    anónimos.
                  </dd>
                  <dt>Tu grupo ve</dt>
                  <dd>Que estás dentro y tu lista de deseos.</dd>
                  <dt>Quien organiza</dt>
                  <dd>Que el sorteo ya se hizo.</dd>
                  <dt>Nosotros</dt>
                  <dd>No mostramos anuncios ni vendemos tus datos. Tampoco te rastreamos.</dd>
                </dl>
              </div>
            </div>
          </section>

          <ul className={s.facts} aria-label="Lo que incluye">
            <li>
              <b>Gratis</b>, sin plan pagado
            </li>
            <li>
              <b>Mensajes anónimos</b> con tu amigo secreto
            </li>
            <li>
              Puedes evitar que se toquen <b>parejas o hermanos</b>
            </li>
            <li>
              <b>Listas de deseos</b> con links
            </li>
          </ul>

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
          </section>

          <section className={`${s.section} ${s.closing}`} aria-labelledby="t-end">
            <h2 id="t-end" className={s.h2}>
              ¿Armamos el de este año?
            </h2>
            <Link className={s.btn} href="/login">
              Crear un grupo
            </Link>
          </section>
        </main>

        <Footer />
      </div>
    </div>
  )
}
