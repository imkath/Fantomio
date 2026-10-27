import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Recuperar contraseña | Fantomio' },
  description:
    'Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva en Fantomio.',
  alternates: { canonical: '/forgot-password' },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
