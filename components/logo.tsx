import Link from 'next/link'
import { GhostMark } from '@/components/ghost-mark'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  linkToHome?: boolean
}

const sizes = {
  sm: { mark: 'h-[21px] w-[18px]', text: 'text-base' },
  md: { mark: 'h-[30px] w-[26px]', text: 'text-[19px] sm:text-[22px]' },
  lg: { mark: 'h-[42px] w-[36px]', text: 'text-3xl' },
}

export function Logo({ size = 'md', linkToHome = true }: LogoProps) {
  const content = (
    <span className="text-ink flex items-center gap-2.5">
      <GhostMark className={sizes[size].mark} />
      {/* On the narrowest phones only the ghost shows; the name stays for screen readers. */}
      <span
        className={`font-display leading-none tracking-[-0.01em] max-[379px]:sr-only ${sizes[size].text}`}
      >
        fantomio
      </span>
    </span>
  )

  if (!linkToHome) return content

  return (
    <Link
      href="/"
      aria-label="Fantomio, ir al inicio"
      className="transition-opacity hover:opacity-80"
    >
      {content}
    </Link>
  )
}
