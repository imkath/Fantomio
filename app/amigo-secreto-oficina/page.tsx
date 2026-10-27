import Link from 'next/link'
import { GuideLayout, GuideList, GuideSection, guideMetadata } from '@/components/guide'

const SLUG = 'amigo-secreto-oficina'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function OficinaPage() {
  return (
    <GuideLayout slug={SLUG}>
      <GuideSection title="Lo que hay que decidir primero">
        <p>
          En el trabajo el amigo secreto mezcla personas que se conocen poco, cargos distintos y
          presupuestos personales muy diferentes. Por eso conviene dejar resuelto desde el
          principio:
        </p>
        <GuideList
          items={[
            <>
              <strong className="text-ink">Que sea voluntario.</strong> Se invita a todos, pero
              nadie queda mal por no participar. Un amigo secreto obligado se nota en los regalos.
            </>,
            <>
              <strong className="text-ink">Un presupuesto parejo y concreto.</strong> El mismo monto
              para todos, sin importar el cargo, y lo bastante bajo para que nadie lo sienta como un
              gasto.
            </>,
            <>
              <strong className="text-ink">La fecha del intercambio.</strong> Idealmente en un
              momento en que esté la mayoría, como la última semana antes de las vacaciones o la
              fiesta de fin de año.
            </>,
            <>
              <strong className="text-ink">Qué tipo de regalo.</strong> Algo que se pueda abrir
              frente a todos. Si hay dudas, mejor pedir que cada persona anote su lista.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection title="Grupos grandes">
        <p>
          Con veinte o cuarenta personas, los papelitos se vuelven difíciles: alguien se saca a sí
          mismo, alguien pierde el papel, alguien se suma tarde. Un sorteo en línea resuelve eso,
          porque cada persona entra con el link, anota su lista y ve su resultado en el celular.
        </p>
        <p>
          La lista de deseos ayuda mucho en el trabajo, donde a veces no sabes casi nada de la
          persona que te tocó. Con tres o cuatro ideas concretas el regalo deja de ser una apuesta.
        </p>
      </GuideSection>

      <GuideSection title="Quién no se regala con quién">
        <p>
          Es común excluir a parejas que trabajan juntas o a personas que ya se van a hacer un
          regalo por fuera. En Fantomio quien organiza marca esas excepciones antes de sortear y el
          sorteo las respeta. Si las exclusiones hacen imposible el sorteo, se avisa en vez de dejar
          a alguien sin regalo.
        </p>
      </GuideSection>

      <GuideSection title="Quien organiza también juega">
        <p>
          En la oficina muchas veces organiza alguien de recursos humanos o la persona más ordenada
          del equipo, y lo justo es que juegue con la misma sorpresa que el resto. En Fantomio cada
          persona ve solo a quién le regala y la lista de esa persona. Quien organiza no ve los
          demás pares, y tampoco puede leer las listas de los otros.
        </p>
      </GuideSection>

      <GuideSection title="Si parte del equipo trabaja a distancia">
        <p>
          Lo más simple es acordar que esas personas reciben su regalo en casa, comprado en una
          tienda en línea, y abrir todos juntos por videollamada el día del intercambio. Para pedir
          la dirección sin delatarse están los mensajes anónimos. Hay más ideas en la guía para{' '}
          <Link href="/amigo-secreto-por-whatsapp" className={a}>
            hacerlo por WhatsApp o a distancia
          </Link>
          .
        </p>
      </GuideSection>

      <GuideSection title="Un calendario simple">
        <GuideList
          ordered
          items={[
            'Tres semanas antes: crear el grupo, definir presupuesto y fecha, y mandar el link.',
            'Diez días antes: cerrar inscripciones, revisar que todos anotaron su lista y sortear.',
            'Hasta el intercambio: cada uno compra su regalo y, si quiere, le escribe a su persona por mensaje anónimo.',
            'El día del intercambio: se entregan los regalos y se descubre quién era quién.',
          ]}
        />
        <p>
          Al año siguiente se puede repetir el grupo con las mismas personas, evitando que a alguien
          le toque otra vez quien le tocó antes. Si no sabes qué regalarle a alguien del trabajo,
          revisa las{' '}
          <Link href="/ideas-de-regalo-amigo-secreto" className={a}>
            ideas de regalo según el presupuesto
          </Link>
          .
        </p>
      </GuideSection>
    </GuideLayout>
  )
}
