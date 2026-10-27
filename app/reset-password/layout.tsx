import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Contraseña nueva | Fantomio' },
  description: 'Elige una contraseña nueva para tu cuenta de Fantomio.',
  alternates: { canonical: '/reset-password' },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
