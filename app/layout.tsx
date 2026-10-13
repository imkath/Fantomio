import type React from 'react'
import type { Metadata, Viewport } from 'next'
import { Zen_Kaku_Gothic_New, Dela_Gothic_One, Atkinson_Hyperlegible_Next } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { AnimatedFavicon } from '@/components/animated-favicon'
import './globals.css'

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-sans',
})

// Only for the wordmark and a few display moments.
const delaGothic = Dela_Gothic_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
})

// Small details (labels, metadata, codes). Built for low vision: l, 1, I, 0 and O never mix up.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-detail',
  // next/font has no fallback metrics for this family yet.
  adjustFontFallback: false,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#131312' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://ghostswap.nvrkth.com'),
  title: {
    default: 'GhostSwap - Organiza tu Amigo Secreto Online Gratis',
    template: '%s | GhostSwap',
  },
  description:
    'Organiza tu Amigo Secreto o intercambio de regalos online gratis con GhostSwap. Sorteos automáticos, listas de deseos y compartir por WhatsApp. La mejor app para Secret Santa en español.',
  keywords: [
    'amigo secreto',
    'amigo secreto online',
    'sorteo amigo secreto',
    'intercambio de regalos',
    'secret santa',
    'secret santa online',
    'sorteo navidad',
    'amigo invisible',
    'intercambio navideño',
    'sorteo de regalos',
    'organizar amigo secreto',
    'app amigo secreto gratis',
  ],
  authors: [{ name: 'GhostSwap' }],
  creator: 'GhostSwap',
  publisher: 'GhostSwap',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://ghostswap.nvrkth.com',
    siteName: 'GhostSwap',
    title: 'GhostSwap - Organiza tu Amigo Secreto Online Gratis',
    description:
      'Organiza tu Amigo Secreto o intercambio de regalos online gratis. Sorteos automáticos, listas de deseos y comparte por WhatsApp.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GhostSwap - Amigo Secreto Online',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GhostSwap - Organiza tu Amigo Secreto Online Gratis',
    description:
      'Organiza tu Amigo Secreto o intercambio de regalos online gratis. Sorteos automáticos y listas de deseos.',
    images: ['/og-image.png'],
    creator: '@ghostswap',
  },
  alternates: {
    canonical: 'https://ghostswap.nvrkth.com',
    languages: {
      es: 'https://ghostswap.nvrkth.com',
    },
  },
  category: 'technology',
  verification: {
    // google: 'tu-codigo-de-verificacion', // Agregar cuando tengas Google Search Console
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${zenKaku.variable} ${delaGothic.variable} ${atkinson.variable} bg-background text-foreground min-h-screen font-sans antialiased`}
      >
        {/* Light by default: most people organizing a family or office exchange expect it. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AnimatedFavicon />
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
