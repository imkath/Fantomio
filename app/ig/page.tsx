import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { PostList } from '@/components/post-list'
import { POSTS } from '@/lib/regalos'
import { CREATE_GROUP_HREF } from '@/lib/routes'

// A 3 x 3 grid on a desktop; the rest live on /ig/todas.
const LATEST = 9

// The Instagram bio link. People arrive on a phone wanting the thing from the post they just
// saw, so the posts come first, as big rows, and the app is one button away. It points to the
// pages that rank; it doesn't need to rank itself.
export const metadata = {
  title: { absolute: 'Fantomio en Instagram' },
  description:
    'Las listas de regalos de nuestras publicaciones y el link para armar tu amigo secreto.',
  robots: { index: false, follow: true },
}

export default function IgPage() {
  return (
    <main className="text-ink mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pt-10 pb-12 md:max-w-[880px] md:pt-16">
      <header className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size="lg" />
        <p className="text-graphite text-[17px]">Amigo secreto online, gratis.</p>
      </header>

      <Button asChild size="lg" className="mb-3 w-full md:mx-auto md:w-[360px]">
        <Link href={CREATE_GROUP_HREF}>Crear un grupo</Link>
      </Button>
      <Link
        href="/"
        className="text-graphite hover:text-ink mb-10 text-center text-[15px] underline underline-offset-[3px]"
      >
        Qué es Fantomio
      </Link>

      <h1 className="mb-4 text-[22px] font-bold md:mb-6 md:text-center">Lo de las publicaciones</h1>
      <PostList posts={POSTS.slice(0, LATEST)} />
      {POSTS.length > LATEST && (
        <Button asChild variant="outline" className="mt-5 w-full md:mx-auto md:w-[360px]">
          <Link href="/ig/todas">Ver todas las publicaciones ({POSTS.length})</Link>
        </Button>
      )}

      <nav aria-label="Más" className="text-graphite mt-10 flex justify-center gap-2 text-[15px]">
        <Link href="/regalos" className="hover:text-ink underline underline-offset-[3px]">
          Todas las listas
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/guias" className="hover:text-ink underline underline-offset-[3px]">
          Guías
        </Link>
      </nav>
    </main>
  )
}
