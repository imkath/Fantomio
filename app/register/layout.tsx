import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Crear cuenta para tu Amigo Secreto online | GhostSwap' },
  description:
    'Crea tu cuenta gratis en GhostSwap para armar o unirte a un Amigo Secreto online, anotar tu lista de deseos y ver a quién le regalas.',
  alternates: { canonical: '/register' },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
