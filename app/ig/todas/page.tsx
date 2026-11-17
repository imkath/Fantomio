import Link from 'next/link'
import { Logo } from '@/components/logo'
import { PostList } from '@/components/post-list'
import { POSTS } from '@/lib/regalos'

export const metadata = {
  title: { absolute: 'Todas las publicaciones | Fantomio' },
  description: 'Todas las publicaciones de Fantomio en Instagram, con sus listas de regalos.',
  robots: { index: false, follow: true },
}

export default function IgAllPage() {
  return (
    <main className="text-ink mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pt-10 pb-12 md:max-w-[880px] md:pt-16">
      <header className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo size="md" />
      </header>
      <nav aria-label="Ruta" className="text-graphite mb-2 text-[15px] font-medium">
        <Link href="/ig" className="hover:text-ink underline underline-offset-[3px]">
          Inicio
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Todas las publicaciones</span>
      </nav>
      <h1 className="mb-6 text-[28px] leading-tight font-light">Todas las publicaciones</h1>
      <PostList posts={POSTS} />
    </main>
  )
}
