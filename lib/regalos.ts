// Gift lists: the same picks as the Instagram carousels, each one a page people land on from
// the bio link (and from search). Prices are checked on `checked`; when a store link becomes an
// affiliate link, mark it with `affiliate: true` so the page says so.
export type Store = 'Mercado Libre' | 'Falabella'

export interface GiftProduct {
  name: string
  // Why it works as a gift, in one or two short sentences.
  why: string
  // Whole pesos (CLP).
  price: number
  store: Store
  url: string
  // Cutout on a transparent background, served from /public.
  image: string
  affiliate: boolean
}

export interface GiftList {
  slug: string
  title: string
  // Short name for links, breadcrumbs and the bio page.
  short: string
  description: string
  // The date the prices were checked. The sitemap reads it.
  checked: string
  // First slide of the carousel.
  cover: string
  products: GiftProduct[]
}

export const GIFT_LISTS: GiftList[] = [
  {
    slug: 'que-regalar-amigo-secreto-15000',
    title: '¿Qué le regalo a mi amigo secreto con $15.000?',
    short: 'Regalos con $15.000',
    description:
      'Seis ideas de regalo para el amigo secreto que cuestan menos de $15.000 en Chile y que no son una taza: juegos de cartas, una planta carnívora, calcetines y más.',
    checked: '2026-11-17',
    cover: '/regalos/regalos-15000/portada.webp',
    products: [
      {
        name: 'The Mind',
        why: 'Un juego de cartas donde no se puede hablar. Se juega en equipo y engancha al tiro.',
        price: 12990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/the-mind-espanol-juego-de-cartas-fractal-juegos/p/MLC16192502',
        image: '/regalos/regalos-15000/the-mind.webp',
        affiliate: false,
      },
      {
        name: 'Kit de cultivo de Venus atrapamoscas',
        why: 'Una planta carnívora para el escritorio. Seguro nadie más se la regala.',
        price: 12900,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-3341627662',
        image: '/regalos/regalos-15000/kit-de-cultivo-de-venus-atrapamoscas.webp',
        affiliate: false,
      },
      {
        name: 'Happy Socks, pack de 2',
        why: 'Calcetines con diseño de comida, talla 41 a 46. Se notan, y eso es lo gracioso.',
        price: 8990,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-1976942699-pack-2-calcetines-happy-socks-divertidos-comida-41-46-regalo-_JM',
        image: '/regalos/regalos-15000/happy-socks-pack-de-2.webp',
        affiliate: false,
      },
      {
        name: 'Vaso térmico Buffer 380 ml',
        why: 'Para el café que siempre se le enfría. Cierra bien y cabe en la mochila.',
        price: 10990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/termo-para-cafe-mug-buffer-vaso-termico-380ml-13oz-sellable-verdigris/p/MLC25855262',
        image: '/regalos/regalos-15000/vaso-termico-buffer-380-ml.webp',
        affiliate: false,
      },
      {
        name: 'Lámpara de nube recargable',
        why: 'Se pega con imán y tiene tres niveles de luz. Para el velador o el escritorio.',
        price: 8536,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/lampara-de-noche-led-con-diseno-de-nube-magnetica-recargable-y-3-niveles-de-brillo-para-bebe/p/MLC54973533',
        image: '/regalos/regalos-15000/lampara-de-nube-recargable.webp',
        affiliate: false,
      },
      {
        name: 'Dobble',
        why: 'El clásico de encontrar el dibujo repetido. Partidas cortas, desde los 6 años.',
        price: 9990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/zygomatic-dobble-juego-de-cartas-clasico-juego-de-mesa/p/MLC18021199',
        image: '/regalos/regalos-15000/dobble.webp',
        affiliate: false,
      },
    ],
  },
  {
    slug: 'regalo-amigo-secreto-companero-de-trabajo',
    title: '¿Qué le regalo al de la pega que no conozco?',
    short: 'Para el de la pega',
    description:
      'Regalos para el amigo secreto de la oficina cuando no conoces a la persona: cosas útiles y bonitas, de menos de $10.000 en Chile, que le sirven a cualquiera.',
    checked: '2026-11-17',
    cover: '/regalos/regalos-pega/portada.webp',
    products: [
      {
        name: 'Botella térmica Yaku 600 ml',
        why: 'De acero inoxidable, para frío o calor. Es de esas cosas que se usan todos los días.',
        price: 8990,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-2174715261',
        image: '/regalos/regalos-pega/botella-termica-yaku-600-ml.webp',
        affiliate: false,
      },
      {
        name: 'Alzador de aluminio para notebook',
        why: 'Sube la pantalla a la altura de los ojos. El cuello lo agradece.',
        price: 8990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/soporte-base-alzador-aluminio-para-notebook-y-macbook-10-18-linkon/p/MLC28651953',
        image: '/regalos/regalos-pega/alzador-de-aluminio-para-notebook.webp',
        affiliate: false,
      },
      {
        name: 'Lámpara de mesa táctil',
        why: 'Se prende con un toque y tiene tres tonos de luz. Queda bien en cualquier escritorio.',
        price: 8040,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-4351518622',
        image: '/regalos/regalos-pega/lampara-de-mesa-tactil.webp',
        affiliate: false,
      },
      {
        name: 'Lithops, la planta piedra',
        why: 'Una suculenta que parece piedra. Casi no hay que regarla.',
        price: 4291,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-485755085',
        image: '/regalos/regalos-pega/lithops-la-planta-piedra.webp',
        affiliate: false,
      },
      {
        name: 'Libreta Sakura de bolsillo',
        why: '9 x 14 cm, hojas crema con líneas. Para anotar en las reuniones.',
        price: 7290,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/libreta-sakura-sketchbook-con-hoja-crema-y-lineas-negra-de-9x14-cm/p/MLC63231392',
        image: '/regalos/regalos-pega/libreta-sakura-de-bolsillo.webp',
        affiliate: false,
      },
    ],
  },
]

export const giftListBySlug = (slug: string) => GIFT_LISTS.find((l) => l.slug === slug)

// The Instagram bio page (/ig): every post, newest first. A post with products points to its
// list; the others point wherever the post sends people.
export interface Post {
  title: string
  href: string
  cover: string
}

export const POSTS: Post[] = [
  {
    title: '¿Qué le regalo al de la pega que no conozco?',
    href: '/regalos/regalo-amigo-secreto-companero-de-trabajo',
    cover: '/regalos/regalos-pega/portada.webp',
  },
  {
    title: '¿Qué le regalo a mi amigo secreto con $15.000?',
    href: '/regalos/que-regalar-amigo-secreto-15000',
    cover: '/regalos/regalos-15000/portada.webp',
  },
  {
    title: 'Amigo secreto a ciegas: cómo funciona',
    href: '/#a-ciegas',
    cover: '/regalos/a-ciegas/portada.webp',
  },
]
