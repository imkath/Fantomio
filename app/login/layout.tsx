import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Entrar a tu Amigo Secreto online | Fantomio' },
  description:
    'Entra a Fantomio con Google o con tu correo para ver tus grupos de Amigo Secreto, a quién le regalas y su lista de deseos.',
  // A form with nothing to read: kept out of search results, links still followed.
  robots: { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
