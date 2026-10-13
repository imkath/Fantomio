import { Metadata } from 'next'
import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Términos del Servicio - GhostSwap',
  description: 'Condiciones de uso de GhostSwap para organizar tu Amigo Secreto.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="text-graphite space-y-4">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />

      <main className="text-ink w-full max-w-[720px] flex-1 py-10 md:py-16">
        <div>
          <p className="text-graphite mb-2 font-mono text-sm tracking-[0.12em] uppercase">Legal</p>
          <h1 className="mb-2 text-[34px] leading-tight font-light md:text-[44px]">
            Términos del Servicio
          </h1>

          <p className="text-faint mb-10 font-mono text-sm">
            Versión {LEGAL.version}, vigente desde el {LEGAL.fecha}
          </p>

          <div className="max-w-none">
            <Section title="1. Qué es GhostSwap">
              <p>
                GhostSwap es un servicio gratuito para organizar sorteos de Amigo Secreto e
                intercambios de regalos. Quién lo ofrece y cómo contactarla está en la{' '}
                <Link href="/privacy" className="text-ink underline underline-offset-[3px]">
                  Política de Privacidad
                </Link>
                . Al crear una cuenta o usar el servicio aceptas estos términos. Si no estás de
                acuerdo, no lo uses.
              </p>
            </Section>

            <Section title="2. Quién puede usarlo">
              <p>
                Si tienes menos de 14 años, necesitas el consentimiento de tu madre, padre o
                representante legal para usar GhostSwap.
              </p>
            </Section>

            <Section title="3. Tu cuenta">
              <p>
                Puedes entrar con Google o con correo y contraseña. Cuida el acceso a tu cuenta: lo
                que se haga desde ella se entiende hecho por ti.
              </p>
            </Section>

            <Section title="4. Qué no está permitido">
              <ul className="ml-4 list-inside list-disc space-y-2">
                <li>Usar el servicio para acosar, insultar o enviar spam a otros participantes.</li>
                <li>Intentar ver asignaciones o datos que no te corresponden.</li>
                <li>Hacerse pasar por otra persona.</li>
                <li>Interferir con el funcionamiento del servicio.</li>
              </ul>
              <p>Podemos suspender o eliminar las cuentas que no respeten estas reglas.</p>
            </Section>

            <Section title="5. Lo que escribes">
              <p>
                Tu lista de deseos y tus mensajes siguen siendo tuyos, y eres responsable de lo que
                escribes. Para que el servicio funcione nos autorizas a guardarlos y a mostrarlos a
                las personas que corresponda dentro de tu grupo, y solo para eso. Podemos borrar
                contenido que infrinja la ley o estos términos.
              </p>
            </Section>

            <Section title="6. Tus datos">
              <p>
                Cómo tratamos tus datos personales y cómo ejercer tus derechos está en la{' '}
                <Link href="/privacy" className="text-ink underline underline-offset-[3px]">
                  Política de Privacidad
                </Link>
                .
              </p>
            </Section>

            <Section title="7. Disponibilidad y responsabilidad">
              <p>
                GhostSwap es gratuito y se ofrece tal como está. Hacemos lo posible para que
                funcione bien, pero no garantizamos que esté siempre disponible ni libre de errores.
                En la medida en que la ley lo permita, no respondemos por daños derivados de
                interrupciones del servicio ni por los regalos, compras o acuerdos entre
                participantes.
              </p>
            </Section>

            <Section title="8. Cierre de tu cuenta">
              <p>
                Puedes dejar de usar GhostSwap cuando quieras y pedir que eliminemos tu cuenta
                escribiendo a{' '}
                <a
                  href={`mailto:${LEGAL.contacto}`}
                  className="text-ink underline underline-offset-[3px]"
                >
                  {LEGAL.contacto}
                </a>
                . Si el servicio deja de funcionar, avisaremos con anticipación razonable.
              </p>
            </Section>

            <Section title="9. Cambios">
              <p>
                Si cambiamos estos términos, publicaremos aquí la nueva versión con su fecha. Si el
                cambio es importante, te avisaremos por correo. Seguir usando el servicio después
                del cambio significa que lo aceptas.
              </p>
            </Section>

            <Section title="10. Ley aplicable">
              <p>
                Estos términos se rigen por las leyes de la República de Chile. Cualquier
                controversia se someterá a los tribunales ordinarios de justicia de Chile.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
