'use client'

import { useEffect } from 'react'

// Redraws the tab icon so the ghost floats and blinks. Chrome, Edge and Firefox follow the
// changes; Safari keeps the static /icon.svg. Background tabs get throttled by the browser,
// which is fine: the ghost just moves slower there.
const BODY = 'M6 42V19a14 14 0 0 1 28 0v23l-4.6-3.6L24.6 42 20 38.4 15.4 42l-4.6-3.6Z'
const SLIP = 'M23 27l9-2 1.6 7-9 2z'
const FPS = 12

function draw(ctx: CanvasRenderingContext2D, paths: Path2D[], t: number) {
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#e7e7e3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(1, 1, 62, 62, 14)
  ctx.fill()
  ctx.stroke()

  const bob = Math.sin(t / 450) * 2.2
  const blink = t % 3600 < 140
  ctx.save()
  ctx.translate(13, 8 + bob)
  ctx.scale(0.95, 0.95)
  ctx.strokeStyle = '#1b1b1a'
  ctx.fillStyle = '#1b1b1a'
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  paths.forEach((p) => ctx.stroke(p))
  if (blink) {
    ctx.beginPath()
    ctx.moveTo(13, 19.5)
    ctx.lineTo(17, 19.5)
    ctx.moveTo(22, 19.5)
    ctx.lineTo(26, 19.5)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(15, 19.5, 2, 0, Math.PI * 2)
    ctx.arc(24, 19.5, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function AnimatedFavicon() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx?.roundRect) return

    let link = document.querySelector<HTMLLinkElement>('link#animated-favicon')
    if (!link) {
      // Our link goes last so it wins over the static icons Next adds.
      link = document.createElement('link')
      link.id = 'animated-favicon'
      link.rel = 'icon'
      link.type = 'image/png'
      document.head.appendChild(link)
    }
    const icon = link
    // Path2D only exists in the browser, so it's built here and not at import time.
    const paths = [new Path2D(BODY), new Path2D(SLIP)]
    const start = performance.now()
    const id = window.setInterval(() => {
      draw(ctx, paths, performance.now() - start)
      icon.href = canvas.toDataURL('image/png')
    }, 1000 / FPS)
    return () => {
      window.clearInterval(id)
      icon.remove()
    }
  }, [])

  return null
}
