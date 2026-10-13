import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  alternates: { canonical: '/forgot-password' },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
