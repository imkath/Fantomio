import type React from 'react'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Atkinson_Hyperlegible_Next } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { AnimatedFavicon } from '@/components/animated-favicon'
import './globals.css'

// Zen Kaku Gothic New and Dela Gothic One are self-hosted and subset to Latin (see
// app/fonts/README.md): from Google they came as Japanese fonts in ~120 slices per weight and
// next/font preloaded all of them, about 5 MB per page.
const zenKaku = localFont({
  src: [
    { path: './fonts/ZenKakuGothicNew-Light.woff2', weight: '300' },
    { path: './fonts/ZenKakuGothicNew-Regular.woff2', weight: '400' },
    { path: './fonts/ZenKakuGothicNew-Medium.woff2', weight: '500' },
    { path: './fonts/ZenKakuGothicNew-Bold.woff2', weight: '700' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

// Only for the wordmark and a few display moments.
const delaGothic = localFont({
  src: './fonts/DelaGothicOne-Regular.woff2',
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

// Small details (labels, metadata, codes). Built for low vision: l, 1, I, 0 and O never mix up.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-detail',
  // next/font has no fallback metrics for this family yet.
  adjustFontFallback: false,
})

const THEME_SCRIPT = `window.__name=window.__name||function(f){return f};(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.add(d?'dark':'light');e.style.colorScheme=d?'dark':'light'}catch(_){}})()`

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
        {/* Sets the theme before anything paints: the saved choice, or the system's if none.
            It also defines __name, a helper the build wraps next-themes' inline script with
            and that otherwise doesn't exist in the browser (a ReferenceError in the console).
            next-themes' own script sits in <body> and runs after the CSS loads, which let the
            page paint light first and then switch. Fixed text, no user data. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${zenKaku.variable} ${delaGothic.variable} ${atkinson.variable} bg-background text-foreground min-h-screen font-sans antialiased`}
      >
        {/* Follows the system until the person picks a theme with the switch. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
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
