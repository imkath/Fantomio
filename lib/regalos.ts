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
    slug: 'regalo-amigo-secreto-segun-personaje-31-minutos',
    title: '¿Qué le regalo según qué personaje de 31 Minutos es?',
    short: 'Según 31 Minutos',
    description:
      'Regalos de amigo secreto para el Tulio, el Bodoque, el Juanín y la Patana de tu grupo: ideas de menos de $15.000 en Chile, ordenadas por personaje.',
    checked: '2026-11-18',
    cover: '/regalos/segun-31-minutos/portada.webp',
    products: [
      {
        name: 'Happy Socks, pack de 2',
        why: 'Para el Tulio: calcetines con dibujos de comida, talla 41 a 46. Se notan desde lejos.',
        price: 8990,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-1976942699-pack-2-calcetines-happy-socks-divertidos-comida-41-46-regalo-_JM',
        image: '/regalos/regalos-15000/happy-socks-pack-de-2.webp',
        affiliate: false,
      },
      {
        name: 'Perfume Kingsman 30 ml',
        why: 'Para el Tulio, en formato de viaje: le alcanza para lucirse toda la temporada.',
        price: 5990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/perfume-maison-alhambra-kingsman-edp-30-ml-hombre/up/MLCU3803483523',
        image: '/regalos/segun-31-minutos/perfume-kingsman-30-ml.webp',
        affiliate: false,
      },
      {
        name: 'Exploding Kittens',
        why: 'Para el Bodoque: un juego de cartas de pura suerte y traición, de partidas cortas.',
        price: 13990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/juego-de-cartas-exploding-kittens-original/p/MLC20752996',
        image: '/regalos/segun-31-minutos/exploding-kittens.webp',
        affiliate: false,
      },
      {
        name: 'Salsa de ají Toro de Camacho Bravo, 100 g',
        why: 'Para el Bodoque que dice que nada le pica. Un ají de frasco chico, de los que se regalan y no de los que se compran en el súper.',
        price: 8082,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/salsa-aji-toro-de-camacho-bravo-100-g/up/MLCU5647075751',
        image: '/regalos/segun-31-minutos/salsa-aji-toro-de-camacho.webp',
        affiliate: false,
      },
      {
        name: 'Antifaz para dormir 3D',
        why: 'Para el Juanín: no aprieta los ojos y sirve para la siesta en el bus.',
        price: 2738,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-1836296762',
        image: '/regalos/segun-31-minutos/antifaz-para-dormir-3d.webp',
        affiliate: false,
      },
      {
        name: 'Vela de soya Casa Viva',
        why: 'Para el Juanín, aroma algodón de azúcar. Una vela que no huele a supermercado.',
        price: 7490,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/vela-aromatica-de-soya-casa-viva-140-grs/up/MLCU3633127942',
        image: '/regalos/segun-31-minutos/vela-de-soya-casa-viva.webp',
        affiliate: false,
      },
      {
        name: 'Té Adagio Earl Grey Bravo, lata de 70 g',
        why: 'Para el Juanín: té en hojas en lata, de ese que se toma con calma. La lata queda de recuerdo.',
        price: 8990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/adagio-teas-earl-grey-bravo-tin-70-grs/p/MLC26420207',
        image: '/regalos/segun-31-minutos/te-adagio-earl-grey-lata.webp',
        affiliate: false,
      },
      {
        name: 'Asesinato en el Orient Express',
        why: 'Para la Patana: el clásico de Agatha Christie, para leer con lápiz y adivinar antes del final.',
        price: 10485,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-3307463156',
        image: '/regalos/segun-31-minutos/asesinato-en-el-orient-express.webp',
        affiliate: false,
      },
      {
        name: 'Rompecabezas de 1000 piezas, constelaciones',
        why: 'Para la Patana: redondo, de mil piezas y sin esquinas que ayuden.',
        price: 8670,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/rompecabezas-12-constelaciones-1000-piezas-circular/p/MLC2055909993',
        image: '/regalos/segun-31-minutos/rompecabezas-12-constelaciones.webp',
        affiliate: false,
      },
    ],
  },
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
    title: '¿Qué le regalo según qué personaje de 31 Minutos es?',
    href: '/regalos/regalo-amigo-secreto-segun-personaje-31-minutos',
    cover: '/regalos/segun-31-minutos/portada.webp',
  },
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
