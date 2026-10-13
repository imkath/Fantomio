import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Entrar a tu Amigo Secreto online | GhostSwap' },
  description:
    'Entra a GhostSwap con Google o con tu correo para ver tus grupos de Amigo Secreto, a quién le regalas y su lista de deseos.',
  alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
