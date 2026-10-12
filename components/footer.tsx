import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500"
      role="contentinfo"
    >
      <p>&copy; {new Date().getFullYear()} GhostSwap - Amigo Secreto e Intercambio de Regalos</p>
      <nav className="mt-2" aria-label="Enlaces legales">
        <Link href="/privacy" className="transition-colors hover:text-indigo-600">
          Política de Privacidad
        </Link>
        <span className="mx-2" aria-hidden="true">
          ·
        </span>
        <Link href="/terms" className="transition-colors hover:text-indigo-600">
          Términos del Servicio
        </Link>
      </nav>
    </footer>
  )
}
