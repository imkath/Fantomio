import Link from 'next/link'
import { GuideLayout, GuideList, GuideSection, guideMetadata } from '@/components/guide'

const SLUG = 'amigo-secreto-por-whatsapp'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function WhatsappPage() {
  return (
    <GuideLayout slug={SLUG}>
      <GuideSection title="El problema de sortear por chat">
        <p>
          Cuando el amigo secreto se arma en un grupo de WhatsApp, lo habitual es que una persona
          haga el sorteo con papelitos o con una app y le mande a cada uno, por interno, a quién le
          tocó. Funciona, pero esa persona queda sabiendo todos los pares, y además no juega con la
          misma sorpresa que el resto.
        </p>
        <p>
          La alternativa es usar el chat solo para coordinar y dejar el sorteo en una herramienta
          donde cada persona vea únicamente su resultado.
        </p>
      </GuideSection>

      <GuideSection title="Paso a paso">
        <GuideList
          ordered
          items={[
            <>
              <strong className="text-ink">Crea el grupo.</strong> Ponle nombre, presupuesto, moneda
              y fecha del intercambio. Toma un minuto.
            </>,
            <>
              <strong className="text-ink">Manda el link al chat.</strong> Copia el link de
              invitación y pégalo en el grupo de WhatsApp. Cada persona entra desde su celular, con
              Google o con su correo.
            </>,
            <>
              <strong className="text-ink">Que cada uno anote su lista.</strong> Lo que le gustaría
              recibir, con links si quiere. Si a alguien le falta, el grupo tiene un botón para
              recordárselo por WhatsApp.
            </>,
            <>
              <strong className="text-ink">Marca quién no se regala con quién.</strong> Por ejemplo,
              parejas que ya se van a hacer un regalo aparte.
            </>,
            <>
              <strong className="text-ink">Sortea.</strong> Hacen falta al menos tres personas. Cada
              una ve en su celular a quién le regala y la lista de esa persona, y le llega un aviso
              por correo. Quien organiza tampoco ve los demás pares.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection title="Si el grupo está lejos">
        <p>
          El amigo secreto a distancia funciona igual, solo cambia la entrega. Algunas formas que
          funcionan:
        </p>
        <GuideList
          items={[
            'Comprar en una tienda en línea y que el regalo llegue directo a la casa de la persona.',
            'Regalar algo digital, como una suscripción, un libro electrónico o una entrada para algo que la persona pueda usar donde vive.',
            'Juntarse por videollamada el día acordado para abrir los regalos al mismo tiempo.',
          ]}
        />
        <p>
          Para pedir la dirección sin delatarte, usa los mensajes anónimos. Le preguntas a quien te
          tocó dónde quiere recibir el regalo y te responde sin saber quién pregunta.
        </p>
      </GuideSection>

      <GuideSection title="Para que el chat no arruine la sorpresa">
        <GuideList
          items={[
            'No comentes en el grupo a quién te tocó, ni en broma.',
            'Las preguntas sobre gustos o tallas, por mensaje anónimo y no por el chat del grupo.',
            'Si alguien se suma tarde, que entre con el mismo link antes del sorteo. Después habría que sortear de nuevo.',
            'Dejen fijado en el chat el presupuesto y la fecha, para no repetirlo cada semana.',
          ]}
        />
        <p>
          Antes de empezar, puede servirte repasar las{' '}
          <Link href="/reglas-amigo-secreto" className={a}>
            reglas del amigo secreto
          </Link>{' '}
          y lo que conviene acordar antes de sortear.
        </p>
      </GuideSection>
    </GuideLayout>
  )
}
