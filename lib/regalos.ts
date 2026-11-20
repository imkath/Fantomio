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
        name: 'Perfume Natura Homem Potence, mini de 25 ml',
        why: 'Para el Tulio: un perfume de marca conocida en formato chico, que cabe en el monto y en el bolsillo de la chaqueta.',
        price: 13990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/perfume-homen-potence-mini-para-hombre-natura-25-ml-edp/p/MLC24032936',
        image: '/regalos/segun-31-minutos/perfume-natura-homem-potence-mini.webp',
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
  {
    slug: 'que-regalar-amigo-secreto-5000',
    title: '¿Qué le regalo a mi amigo secreto con $5.000?',
    short: 'Regalos con $5.000',
    description:
      'Ideas de regalo para el amigo secreto que cuestan $5.000 o menos en Chile y que no son el chocolate del supermercado: un cubo Rubik espejo, un UNO No Mercy, luces led y un parlante chico.',
    checked: '2026-11-18',
    cover: '/regalos/regalos-5000/portada.webp',
    products: [
      {
        name: 'Cubo Rubik espejo',
        why: 'Un cubo de 3x3 plateado, con piezas de distinto tamaño. Se arma por forma, no por color.',
        price: 2580,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/cubo-rubik-magico-3x3-mirror-espejo-plateado-resistente/p/MLC45753520',
        image: '/regalos/regalos-5000/cubo-rubik-espejo.webp',
        affiliate: false,
      },
      {
        name: 'Squishy de patita de gato',
        why: 'Para apretar en las reuniones largas.',
        price: 2696,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/squishy-mochi-patita-gato-antiestres-kawaii-juguete-sensorial/p/MLC62719679',
        image: '/regalos/regalos-5000/squishy-de-patita-de-gato.webp',
        affiliate: false,
      },
      {
        name: 'UNO No Mercy',
        why: 'El UNO de siempre, en su versión sin piedad.',
        price: 4406,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/juego-de-cartas-uno-no-mercy-para-2-a-8-jugadores/p/MLC36522632',
        image: '/regalos/regalos-5000/uno-no-mercy.webp',
        affiliate: false,
      },
      {
        name: 'Tira de luces led',
        why: 'Cinco metros de luces de colores, con control remoto.',
        price: 3900,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/tira-led-multicolor-rgb-rollo-de-5-metros-con-control-luz/up/MLCU339437325',
        image: '/regalos/regalos-5000/tira-de-luces-led.webp',
        affiliate: false,
      },
      {
        name: 'Mini parlante bluetooth',
        why: 'Chico, forrado en tela y con radio FM.',
        price: 5000,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/parlante-t5-bluetooth-mini-tela-portable-usb-tf-y-fm/up/MLCU4487635508',
        image: '/regalos/regalos-5000/mini-parlante-bluetooth.webp',
        affiliate: false,
      },
    ],
  },
  {
    slug: 'que-regalar-amigo-secreto-10000',
    title: '¿Qué le regalo a mi amigo secreto con $10.000?',
    short: 'Regalos con $10.000',
    description:
      'Regalos de amigo secreto de menos de $10.000 en Chile que se ven más caros de lo que son, como la lámpara de atardecer, una mini waflera, un capibara de peluche y el juego Virus.',
    checked: '2026-11-18',
    cover: '/regalos/regalos-10000/portada.webp',
    products: [
      {
        name: 'Lámpara de atardecer',
        why: 'Proyecta en la pared el círculo de luz naranja que sale en todos los videos.',
        price: 6980,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-3451565458',
        image: '/regalos/regalos-10000/lampara-de-atardecer.webp',
        affiliate: false,
      },
      {
        name: 'Mini waflera',
        why: 'Hace waffles chicos, de a uno.',
        price: 6224,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/mini-waflera-maquina-waffles-wafleras-reposteria-mini-wafler/up/MLCU66924853',
        image: '/regalos/regalos-10000/mini-waflera.webp',
        affiliate: false,
      },
      {
        name: 'Peluche de capibara',
        why: 'Un capibara de peluche, que no necesita más explicación.',
        price: 6500,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/juguete-de-peluche-de-capibara-navidad-cumpleanos-color-unit/p/MLC28243772',
        image: '/regalos/regalos-10000/peluche-de-capibara.webp',
        affiliate: false,
      },
      {
        name: 'Virus!',
        why: 'Un juego de 70 cartas en que se contagia a los demás.',
        price: 8500,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/juego-de-estrategia-virus-de-tranjis-games-70-cartas/up/MLCU3493103952',
        image: '/regalos/regalos-10000/virus.webp',
        affiliate: false,
      },
      {
        name: 'Guirnalda de luces con pinzas',
        why: 'Luces led con 20 pinzas para colgar fotos.',
        price: 5990,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-1437079157-guirnalda-de-luces-led-clip-para-fotos-decorativa-20pinzas-_JM',
        image: '/regalos/regalos-10000/guirnalda-de-luces-con-pinzas.webp',
        affiliate: false,
      },
    ],
  },
  {
    slug: 'que-regalar-amigo-secreto-30000',
    title: '¿Qué le regalo a mi amigo secreto con $30.000?',
    short: 'Regalos con $30.000',
    description:
      'Para cuando el grupo puso un monto generoso, regalos de amigo secreto entre $19.000 y $27.000 en Chile: LEGO para armar, Hitster en su edición chilena, una libreta Moleskine y una cafetera italiana.',
    checked: '2026-11-18',
    cover: '/regalos/regalos-30000/portada.webp',
    products: [
      {
        name: 'LEGO Cámara Retro',
        why: 'Una cámara antigua para armar, de 261 piezas.',
        price: 25520,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/lego-creator-camara-retro-cantidad-de-piezas-261/p/MLC29387276',
        image: '/regalos/regalos-30000/lego-camara-retro.webp',
        affiliate: false,
      },
      {
        name: 'LEGO Flores de Cerezo',
        why: '430 piezas para armar unas ramas de cerezo en flor que no hay que regar.',
        price: 19138,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/lego-botanicals-flores-de-cerezo-430-piezas/p/MLC29504025',
        image: '/regalos/regalos-30000/lego-flores-de-cerezo.webp',
        affiliate: false,
      },
      {
        name: 'Hitster Chile',
        why: 'Un juego de trivia musical, en su edición chilena.',
        price: 24990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/juego-de-mesa-hitster-chile/p/MLC2044153889',
        image: '/regalos/regalos-30000/hitster-chile.webp',
        affiliate: false,
      },
      {
        name: 'Libreta Moleskine clásica',
        why: 'Mediana, de tapa dura y con hojas lisas, para quien todavía anota a mano.',
        price: 26800,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/moleskine-libreta-clasica-mediana-negra-lisa-pasta-dura/p/MLC28632971',
        image: '/regalos/regalos-30000/libreta-moleskine-clasica.webp',
        affiliate: false,
      },
      {
        name: 'Cafetera italiana Pedrini',
        why: 'De aluminio y para seis tazas, para quien toma café todos los días.',
        price: 24490,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/cafetera-italiana-pedrini-moka-express-de-aluminio-para-6-tazas/p/MLC73553912',
        image: '/regalos/regalos-30000/cafetera-italiana-pedrini.webp',
        affiliate: false,
      },
    ],
  },
  {
    slug: 'regalo-amigo-secreto-para-quien-toma-te',
    title: '¿Qué le regalo a alguien que toma té?',
    short: 'Para la persona del té',
    description:
      'Regalos de amigo secreto de hasta $15.000 en Chile para alguien que toma té y que no son una caja de bolsitas: tés en lata, un libro de té, chai y una tetera con infusor.',
    checked: '2026-11-18',
    cover: '/regalos/regalos-te/portada.webp',
    products: [
      {
        name: 'Té Basilur en lata musical',
        why: 'La lata es una cajita de música con forma de carrusel, así que cuando se acaba el té queda la caja.',
        price: 14300,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/te-basilur-lata-musical-festive-navidad-dorada-75-gr-hojas/p/MLC62543998',
        image: '/regalos/regalos-te/te-basilur-en-lata-musical.webp',
        affiliate: false,
      },
      {
        name: 'Libro de té Basilur',
        why: 'Una lata con forma de libro y cinco tés adentro, para ir probando.',
        price: 9899,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/libro-basilur-vintage-5-tes-piramide-book-lata-navidad-regal/p/MLC2119707050',
        image: '/regalos/regalos-te/libro-de-te-basilur.webp',
        affiliate: false,
      },
      {
        name: 'Earl Grey Akbar en lata',
        why: '225 gramos de té en hoja con bergamota, en una lata con cierre hermético.',
        price: 10791,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/te-negro-en-hoja-akbar-earl-grey-lata-de-225gr/p/MLC21300840',
        image: '/regalos/regalos-te/earl-grey-akbar-en-lata.webp',
        affiliate: false,
      },
      {
        name: 'Chai David Rio Tiger Spice',
        why: 'Chai con especias, en polvo, que se prepara con leche o con agua.',
        price: 11490,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/david-rio-te-chai-tigre-original-lata-398-gramos/p/MLC19538195',
        image: '/regalos/regalos-te/chai-david-rio-tiger-spice.webp',
        affiliate: false,
      },
      {
        name: 'Tetera Doral con infusor',
        why: 'De 0,8 litros y con el infusor incluido, para quien toma té en hoja.',
        price: 6990,
        store: 'Mercado Libre',
        url: 'https://articulo.mercadolibre.cl/MLC-2792796562',
        image: '/regalos/regalos-te/tetera-doral-con-infusor.webp',
        affiliate: false,
      },
      {
        name: 'Té Adagio Earl Grey Bravo',
        why: 'Una lata de 70 gramos de té negro en hoja con bergamota.',
        price: 8990,
        store: 'Mercado Libre',
        url: 'https://www.mercadolibre.cl/adagio-teas-earl-grey-bravo-tin-70-grs/p/MLC26420207',
        image: '/regalos/segun-31-minutos/te-adagio-earl-grey-lata.webp',
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
    title: 'Te tocó la que anda con su tecito para todos lados',
    href: '/regalos/regalo-amigo-secreto-para-quien-toma-te',
    cover: '/regalos/regalos-te/portada.webp',
  },
  {
    title: 'Querido lector, su grupo ha decidido un monto de 30 mil',
    href: '/regalos/que-regalar-amigo-secreto-30000',
    cover: '/regalos/regalos-30000/portada.webp',
  },
  {
    title: 'Con 10 lucas igual puedes quedar bien',
    href: '/regalos/que-regalar-amigo-secreto-10000',
    cover: '/regalos/regalos-10000/portada.webp',
  },
  {
    title: '5 lucas no es excusa para el chocolate del súper',
    href: '/regalos/que-regalar-amigo-secreto-5000',
    cover: '/regalos/regalos-5000/portada.webp',
  },
  {
    title: 'En tu pega hay un Tulio, y lo sabes',
    href: '/regalos/regalo-amigo-secreto-segun-personaje-31-minutos',
    cover: '/regalos/segun-31-minutos/portada.webp',
  },
  {
    title: 'Te tocó alguien de la pega con quien nunca has hablado',
    href: '/regalos/regalo-amigo-secreto-companero-de-trabajo',
    cover: '/regalos/regalos-pega/portada.webp',
  },
  {
    title: 'Tienes 15 lucas y lo único que se te ocurre es una taza',
    href: '/regalos/que-regalar-amigo-secreto-15000',
    cover: '/regalos/regalos-15000/portada.webp',
  },
  {
    title: 'Amigo secreto a ciegas: cómo funciona',
    href: '/#a-ciegas',
    cover: '/regalos/a-ciegas/portada.webp',
  },
]
