import Link from 'next/link'

// Where you are inside the app, e.g. "Mis grupos / Amigo secreto oficina". Every level but the
// last is a link; the last one is the current page.
export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Ruta">
      <ol className="text-graphite flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 items-center gap-x-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-faint">
                /
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink max-w-[32ch] truncate">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
