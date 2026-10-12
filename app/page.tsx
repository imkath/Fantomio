import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { AuroraBackground } from '@/components/aurora-background'
import { AnimatedFeatures } from '@/components/animated-features'
import { SectionAurora } from '@/components/section-aurora'
import { ScrambleTitle } from '@/components/scramble-title'
import { PrivacyDemo } from '@/components/privacy-demo'
import { ScrollReveal, CardReveal, StaggerReveal, StaggerItem } from '@/components/scroll-reveal'
import { Ghost, Calendar, Share2, Shuffle, Users, Star } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'GhostSwap',
  description:
    'Organiza tu Amigo Secreto o intercambio de regalos online gratis con sorteos automáticos y listas de deseos.',
  url: 'https://ghostswap.nvrkth.com',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  inLanguage: 'es',
  keywords: 'amigo secreto, secret santa, intercambio de regalos, sorteo navidad',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Cómo funciona el Amigo Secreto en GhostSwap?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Creas un grupo, compartes el link con tus amigos, y cuando todos se unan, realizas el sorteo automático. Cada persona ve solo a quién le tocó regalar.',
      },
    },
    {
      '@type': 'Question',
      name: '¿GhostSwap es gratis?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí, GhostSwap es 100% gratis. No hay costos ocultos ni versiones premium.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cuántas personas pueden participar en un grupo?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Se necesitan al menos 3 participantes para realizar el sorteo. No hay límite máximo de participantes.',
      },
    },
  ],
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingHeader />

      <main className="flex-1" role="main">
        {/* Hero Section */}
        <section className="relative px-4 py-20 md:py-32" aria-labelledby="hero-title">
          <AuroraBackground />
          <div className="pointer-events-none absolute inset-0 bg-slate-50/70" aria-hidden="true" />

          <div className="relative z-10 mx-auto max-w-3xl space-y-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Sorteos invisibles, regalos inolvidables
            </div>

            <h1
              id="hero-title"
              className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl"
            >
              Organiza el <ScrambleTitle /> más genial
            </h1>

            <p className="mx-auto max-w-xl text-lg leading-relaxed text-slate-600">
              Crea tu grupo, comparte el link, y el sorteo se hace solo. Sin ads. Sin tracking. Sin
              que nadie pueda espiar.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Link href="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 w-full bg-indigo-600 text-base shadow-lg shadow-indigo-200/50 hover:bg-indigo-700"
                >
                  Crear mi grupo
                </Button>
              </Link>
              <Link href="/join" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full border-slate-300 bg-white text-base text-slate-700 hover:bg-slate-50"
                >
                  Unirme a un grupo
                </Button>
              </Link>
            </div>

            <div
              className="flex items-center justify-center gap-6 text-sm text-slate-500"
              aria-label="Beneficios de GhostSwap"
            >
              <div className="flex items-center gap-1.5">
                <Ghost className="h-4 w-4" aria-hidden="true" />
                <span>100% Gratis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Sin ads, sin tracking</span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — card reveal on scroll */}
        <section
          className="border-y border-slate-200 bg-white py-20"
          aria-labelledby="how-it-works-title"
        >
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <div className="mb-16 text-center">
                <h2 id="how-it-works-title" className="mb-4 text-3xl font-bold text-slate-900">
                  ¿Cómo funciona?
                </h2>
                <p className="text-lg text-slate-500">Tres pasos. Sin complicaciones.</p>
              </div>
            </ScrollReveal>

            <StaggerReveal
              className="mx-auto grid max-w-5xl list-none gap-12 md:grid-cols-3"
              stagger={0.15}
            >
              <StaggerItem>
                <li className="flex flex-col items-center space-y-4 text-center">
                  <div
                    className="mb-2 flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 transition-transform hover:rotate-6"
                    aria-hidden="true"
                  >
                    <Calendar className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">1. Crea tu grupo</h3>
                  <p className="leading-relaxed text-slate-600">
                    Nombre, fecha, presupuesto y moneda. Listo.
                  </p>
                </li>
              </StaggerItem>

              <StaggerItem>
                <li className="flex flex-col items-center space-y-4 text-center">
                  <div
                    className="mb-2 flex h-16 w-16 -rotate-3 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 transition-transform hover:-rotate-6"
                    aria-hidden="true"
                  >
                    <Share2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">2. Comparte el link</h3>
                  <p className="leading-relaxed text-slate-600">
                    Tus amigos entran con Google o magic link. Cero fricción.
                  </p>
                </li>
              </StaggerItem>

              <StaggerItem>
                <li className="flex flex-col items-center space-y-4 text-center">
                  <div
                    className="mb-2 flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 transition-transform hover:rotate-6"
                    aria-hidden="true"
                  >
                    <Shuffle className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">3. Sortear</h3>
                  <p className="leading-relaxed text-slate-600">
                    Un clic. Nadie se regala a sí mismo. Nadie puede espiar. Fin.
                  </p>
                </li>
              </StaggerItem>
            </StaggerReveal>
          </div>
        </section>

        {/* Privacy Section — card reveal */}
        <section className="relative overflow-hidden px-4 py-20" aria-labelledby="privacy-title">
          <SectionAurora />

          <div className="relative z-10">
            <ScrollReveal className="mx-auto mb-10 max-w-4xl">
              <div className="mb-8 text-center">
                <h2 id="privacy-title" className="mb-3 text-2xl font-bold text-slate-900">
                  Privacidad que se demuestra, no se promete
                </h2>
                <p className="mx-auto max-w-lg text-slate-600">
                  Ni siquiera el admin puede ver las asignaciones. Cada persona solo ve la suya.
                  Pruébalo.
                </p>
              </div>
            </ScrollReveal>

            <CardReveal className="mx-auto mb-16 max-w-4xl">
              <PrivacyDemo />
            </CardReveal>

            <ScrollReveal className="mx-auto mb-16 max-w-4xl" delay={0.1}>
              <AnimatedFeatures />
            </ScrollReveal>

            {/* CTA Final */}
            <ScrollReveal className="mx-auto max-w-2xl text-center" delay={0.1}>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                ¿Listos para el intercambio?
              </h2>
              <p className="mb-6 text-slate-600">En menos de un minuto tendrás tu grupo listo.</p>
              <Link href="/login">
                <Button
                  size="lg"
                  className="h-12 bg-indigo-600 px-8 text-base shadow-lg shadow-indigo-200/50 hover:bg-indigo-700"
                >
                  Comenzar ahora
                </Button>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
