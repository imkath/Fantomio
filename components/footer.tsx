import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="border-rule text-faint flex flex-wrap justify-between gap-3 border-t pt-7 pb-10 text-[15px]"
      role="contentinfo"
    >
      <span>
        Hecho por{' '}
        <a
          href="https://nvrkth.com"
          target="_blank"
          rel="noopener"
          className="hover:text-ink underline underline-offset-[3px]"
        >
          nvrkth.com
        </a>
      </span>
      <nav className="flex gap-2" aria-label="Enlaces legales">
        <Link href="/privacy" className="hover:text-ink underline underline-offset-[3px]">
          Privacidad
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="hover:text-ink underline underline-offset-[3px]">
          Términos
        </Link>
      </nav>
    </footer>
  )
}
