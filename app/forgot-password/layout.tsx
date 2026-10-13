import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Recuperar contraseña | GhostSwap' },
  description:
    'Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva en GhostSwap.',
  alternates: { canonical: '/forgot-password' },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
