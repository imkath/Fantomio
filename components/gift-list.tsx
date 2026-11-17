import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuideArt } from '@/components/guide-art'
import type { GiftList, GiftProduct } from '@/lib/regalos'
import { CREATE_GROUP_HREF } from '@/lib/routes'

export const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

export const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// One product: the cutout on a paper slip, why it works, the price and a way to the store.
// Affiliate links are marked "sponsored" for search engines, as Google asks.
export function GiftCard({ product, index }: { product: GiftProduct; index: number }) {
  return (
    <li className="border-rule flex flex-col overflow-hidden rounded-[6px] border">
      <div className="bg-slip relative aspect-[4/3] overflow-hidden">
        <span className="text-faint absolute top-3 left-4 text-[15px] tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        {/* Static export: images are served as they are, already sized and in webp. */}
        <img
          src={product.image}
          alt=""
          loading={index < 2 ? 'eager' : 'lazy'}
          className="absolute inset-0 m-auto h-[78%] w-[78%] object-contain drop-shadow-[0_14px_16px_rgba(27,27,26,0.16)]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="text-ink text-[20px] leading-snug font-bold">{product.name}</h2>
        <p className="text-graphite leading-relaxed">{product.why}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <span className="text-ink text-[22px] font-bold tabular-nums">{clp(product.price)}</span>
          <Button asChild variant="outline" size="sm">
            <a
              href={product.url}
              target="_blank"
              rel={product.affiliate ? 'sponsored noopener' : 'noopener'}
            >
              Ver en {product.store}
              <ExternalLink aria-hidden="true" />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          </Button>
        </div>
      </div>
    </li>
  )
}

// The way into the app, at the end of every list.
export function CreateGroupAside() {
  return (
    <aside className="border-rule bg-raised grid items-center gap-6 rounded-[6px] border p-6 sm:grid-cols-[1fr_150px] md:p-8">
      <div>
        <h2 className="mb-2 text-xl font-bold">¿Todavía no sortean?</h2>
        <p className="text-graphite mb-5">
          Creas el grupo, mandas el link y Fantomio hace el sorteo. Cada persona anota lo que le
          gustaría y ve solo a quién le regala. Es gratis.
        </p>
        <Button asChild size="lg">
          <Link href={CREATE_GROUP_HREF}>Crear un grupo</Link>
        </Button>
      </div>
      <GuideArt name="reglas" className="text-ink hidden w-full sm:block" />
    </aside>
  )
}

// A list as a card: the carousel cover and its title.
export function GiftListCard({ list }: { list: GiftList }) {
  return (
    <Link
      href={`/regalos/${list.slug}`}
      className="border-rule hover:border-ink group flex h-full flex-col overflow-hidden rounded-[6px] border no-underline transition-colors"
    >
      <img src={list.cover} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
      <span className="p-4">
        <span className="text-ink block leading-snug font-bold text-balance group-hover:underline">
          {list.title}
        </span>
        <span className="text-faint mt-1 block text-[15px]">{list.products.length} ideas</span>
      </span>
    </Link>
  )
}
