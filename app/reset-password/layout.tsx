import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Contraseña nueva | Fantomio' },
  description: 'Elige una contraseña nueva para tu cuenta de Fantomio.',
  // Reached only from a recovery link: nothing here belongs in search results.
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
