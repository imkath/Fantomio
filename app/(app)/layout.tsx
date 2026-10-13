import type { Metadata } from 'next'
import { AppHeader } from '@/components/app-header'

// Signed-in screens have nothing for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Signed-in screens share this layout, so the header stays mounted while navigating between
// them instead of being rebuilt (and blinking) on every page.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper text-ink min-h-screen">
      <AppHeader />
      {children}
    </div>
  )
}
