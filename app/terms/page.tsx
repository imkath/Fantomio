import { Metadata } from 'next'
import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Términos del Servicio - GhostSwap',
  description: 'Condiciones de uso de GhostSwap para organizar tu Amigo Secreto.',
}

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <LandingHeader />

      <main className="container mx-auto max-w-3xl flex-1 px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 md:p-12">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2.5">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Términos del Servicio</h1>
          </div>

          <p className="mb-8 text-sm text-slate-500">Última actualización: Octubre 2026</p>

          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">1. El Servicio</h2>
              <p className="text-slate-600">
                GhostSwap es una aplicación web gratuita para organizar sorteos de Amigo Secreto e
                intercambios de regalos. Al crear una cuenta o usar el servicio aceptas estos
                términos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">2. Tu Cuenta</h2>
              <p className="text-slate-600">
                Puedes entrar con Google o con email y contraseña. Eres responsable de mantener
                segura tu cuenta y de que los datos que ingresas sean tuyos o tengas permiso para
                usarlos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">3. Uso Aceptable</h2>
              <p className="mb-4 text-slate-600">Al usar GhostSwap te comprometes a no:</p>
              <ul className="ml-4 list-inside list-disc space-y-2 text-slate-600">
                <li>
                  Usar el servicio para enviar spam o contenido ofensivo a otros participantes
                </li>
                <li>Intentar acceder a las asignaciones o datos de otras personas</li>
                <li>
                  Interferir con el funcionamiento del servicio o abusar de él de forma automatizada
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">4. Tu Contenido</h2>
              <p className="text-slate-600">
                Los nombres de grupos, listas de deseos y demás datos que ingresas siguen siendo
                tuyos. Solo los usamos para hacer funcionar el servicio, como se describe en la{' '}
                <Link href="/privacy" className="text-indigo-600 hover:underline">
                  Política de Privacidad
                </Link>
                .
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">5. Disponibilidad</h2>
              <p className="text-slate-600">
                GhostSwap se ofrece tal cual, sin garantías de disponibilidad continua. Hacemos lo
                posible para que funcione bien, pero no nos hacemos responsables por pérdidas
                derivadas de interrupciones o errores del servicio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">6. Término de la Cuenta</h2>
              <p className="text-slate-600">
                Puedes dejar de usar GhostSwap y solicitar la eliminación de tu cuenta en cualquier
                momento. Podemos suspender cuentas que incumplan estos términos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-900">7. Cambios</h2>
              <p className="text-slate-600">
                Podemos actualizar estos términos ocasionalmente. Publicaremos la nueva versión en
                esta página con su fecha de actualización.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-slate-900">8. Contacto</h2>
              <p className="text-slate-600">
                Si tienes preguntas sobre estos términos, puedes contactarnos a través del
                repositorio del proyecto.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
