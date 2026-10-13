import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Contraseña nueva | GhostSwap' },
  description: 'Elige una contraseña nueva para tu cuenta de GhostSwap.',
  alternates: { canonical: '/reset-password' },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
