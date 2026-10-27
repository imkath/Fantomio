// The guides: real questions people search for (rules, WhatsApp, office, gift ideas), each
// answered in full on its own page. `updated` is the date the content last changed for real;
// the sitemap reads it, so bump it only when the text changes.
export interface Guide {
  slug: string
  title: string
  // Short name for links and breadcrumbs.
  short: string
  description: string
  updated: string
}

export const GUIDES: Guide[] = [
  {
    slug: 'reglas-amigo-secreto',
    title: 'Reglas del amigo secreto: cómo se juega, paso a paso',
    short: 'Reglas del amigo secreto',
    description:
      'Las reglas del amigo secreto (o amigo invisible), qué acordar antes del sorteo, variantes para hacerlo más entretenido y qué hacer si alguien se suma tarde o no puede ir.',
    updated: '2026-10-27',
  },
  {
    slug: 'amigo-secreto-por-whatsapp',
    title: 'Cómo hacer un amigo secreto por WhatsApp o a distancia',
    short: 'Amigo secreto por WhatsApp',
    description:
      'Cómo organizar el amigo secreto desde un grupo de WhatsApp sin que nadie sepa todos los pares, y cómo hacerlo a distancia cuando el grupo no se puede juntar.',
    updated: '2026-10-27',
  },
  {
    slug: 'amigo-secreto-oficina',
    title: 'Amigo secreto en la oficina: guía para organizarlo bien',
    short: 'Amigo secreto en la oficina',
    description:
      'Qué decidir antes, cómo manejar grupos grandes, presupuesto parejo, personas que trabajan a distancia y un calendario simple para el amigo secreto del trabajo.',
    updated: '2026-10-27',
  },
  {
    slug: 'ideas-de-regalo-amigo-secreto',
    title: 'Ideas de regalo para el amigo secreto, según el presupuesto',
    short: 'Ideas de regalo',
    description:
      'Ideas de regalo para el amigo secreto ordenadas por presupuesto, para cuando no conoces bien a la persona, para regalos que se envían y qué conviene evitar.',
    updated: '2026-10-27',
  },
]

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug)!
