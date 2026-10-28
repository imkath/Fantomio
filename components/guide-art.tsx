// Spot illustrations for the guides, drawn in the logo's own line: one stroke, round ends, the
// ghost with its folded slip. Paper slips keep fixed light colors in both themes (like the draw
// demo); the lines follow the text color.

const SLIPS = ['#fde3c8', '#d9e8f7', '#d9efdf', '#f9dbe4', '#fbedc2', '#e6e1f5']
const LINE = {
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
}
// Writing on paper is always ink, whatever the theme: the slips stay light in dark mode.
const ON_PAPER = { ...LINE, stroke: '#1b1b1a' }
const BODY = 'M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z'

function Ghost({
  x,
  y,
  s = 2.4,
  wink = false,
  slip = true,
  flip = false,
}: {
  x: number
  y: number
  s?: number
  wink?: boolean
  slip?: boolean
  flip?: boolean
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})${flip ? ' translate(-40 0)' : ''}`}
    >
      <path d={BODY} fill="var(--paper)" {...LINE} />
      {slip && <path d="M23 27l9-2 1.6 7-9 2z" fill={SLIPS[0]} {...LINE} />}
      <circle cx="15" cy="19.5" r="1.8" fill="currentColor" />
      {wink ? (
        <path d="M22 19.8h4.2" {...LINE} />
      ) : (
        <circle cx="24" cy="19.5" r="1.8" fill="currentColor" />
      )}
    </g>
  )
}

// A folded raffle slip, rotated around its center.
function Slip({
  x,
  y,
  r = 0,
  c = 0,
  w = 34,
  h = 22,
}: {
  x: number
  y: number
  r?: number
  c?: number
  w?: number
  h?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx="2"
        fill={SLIPS[c % SLIPS.length]}
        {...LINE}
      />
      <path d={`M${-w / 2 + 7} ${-2}h${w - 18}M${-w / 2 + 7} 4h${w - 24}`} {...ON_PAPER} />
    </g>
  )
}

function Spark({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      d={`M${x} ${y - 7 * s}v${14 * s}M${x - 7 * s} ${y}h${14 * s}`}
      {...LINE}
      strokeWidth={1.8}
    />
  )
}

const scenes = {
  // The draw: slips flying out of a bowl, the ghost waiting for its turn.
  reglas: (
    <>
      <path d="M118 150q57 72 140 0" fill="var(--paper)" {...LINE} />
      <ellipse cx="188" cy="150" rx="70" ry="13" fill={SLIPS[4]} {...LINE} />
      <Slip x={160} y={110} r={-18} c={1} />
      <Slip x={205} y={92} r={14} c={2} />
      <Slip x={248} y={118} r={28} c={3} />
      <Slip x={190} y={52} r={-8} c={5} />
      <Spark x={262} y={58} />
      <Spark x={135} y={70} s={0.7} />
      <Ghost x={28} y={70} s={2.5} />
    </>
  ),
  // The group chat: a phone with the invite link, the ghost pointing at it.
  whatsapp: (
    <>
      <rect x="176" y="22" width="112" height="180" rx="18" fill="var(--paper)" {...LINE} />
      <path d="M216 34h32" {...LINE} />
      <rect x="190" y="56" width="70" height="26" rx="12" fill={SLIPS[2]} {...LINE} />
      <path d="M201 69h44" {...ON_PAPER} />
      <rect x="206" y="92" width="70" height="40" rx="12" fill={SLIPS[1]} {...LINE} />
      <path d="M217 105h42M217 118h26" {...ON_PAPER} />
      <rect x="190" y="142" width="58" height="26" rx="12" fill={SLIPS[3]} {...LINE} />
      <path d="M201 155h30" {...ON_PAPER} />
      <Spark x={150} y={56} s={0.8} />
      <Spark x={152} y={150} s={0.55} />
      <Ghost x={36} y={76} s={2.5} wink />
    </>
  ),
  // The office: three ghosts with badges and the gift on the desk.
  oficina: (
    <>
      <path d="M14 196h292" {...LINE} />
      <Ghost x={16} y={98} s={2.15} slip={false} />
      <Ghost x={96} y={72} s={2.65} />
      <Ghost x={192} y={102} s={2.05} slip={false} wink />
      <path d="M36 153l11 12 11-12" {...LINE} />
      <rect x="38" y="164" width="18" height="12" rx="2" fill={SLIPS[1]} {...LINE} />
      <path d="M211 156l10 11 10-11" {...LINE} />
      <rect x="212" y="166" width="18" height="12" rx="2" fill={SLIPS[3]} {...LINE} />
      <rect x="266" y="166" width="32" height="30" rx="2" fill={SLIPS[4]} {...LINE} />
      <path d="M282 166v30M266 179h32" {...LINE} />
      <path d="M282 166q-12-14-15-6t15 6q12-14 15-6t-15 6" fill="var(--paper)" {...LINE} />
    </>
  ),
  // Gift ideas: a wrapped box with its price tag, the ghost holding the slip.
  ideas: (
    <>
      <rect x="160" y="96" width="104" height="92" rx="3" fill={SLIPS[3]} {...LINE} />
      <rect x="152" y="80" width="120" height="22" rx="3" fill={SLIPS[3]} {...LINE} />
      <path d="M212 80v108" {...LINE} />
      <path d="M212 80q-30-34-38-18t38 18q30-34 38-18t-38 18" fill="var(--paper)" {...LINE} />
      <g transform="translate(270 124) rotate(18)">
        <path d="M0 0h38l12 14-12 14H0z" fill={SLIPS[4]} {...LINE} />
        <circle cx="40" cy="14" r="3" fill="var(--paper)" {...LINE} />
        <path d="M8 10h18M8 18h12" {...ON_PAPER} />
      </g>
      <path d="M262 124q12-6 10-18" {...LINE} />
      <Spark x={150} y={58} />
      <Ghost x={32} y={84} s={2.4} />
    </>
  ),
} as const

export type GuideArtName = keyof typeof scenes

export function GuideArt({ name, className }: { name: GuideArtName; className?: string }) {
  return (
    <svg viewBox="0 0 320 220" className={className} aria-hidden="true" fill="none">
      {scenes[name]}
    </svg>
  )
}

// A small ghost for notes and tips.
export function NoteGhost({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 46" className={className} aria-hidden="true" fill="none">
      <path d={BODY} fill="var(--paper)" {...LINE} />
      <path d="M23 27l9-2 1.6 7-9 2z" fill={SLIPS[4]} {...LINE} />
      <circle cx="15" cy="19.5" r="1.8" fill="currentColor" />
      <circle cx="24" cy="19.5" r="1.8" fill="currentColor" />
    </svg>
  )
}
