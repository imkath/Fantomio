import { Metadata } from 'next'
import Link from 'next/link'
import { LandingHeader } from '@/components/landing-header'
import { Footer } from '@/components/footer'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de Privacidad - GhostSwap',
  description: 'Qué datos trata GhostSwap, para qué, quién los ve y cómo ejercer tus derechos.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="text-graphite space-y-4">{children}</div>
    </section>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="ml-4 list-inside list-disc space-y-2">{children}</ul>
}

const mail = (
  <a href={`mailto:${LEGAL.contacto}`} className="text-ink underline underline-offset-[3px]">
    {LEGAL.contacto}
  </a>
)

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-4 md:px-8">
      <LandingHeader />

      <main className="text-ink w-full max-w-[720px] flex-1 py-10 md:py-16">
        <div>
          <p className="text-graphite mb-2 font-mono text-sm tracking-[0.12em] uppercase">Legal</p>
          <h1 className="mb-2 text-[34px] leading-tight font-light md:text-[44px]">
            Política de Privacidad
          </h1>

          <p className="text-faint mb-10 font-mono text-sm">
            Versión {LEGAL.version}, vigente desde el {LEGAL.fecha}
          </p>

          <div className="max-w-none">
            <Section title="1. Quién es responsable">
              <p>
                La responsable del tratamiento de tus datos en GhostSwap es {LEGAL.responsable}.
                Para cualquier consulta o solicitud sobre tus datos escribe a {mail}.
              </p>
            </Section>

            <Section title="2. Qué datos tratamos y de dónde vienen">
              <List>
                <li>
                  <strong>Cuenta:</strong> correo electrónico, nombre y foto de perfil. Los ingresas
                  tú al registrarte o los entrega Google cuando entras con tu cuenta de Google. De
                  Google solo recibimos esos tres datos.
                </li>
                <li>
                  <strong>Grupos:</strong> nombre del grupo, presupuesto, moneda, fecha del
                  intercambio y código de invitación.
                </li>
                <li>
                  <strong>Participación:</strong> tu lista de deseos, las exclusiones que define el
                  administrador del grupo, la asignación del sorteo y los mensajes anónimos que
                  intercambias con tu amigo secreto.
                </li>
                <li>
                  <strong>Datos técnicos:</strong> dirección IP y registros de inicio de sesión, que
                  nuestro proveedor de autenticación guarda por seguridad.
                </li>
              </List>
              <p>
                No pedimos datos sensibles. Te recomendamos no incluirlos en tu lista de deseos ni
                en los mensajes.
              </p>
            </Section>

            <Section title="3. Para qué los usamos y con qué base legal">
              <List>
                <li>
                  <strong>Prestar el servicio</strong> (crear tu cuenta, armar grupos, hacer el
                  sorteo, mostrarte a quién le regalas y avisarte por correo cuando el sorteo se
                  realiza). La base es la ejecución del contrato que aceptas con los{' '}
                  <Link href="/terms" className="text-ink underline underline-offset-[3px]">
                    Términos del Servicio
                  </Link>{' '}
                  (artículo 13 letra c de la Ley 19.628).
                </li>
                <li>
                  <strong>Proteger las cuentas y el servicio</strong> frente a accesos indebidos o
                  abuso. La base es nuestro interés legítimo en mantener el servicio seguro
                  (artículo 13 letra d).
                </li>
              </List>
              <p>
                No usamos tus datos para publicidad, no hacemos perfiles y no usamos herramientas de
                analítica ni de seguimiento.
              </p>
            </Section>

            <Section title="4. Cómo funciona el sorteo">
              <p>
                El sorteo es automático y al azar. Solo respeta dos reglas: nadie se saca a sí mismo
                y se cumplen las exclusiones que haya definido el administrador. No evalúa ningún
                aspecto de tu persona. Cada participante ve únicamente su propia asignación; el
                administrador del grupo tampoco puede ver las de los demás.
              </p>
            </Section>

            <Section title="5. Quién ve tus datos">
              <List>
                <li>
                  <strong>Los miembros de tus grupos</strong> ven tu nombre, correo, foto y lista de
                  deseos, y las exclusiones del grupo.
                </li>
                <li>
                  <strong>Tu amigo secreto</strong> puede leer los mensajes que le envíes, sin saber
                  que son tuyos.
                </li>
                <li>
                  <strong>Proveedores que operan el servicio por nuestra cuenta:</strong> Supabase
                  (base de datos y autenticación), Cloudflare (alojamiento del sitio) y Brevo (envío
                  de correos). Solo pueden usar los datos para prestarnos ese servicio.
                </li>
                <li>
                  <strong>Google</strong>, si eliges entrar con tu cuenta de Google. En ese caso
                  Google trata tus datos según su propia política.
                </li>
              </List>
              <p>No vendemos ni cedemos tus datos a nadie.</p>
            </Section>

            <Section title="6. Transferencia internacional">
              <p>
                Tus datos se almacenan en Estados Unidos (Supabase) y pasan por servidores de
                Cloudflare en distintos países. Los correos se envían a través de Brevo, en la Unión
                Europea. A la fecha de esta versión, la Agencia de Protección de Datos Personales no
                ha determinado si esos países ofrecen un nivel adecuado de protección. Las
                transferencias se amparan en los acuerdos de tratamiento de datos de cada proveedor,
                que incluyen cláusulas contractuales estándar.
              </p>
            </Section>

            <Section title="7. Cuánto tiempo los guardamos">
              <p>
                Mientras tu cuenta exista. Los datos de un grupo se mantienen hasta que el
                administrador lo elimina. Si pides eliminar tu cuenta, borramos tus datos de perfil,
                tus membresías, tus asignaciones y tus mensajes dentro del plazo de respuesta
                indicado más abajo. Los registros técnicos se conservan por el período que define
                cada proveedor.
              </p>
            </Section>

            <Section title="8. Seguridad">
              <List>
                <li>Todo el tráfico va cifrado con HTTPS.</li>
                <li>
                  La base de datos aplica reglas de acceso por fila: cada persona solo puede leer lo
                  que le corresponde, y la asignación del sorteo solo la ve quien regala.
                </li>
                <li>
                  Las contraseñas no se guardan en texto legible y los datos se cifran en reposo en
                  la infraestructura de Supabase.
                </li>
              </List>
            </Section>

            <Section title="9. Tus derechos">
              <p>
                Puedes pedir acceso, rectificación, supresión, oposición y portabilidad de tus
                datos. Escribe a {mail} indicando tu nombre, el correo de tu cuenta y qué necesitas.
                Respondemos dentro de 30 días corridos, plazo que puede extenderse una sola vez por
                otros 30.
              </p>
              <p>
                Si rechazamos tu solicitud o no respondemos a tiempo, puedes reclamar ante la
                Agencia de Protección de Datos Personales.
              </p>
            </Section>

            <Section title="10. Menores de edad">
              <p>
                Si tienes menos de 14 años, necesitas el consentimiento de tu madre, padre o
                representante legal para usar GhostSwap. Si sabemos que se creó una cuenta sin ese
                consentimiento, la eliminaremos.
              </p>
            </Section>

            <Section title="11. Cookies">
              <p>
                Usamos solo las cookies necesarias para mantener tu sesión iniciada. No usamos
                cookies de publicidad ni de seguimiento.
              </p>
            </Section>

            <Section title="12. Cambios a esta política">
              <p>
                Si la cambiamos, publicaremos aquí la nueva versión con su fecha. Si el cambio es
                importante, te avisaremos por correo.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
