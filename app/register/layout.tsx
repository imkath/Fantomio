import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Crear cuenta',
  alternates: { canonical: '/register' },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
