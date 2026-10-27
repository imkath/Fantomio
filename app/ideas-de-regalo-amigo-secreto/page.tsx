import Link from 'next/link'
import { GuideLayout, GuideList, GuideSection, guideMetadata } from '@/components/guide'

const SLUG = 'ideas-de-regalo-amigo-secreto'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function IdeasPage() {
  return (
    <GuideLayout slug={SLUG}>
      <GuideSection title="Antes de buscar, mira su lista">
        <p>
          La mejor idea casi siempre es la que la persona ya escribió. Si el grupo usa listas de
          deseos, parte por ahí y elige algo que calce con el presupuesto. Si no anotó nada, puedes
          preguntarle por mensaje anónimo qué le gusta, sin que sepa que eres tú.
        </p>
        <p>
          Los montos cambian mucho entre países y monedas, así que esta guía ordena las ideas por
          tramo de presupuesto y no por precio exacto. En Fantomio cada grupo fija su monto en la
          moneda que usa, ya sea en pesos chilenos, mexicanos, argentinos o colombianos, soles,
          reales, euros, dólares o libras.
        </p>
      </GuideSection>

      <GuideSection title="Presupuesto bajo">
        <GuideList
          items={[
            'Una taza o un vaso térmico con algo que tenga que ver con la persona.',
            'Un cuaderno bonito, un set de lápices o marcadores.',
            'Chocolates, té o café de una marca que no compraría para sí misma.',
            'Una planta pequeña o un kit para cultivar hierbas.',
            'Calcetines entretenidos o un gorro, si sabes la talla o el estilo.',
            'Un llavero, un marcapáginas o un imán hecho por alguien de la zona.',
          ]}
        />
      </GuideSection>

      <GuideSection title="Presupuesto medio">
        <GuideList
          items={[
            'Un libro de un tema que le guste, mejor si dejó pistas en su lista.',
            'Un juego de mesa corto o un rompecabezas.',
            'Audífonos simples, un cargador portátil o un soporte para el celular.',
            'Una vela aromática, sales de baño o algo para relajarse.',
            'Un accesorio para su pasatiempo, como cocina, deporte, jardinería o dibujo.',
            'Una gift card de una tienda que use seguido.',
          ]}
        />
      </GuideSection>

      <GuideSection title="Presupuesto más alto">
        <GuideList
          items={[
            'Un parlante portátil o un reloj despertador con luz.',
            'Una experiencia, como entradas al cine, a un concierto o a un taller.',
            'Una mochila o un bolso de buena calidad.',
            'Un set de cocina o un utensilio que quería y no se ha comprado.',
            'Una suscripción por algunos meses a algo que ya usa.',
          ]}
        />
      </GuideSection>

      <GuideSection title="Si no conoces bien a la persona">
        <p>
          Pasa mucho en el trabajo o en grupos grandes. Lo que suele funcionar es algo útil y bonito
          a la vez, que sirva casi a cualquiera: una buena taza, algo rico para comer, un cuaderno,
          una planta. Evita regalos muy personales, como perfume o ropa, si no sabes sus gustos o su
          talla.
        </p>
      </GuideSection>

      <GuideSection title="Si hay que enviarlo">
        <p>
          Cuando el grupo está lejos, conviene comprar en una tienda que despache a domicilio y
          mandar el regalo directo a la persona, o elegir algo digital como una gift card o una
          suscripción. La guía para{' '}
          <Link href="/amigo-secreto-por-whatsapp" className={a}>
            hacer el amigo secreto a distancia
          </Link>{' '}
          explica cómo pedir la dirección sin delatarte.
        </p>
      </GuideSection>

      <GuideSection title="Lo que conviene evitar">
        <GuideList
          items={[
            'Pasarse del presupuesto, aunque sea para bien. Deja mal al resto.',
            'Regalos de broma que pueden incomodar, sobre todo en el trabajo.',
            'Comida si no sabes de alergias o dietas.',
            'Algo que obligue a la persona a gastar más, como un aparato sin el accesorio que necesita.',
          ]}
        />
        <p>
          Y si todavía no arman el grupo, empieza por las{' '}
          <Link href="/reglas-amigo-secreto" className={a}>
            reglas del amigo secreto
          </Link>
          .
        </p>
      </GuideSection>
    </GuideLayout>
  )
}
