import confetti from 'canvas-confetti'

// Paper confetti for the reveal: irregular hand-cut pieces in the site's palette, the stamp red
// plus confetti colours tuned to sit next to it. Skipped when the person asked for less motion.
const COLORS = ['#d93b26', '#e8a33d', '#3f7cc4', '#4f9a6b', '#e58ba0', '#1b1b1a']

let shapes: confetti.Shape[] | null = null

function paperShapes() {
  // ponytail: built once on first use; shapeFromPath needs a canvas, so not at import time.
  shapes ??= [
    'M0 1 L9 0 L10 6 L1 7 Z',
    'M0 0 L12 1 L11 4 L1 3 Z',
    'M1 0 L7 1 L6 9 L0 8 Z',
    'M0 2 L5 0 L9 3 L6 8 L1 6 Z',
  ].map((path) => confetti.shapeFromPath({ path }))
  return shapes
}

export function celebrate() {
  const base = {
    shapes: paperShapes(),
    colors: COLORS,
    scalar: 1.4,
    gravity: 0.7,
    decay: 0.92,
    ticks: 260,
    disableForReducedMotion: true,
  }
  confetti({ ...base, particleCount: 70, spread: 70, angle: 60, origin: { x: 0, y: 0.7 } })
  confetti({ ...base, particleCount: 70, spread: 70, angle: 120, origin: { x: 1, y: 0.7 } })
}
