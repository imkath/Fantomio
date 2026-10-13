import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// On wide screens it floats in the left margin, outside the content column; on narrower
// ones it sits above the content. 1440px is where the margin fits the full label. On wide
// screens it lines up with the first line of content.
export function BackLink({ href = '/dashboard', children = 'Volver a mis grupos' }) {
  return (
    <div className="relative min-[1440px]:h-0">
      <Link
        href={href}
        className="text-graphite hover:text-ink inline-flex min-h-11 items-center gap-2 text-[15px] whitespace-nowrap min-[1440px]:absolute min-[1440px]:top-[-10px] min-[1440px]:right-full min-[1440px]:mr-12"
      >
        <ArrowLeft className="h-4 w-4 shrink-0 translate-y-[0.08em]" aria-hidden="true" />
        <span className="underline underline-offset-4">{children}</span>
      </Link>
    </div>
  )
}
