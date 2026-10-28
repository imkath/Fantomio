import Link from 'next/link'
import {
  CalendarDays,
  ClipboardList,
  EyeOff,
  Gift,
  HandCoins,
  Hourglass,
  Shuffle,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  GuideCards,
  GuideLayout,
  GuideList,
  GuideNote,
  GuideSection,
  GuideSteps,
  guideMetadata,
} from '@/components/guide'

const SLUG = 'reglas-amigo-secreto'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function ReglasPage() {
  return (
    <GuideLayout
      slug={SLUG}
      summary={[
        'Cada persona del grupo le regala a otra, sorteada al azar, y nadie sabe quién le regala a quién hasta el intercambio.',
        'Antes de sortear se acuerda quiénes juegan, el presupuesto, la fecha y quién no debería regalarse con quién.',
        'Funciona desde tres personas, con números pares o impares, porque el sorteo forma una cadena y no parejas.',
      ]}
    >
      <GuideSection title="¿Qué es el amigo secreto?">
        <p>
          Es un intercambio de regalos en el que cada persona del grupo le regala a otra, sorteada
          al azar, sin que nadie más sepa quién le regala a quién. En Chile y casi toda
          Latinoamérica se llama amigo secreto, en España amigo invisible y en algunas regiones de
          Brasil amigo oculto. Se juega en familia, entre amistades y en el trabajo, sobre todo en
          diciembre.
        </p>
        <p>
          La gracia está en el secreto. Durante días o semanas sabes a quién le vas a regalar, pero
          no quién te regala a ti, y eso recién se descubre el día del intercambio.
        </p>
      </GuideSection>

      <GuideSection title="Las reglas básicas">
        <GuideSteps
          items={[
            {
              icon: Shuffle,
              title: 'Se sortea quién le regala a quién',
              text: 'Nadie puede sacarse a sí mismo y todos regalan y reciben exactamente una vez.',
            },
            {
              icon: EyeOff,
              title: 'El resultado es secreto',
              text: 'Cada persona sabe solo a quién le regala. No se comenta en el grupo ni se le pregunta a otros.',
            },
            {
              icon: HandCoins,
              title: 'Hay un presupuesto',
              text: 'Se acuerda un monto antes del sorteo y todos lo respetan, para que ningún regalo deje mal a nadie.',
            },
            {
              icon: CalendarDays,
              title: 'Hay una fecha y un lugar',
              text: 'El día del intercambio cada persona entrega su regalo y ahí se descubre quién era el amigo secreto de cada uno.',
            },
            {
              icon: ClipboardList,
              title: 'Cada uno anota qué le gustaría',
              text: 'No es obligatorio, pero una lista de deseos evita regalos que terminan en un cajón.',
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="¿Qué hay que acordar antes del sorteo?">
        <p>
          La mayoría de los problemas del amigo secreto se arreglan antes de sortear. Conviene que
          quien organiza deje claro:
        </p>
        <GuideList
          items={[
            'Quiénes participan, y que cada persona confirme que quiere jugar.',
            'El presupuesto, como un monto concreto y no "algo simbólico".',
            'La fecha y el lugar del intercambio, o cómo se va a enviar el regalo si alguien está lejos.',
            'Si hay personas que no deberían regalarse entre sí, como parejas o hermanos que igual se van a hacer un regalo aparte.',
          ]}
        />
        <GuideNote title="En Fantomio">
          Antes de sortear, en el grupo quedan el presupuesto con su moneda, la fecha, el lugar del
          intercambio y quién no le puede regalar a quién.
        </GuideNote>
      </GuideSection>

      <GuideSection title="Variantes para hacerlo más entretenido">
        <GuideCards
          items={[
            {
              title: 'Con pistas',
              text: 'Antes del intercambio cada uno le manda a su persona preguntas o pistas sin firmar. En Fantomio se hace con los mensajes anónimos. Le escribes a quien te tocó y te responde sin saber que eras tú.',
            },
            {
              title: 'A ciegas',
              text: 'Nadie ve el nombre de quien le tocó hasta una fecha, solo su lista, y hay que regalar a partir de lo que la persona escribió. Fantomio tiene este modo y además tapa los nombres en el chat para que nadie se delate.',
            },
            {
              title: 'Temático',
              text: 'Todos los regalos siguen una idea, como algo hecho a mano, un libro o algo que empiece con la inicial de la persona.',
            },
            {
              title: 'Con robo',
              text: 'En el intercambio, en vez de entregar el regalo a una persona, cada uno puede elegir un regalo de la mesa o quitarle uno a otro. Es más un juego de grupo que un amigo secreto, y conviene acordarlo antes.',
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="Los casos que siempre aparecen">
        <GuideCards
          items={[
            {
              icon: Users,
              title: '¿Y si somos un número impar?',
              text: 'No importa. El amigo secreto no forma parejas sino una cadena, así que funciona con cualquier cantidad desde tres personas.',
            },
            {
              icon: UserPlus,
              title: '¿Y si alguien se suma tarde?',
              text: 'Si el sorteo no se ha hecho, entra con el mismo link. Si ya se hizo, quien organiza puede volver a sortear para incluirla, sabiendo que cambian todas las asignaciones.',
            },
            {
              icon: Hourglass,
              title: '¿Y si alguien no puede ir al intercambio?',
              text: 'Puede dejar el regalo antes a otra persona o enviarlo, y quien le regalaba a ella puede hacer lo mismo. Lo importante es avisar con tiempo.',
            },
            {
              icon: UserMinus,
              title: '¿Y si alguien se quiere salir después del sorteo?',
              text: 'A alguien le faltaría regalo. Lo más justo es volver a sortear entre los que quedan, y por eso conviene confirmar participantes antes.',
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="¿Cómo es la revelación?">
        <p>
          En el intercambio cada persona entrega su regalo y se descubre quién le regalaba a quién.
          Si el grupo no se junta, la revelación puede ser al abrir los regalos en una videollamada.
        </p>
        <GuideNote title="En Fantomio">
          Después del intercambio, cada uno puede contarle a su persona que fue quien le regaló, si
          quiere. Nadie más del grupo se entera.
        </GuideNote>
        <p>
          <Gift aria-hidden="true" className="text-graphite mr-1.5 inline size-5 align-[-0.2em]" />
          Si van a organizarlo por chat, sigue con la guía para{' '}
          <Link href="/amigo-secreto-por-whatsapp" className={a}>
            hacer el amigo secreto por WhatsApp
          </Link>
          , y si no se te ocurre qué regalar, revisa las{' '}
          <Link href="/ideas-de-regalo-amigo-secreto" className={a}>
            ideas de regalo según el presupuesto
          </Link>
          .
        </p>
      </GuideSection>
    </GuideLayout>
  )
}
