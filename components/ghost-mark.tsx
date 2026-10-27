// The GhostSwap ghost: one stroke, a folded slip in hand, the hem cut like a raffle book.
// It inherits the text color, so it works on paper, on ink and on the red seal.
interface GhostMarkProps {
  className?: string
  title?: string
  // A band over the eyes with the knot to the side: the "a ciegas" draw.
  blindfold?: boolean
  // Solid body instead of a line (a chosen option); eyes and slip cut out in the paper color.
  filled?: boolean
  // Color for the blindfold; defaults to the ghost's own color.
  bandColor?: string
}

export function GhostMark({
  className,
  title,
  blindfold = false,
  filled = false,
  bandColor,
}: GhostMarkProps) {
  const cutout = 'var(--paper)'
  const band = bandColor ?? 'currentColor'
  return (
    <svg
      viewBox="0 0 40 46"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path
          fill={filled ? 'currentColor' : 'none'}
          d="M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z"
        />
        <path fill={filled ? cutout : 'none'} d="M23 27l9-2 1.6 7-9 2z" />
      </g>
      {blindfold ? (
        <g fill={band}>
          <rect x="6" y="17" width="28" height="5" rx="1.2" />
          <path
            d="M33.5 19.5l4.5-3.2M33.5 19.5l4.2 3.6"
            stroke={band}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <>
          <circle fill={filled ? cutout : 'currentColor'} cx="15" cy="19.5" r="1.8" />
          <circle fill={filled ? cutout : 'currentColor'} cx="24" cy="19.5" r="1.8" />
        </>
      )}
    </svg>
  )
}
