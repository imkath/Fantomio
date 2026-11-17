import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Post } from '@/lib/regalos'

// Posts as rows on a phone (cover, title, arrow) and as an Instagram-like grid on a desktop.
export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-3 md:gap-5">
      {posts.map((post) => (
        <li key={post.href}>
          <Link
            href={post.href}
            className="border-rule hover:border-ink group flex h-full items-center gap-4 rounded-[6px] border p-2.5 pr-4 no-underline transition-colors md:flex-col md:items-stretch md:gap-3 md:p-3"
          >
            <img
              src={post.cover}
              alt=""
              loading="lazy"
              className="aspect-[4/5] w-[72px] shrink-0 rounded-[4px] object-cover md:w-full"
            />
            <span className="text-ink flex-1 leading-snug font-medium group-hover:underline">
              {post.title}
            </span>
            <ChevronRight aria-hidden="true" className="text-faint size-5 shrink-0 md:hidden" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
