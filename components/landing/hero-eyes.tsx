'use client'

import { useEffect, useRef } from 'react'

// The hero ghost's eyes follow the pointer. Rendered inside the hero <svg>, so coordinates are
// in its viewBox units. Stays still for people who asked for reduced motion.
const EYES = [
  { cx: 128, cy: 134 },
  { cx: 172, cy: 134 },
]
const REACH = 10

export function HeroEyes({ className }: { className?: string }) {
  const group = useRef<SVGGElement>(null)

  useEffect(() => {
    const g = group.current
    const svg = g?.ownerSVGElement
    if (!g || !svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dots = [...g.querySelectorAll('circle')]
    let frame = 0

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = svg.getBoundingClientRect()
        const view = svg.viewBox.baseVal
        const scale = view.width / box.width
        const x = (e.clientX - box.left) * scale + view.x
        const y = (e.clientY - box.top) * scale + view.y
        EYES.forEach((eye, i) => {
          const dx = x - eye.cx
          const dy = y - eye.cy
          const dist = Math.hypot(dx, dy) || 1
          const k = Math.min(REACH, dist / 8) / dist
          dots[i].setAttribute('transform', `translate(${dx * k} ${dy * k})`)
        })
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <g ref={group}>
      {EYES.map((eye) => (
        <circle
          key={eye.cx}
          className={className}
          cx={eye.cx}
          cy={eye.cy}
          r="5"
          style={{ transition: 'transform 0.12s ease-out' }}
        />
      ))}
    </g>
  )
}
