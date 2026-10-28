import Link from 'next/link'
import { Package, UserRound } from 'lucide-react'
import {
  GuideCards,
  GuideDont,
  GuideLayout,
  GuideNote,
  GuideSection,
  GuideTags,
  guideMetadata,
} from '@/components/guide'

const SLUG = 'ideas-de-regalo-amigo-secreto'
export const metadata = guideMetadata(SLUG)

const a = 'text-ink underline underline-offset-[3px]'

export default function IdeasPage() {
  return (
    <GuideLayout
      slug={SLUG}
      summary={[
        'La mejor idea casi siempre es la que la persona ya anotó en su lista.',
        'Con presupuesto bajo funcionan las cosas útiles y bonitas, como una taza, un cuaderno, algo rico o una planta.',
        'Si no conoces bien a la persona, evita lo muy personal, como perfume o ropa, y nunca te pases del presupuesto.',
      ]}
    >
      <GuideSection title="Antes de buscar, mira su lista">
        <p>
          La mejor idea casi siempre es la que la persona ya escribió. Si el grupo usa listas de
          deseos, parte por ahí y elige algo que calce con el presupuesto. Si no anotó nada, puedes
          preguntarle por mensaje anónimo qué le gusta, sin que sepa que eres tú.
        </p>
        <GuideNote title="Por tramo, no por precio">
          Los montos cambian mucho entre países, así que las ideas van por tramo de presupuesto. En
          Fantomio cada grupo fija su monto en su moneda, ya sea en pesos chilenos, mexicanos,
          argentinos o colombianos, soles, reales, euros, dólares o libras.
        </GuideNote>
      </GuideSection>

      <GuideSection title="Ideas según el presupuesto">
        <GuideTags
          tiers={[
            {
              title: 'Presupuesto bajo',
              items: [
                'Una taza o un vaso térmico con algo que tenga que ver con la persona.',
                'Un cuaderno bonito, un set de lápices o marcadores.',
                'Chocolates, té o café de una marca que no compraría para sí misma.',
                'Una planta pequeña o un kit para cultivar hierbas.',
                'Calcetines entretenidos o un gorro, si sabes la talla o el estilo.',
                'Un llavero, un marcapáginas o un imán hecho por alguien de la zona.',
              ],
            },
            {
              title: 'Presupuesto medio',
              items: [
                'Un libro de un tema que le guste, mejor si dejó pistas en su lista.',
                'Un juego de mesa corto o un rompecabezas.',
                'Audífonos simples, un cargador portátil o un soporte para el celular.',
                'Una vela aromática, sales de baño o algo para relajarse.',
                'Un accesorio para su pasatiempo, como cocina, deporte, jardinería o dibujo.',
                'Una gift card de una tienda que use seguido.',
              ],
            },
            {
              title: 'Presupuesto más alto',
              items: [
                'Un parlante portátil o un reloj despertador con luz.',
                'Una experiencia, como entradas al cine, a un concierto o a un taller.',
                'Una mochila o un bolso de buena calidad.',
                'Un set de cocina o un utensilio que quería y no se ha comprado.',
                'Una suscripción por algunos meses a algo que ya usa.',
              ],
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="Dos casos difíciles">
        <GuideCards
          items={[
            {
              icon: UserRound,
              title: '¿Qué le regalo si no la conozco bien?',
              text: 'Pasa mucho en el trabajo o en grupos grandes. Funciona algo útil y bonito a la vez, que sirva casi a cualquiera, como una buena taza, algo rico para comer, un cuaderno o una planta. Evita lo muy personal, como perfume o ropa, si no sabes sus gustos o su talla.',
            },
            {
              icon: Package,
              title: '¿Y si hay que enviarlo?',
              text: 'Compra en una tienda que despache a domicilio y manda el regalo directo a la persona, o elige algo digital como una gift card o una suscripción.',
            },
          ]}
        />
        <p>
          La guía para{' '}
          <Link href="/amigo-secreto-por-whatsapp" className={a}>
            hacer el amigo secreto a distancia
          </Link>{' '}
          explica cómo pedir la dirección sin delatarte.
        </p>
      </GuideSection>

      <GuideSection title="Lo que conviene evitar">
        <GuideDont
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
