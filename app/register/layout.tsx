import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Crear cuenta para tu Amigo Secreto online | Fantomio' },
  description:
    'Crea tu cuenta gratis en Fantomio para armar o unirte a un Amigo Secreto online, anotar tu lista de deseos y ver a quién le regalas.',
  // A form with nothing to read: kept out of search results, links still followed.
  robots: { index: false, follow: true },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
