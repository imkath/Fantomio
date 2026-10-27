import Link from 'next/link'
import { GuideLayout, GuideList, GuideSection, guideMetadata } from '@/components/guide'

const SLUG = 'reglas-amigo-secreto'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function ReglasPage() {
  return (
    <GuideLayout slug={SLUG}>
      <GuideSection title="Qué es el amigo secreto">
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
        <GuideList
          ordered
          items={[
            <>
              <strong className="text-ink">Se sortea quién le regala a quién.</strong> Nadie puede
              sacarse a sí mismo y todos regalan y reciben exactamente una vez.
            </>,
            <>
              <strong className="text-ink">El resultado es secreto.</strong> Cada persona sabe solo
              a quién le regala. No se comenta en el grupo ni se le pregunta a otros.
            </>,
            <>
              <strong className="text-ink">Hay un presupuesto.</strong> Se acuerda un monto antes
              del sorteo y todos lo respetan, para que ningún regalo deje mal a nadie.
            </>,
            <>
              <strong className="text-ink">Hay una fecha y un lugar.</strong> El día del intercambio
              cada persona entrega su regalo y ahí se descubre quién era el amigo secreto de cada
              uno.
            </>,
            <>
              <strong className="text-ink">Cada uno anota qué le gustaría.</strong> No es
              obligatorio, pero una lista de deseos evita regalos que terminan en un cajón.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection title="Qué acordar antes del sorteo">
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
        <p>
          En Fantomio todo eso queda en el grupo antes de sortear: el presupuesto con su moneda, la
          fecha del intercambio y quién no le puede regalar a quién.
        </p>
      </GuideSection>

      <GuideSection title="Variantes para hacerlo más entretenido">
        <GuideList
          items={[
            <>
              <strong className="text-ink">Con pistas.</strong> Antes del intercambio cada uno le
              manda a su persona preguntas o pistas sin firmar. En Fantomio se hace con los mensajes
              anónimos. Le escribes a quien te tocó y te responde sin saber que eras tú.
            </>,
            <>
              <strong className="text-ink">A ciegas.</strong> Nadie ve el nombre de quien le tocó
              hasta una fecha, solo su lista. Hay que regalar a partir de lo que la persona
              escribió. Fantomio tiene este modo, y además tapa los nombres en el chat para que
              nadie se delate.
            </>,
            <>
              <strong className="text-ink">Temático.</strong> Todos los regalos siguen una idea,
              como algo hecho a mano, un libro o algo que empiece con la inicial de la persona.
            </>,
            <>
              <strong className="text-ink">Con robo.</strong> En el intercambio, en vez de entregar
              el regalo a una persona, cada uno puede elegir un regalo de la mesa o quitarle uno a
              otro. Es más un juego de grupo que un amigo secreto, y conviene acordarlo antes.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection title="Los casos que siempre aparecen">
        <p>
          <strong className="text-ink">Somos un número impar.</strong> No importa. El amigo secreto
          no forma parejas sino una cadena, así que funciona con cualquier cantidad desde tres
          personas.
        </p>
        <p>
          <strong className="text-ink">Alguien se sumó tarde.</strong> Si el sorteo no se ha hecho,
          entra con el mismo link. Si ya se hizo, quien organiza puede volver a sortear para
          incluirla, sabiendo que cambian todas las asignaciones.
        </p>
        <p>
          <strong className="text-ink">Alguien no puede ir al intercambio.</strong> Puede dejar el
          regalo antes a otra persona o enviarlo, y quien le regalaba a ella puede hacer lo mismo.
          Lo importante es avisar con tiempo.
        </p>
        <p>
          <strong className="text-ink">Alguien se quiere salir después del sorteo.</strong> Si se va
          una persona, a alguien le falta regalo. Lo más justo es volver a sortear entre los que
          quedan, y por eso conviene confirmar participantes antes.
        </p>
      </GuideSection>

      <GuideSection title="La revelación">
        <p>
          En el intercambio cada persona entrega su regalo y se descubre quién le regalaba a quién.
          Si el grupo no se junta, la revelación puede ser al abrir los regalos en una videollamada.
          En Fantomio, después del intercambio, cada uno puede contarle a su persona que fue quien
          le regaló, si quiere. Nadie más del grupo se entera.
        </p>
        <p>
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
