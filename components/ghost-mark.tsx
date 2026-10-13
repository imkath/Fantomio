// The GhostSwap ghost: one stroke, a folded slip in hand, the hem cut like a raffle book.
// It inherits the text color, so it works on paper, on ink and on the red seal.
interface GhostMarkProps {
  className?: string
  title?: string
}

export function GhostMark({ className, title }: GhostMarkProps) {
  return (
    <svg
      viewBox="0 0 40 46"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z" />
        <path d="M23 27l9-2 1.6 7-9 2z" />
      </g>
      <circle fill="currentColor" cx="15" cy="19.5" r="1.8" />
      <circle fill="currentColor" cx="24" cy="19.5" r="1.8" />
    </svg>
  )
}
