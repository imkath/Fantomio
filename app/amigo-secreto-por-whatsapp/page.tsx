import Link from 'next/link'
import {
  ClipboardList,
  Gift,
  Link2,
  MonitorSmartphone,
  Send,
  Shuffle,
  UserX,
  Video,
} from 'lucide-react'
import {
  GuideCards,
  GuideChat,
  GuideCompare,
  GuideDont,
  GuideLayout,
  GuideNote,
  GuideSection,
  GuideSteps,
  guideMetadata,
} from '@/components/guide'

const SLUG = 'amigo-secreto-por-whatsapp'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function WhatsappPage() {
  return (
    <GuideLayout
      slug={SLUG}
      summary={[
        'Usa el grupo de WhatsApp solo para coordinar y deja el sorteo en una herramienta donde cada persona vea únicamente su resultado.',
        'Mandas un link al chat, cada uno entra desde su celular, anota su lista y, al sortear, ve a quién le regala.',
        'A distancia funciona igual. El regalo se manda a domicilio o es digital, y se abren todos juntos por videollamada.',
      ]}
    >
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
        <GuideChat
          title="Navidad familia"
          lines={[
            {
              who: 'Tú',
              me: true,
              text: 'Armé el amigo secreto. Entren acá, anoten su lista y el domingo sorteo',
            },
            { who: 'Tú', me: true, link: true, text: 'fantomio.com/join?code=…' },
            { who: 'Javiera', text: 'Listo, ya anoté la mía' },
            { who: 'Tomás', text: '¿Cuánto era el presupuesto?' },
            { who: 'Tú', me: true, text: 'Sí, está en el grupo junto con la fecha' },
          ]}
        />
      </GuideSection>

      <GuideSection title="¿Un link para cada uno o una cuenta?">
        <p>
          Algunas herramientas mandan a cada persona un link con su resultado, sin pedir cuenta. Es
          rápido, pero ese link es el resultado mismo.
        </p>
        <GuideCompare
          left={{
            title: 'Un link con el resultado',
            points: [
              'Si alguien lo reenvía por error al grupo, cualquiera lo ve.',
              'Si quien organiza escribe mal un correo, el resultado le llega a otra persona.',
              'Sirve para entregar el resultado y poco más.',
            ],
          }}
          right={{
            title: 'Una cuenta',
            points: [
              'Cada uno entra con su propio Google o correo y solo ve lo suyo.',
              'Tu lista la ve solo quien te regala.',
              'Preguntas anónimas durante semanas y los grupos guardados para el año siguiente.',
            ],
          }}
        />
      </GuideSection>

      <GuideSection title="Paso a paso">
        <GuideSteps
          items={[
            {
              icon: Gift,
              title: 'Crea el grupo',
              text: 'Ponle nombre, presupuesto, moneda, fecha y lugar del intercambio. Toma un minuto.',
            },
            {
              icon: Send,
              title: 'Manda el link al chat',
              text: 'Copia el link de invitación y pégalo en el grupo de WhatsApp. Cada persona entra desde su celular, con Google o con su correo.',
            },
            {
              icon: ClipboardList,
              title: 'Que cada uno anote su lista',
              text: 'Lo que le gustaría recibir, con links si quiere. Si a alguien le falta, el grupo tiene un botón para recordárselo por WhatsApp.',
            },
            {
              icon: UserX,
              title: 'Marca quién no se regala con quién',
              text: 'Por ejemplo, parejas que ya se van a hacer un regalo aparte.',
            },
            {
              icon: Shuffle,
              title: 'Sortea',
              text: 'Hacen falta al menos tres personas. Cada una ve en su celular a quién le regala y la lista de esa persona, y le llega un aviso por correo. Quien organiza tampoco ve los demás pares.',
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="¿Cómo se hace si el grupo está lejos?">
        <p>El amigo secreto a distancia funciona igual, solo cambia la entrega.</p>
        <GuideCards
          items={[
            {
              icon: Link2,
              title: 'Comprar en línea',
              text: 'El regalo llega directo a la casa de la persona desde una tienda con despacho.',
            },
            {
              icon: MonitorSmartphone,
              title: 'Regalar algo digital',
              text: 'Una suscripción, un libro electrónico o una entrada para algo que la persona pueda usar donde vive.',
            },
            {
              icon: Video,
              title: 'Abrir juntos por videollamada',
              text: 'El día acordado se conectan todos y abren los regalos al mismo tiempo.',
            },
          ]}
        />
        <GuideNote title="Para pedir la dirección sin delatarte">
          Usa los mensajes anónimos. Le preguntas a quien te tocó dónde quiere recibir el regalo y
          te responde sin saber quién pregunta.
        </GuideNote>
      </GuideSection>

      <GuideSection title="Para que el chat no arruine la sorpresa">
        <GuideDont
          items={[
            'Comentar en el grupo a quién te tocó, ni en broma.',
            'Preguntar gustos o tallas por el chat del grupo. Eso va por mensaje anónimo.',
            'Sumar gente después del sorteo. Que entren con el mismo link antes, o habrá que sortear de nuevo.',
            'Repetir cada semana el presupuesto y la fecha. Déjenlos fijados en el chat.',
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
