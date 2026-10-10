import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

/**
 * The atmospheric layer.
 *
 * A sparse drift of product silhouettes — barberry, almond, pistachio, walnut,
 * hazelnut, cashew — behind the content of a section. Deliberately vector
 * rather than photographic: the pack shots are the brand's own photography and
 * do not survive being reduced to a 40px ghost at 7% opacity, whereas a drawn
 * silhouette stays clean at any size.
 *
 * It is a decoration, so it is cheap and it yields: one canvas, no layout, a
 * dozen or so shapes, parked entirely when off screen or when the visitor has
 * asked for reduced motion.
 */

/** Unit silhouettes, drawn in a 1×1 box centred on the origin. */
const SHAPES = {
  // Elongated berry with a slight curve.
  barberry(c) {
    c.moveTo(0, -0.5)
    c.bezierCurveTo(0.34, -0.3, 0.36, 0.24, 0.06, 0.5)
    c.bezierCurveTo(-0.24, 0.26, -0.3, -0.24, 0, -0.5)
  },
  // Pointed oval.
  almond(c) {
    c.moveTo(0, -0.5)
    c.bezierCurveTo(0.32, -0.22, 0.32, 0.24, 0, 0.5)
    c.bezierCurveTo(-0.32, 0.24, -0.32, -0.22, 0, -0.5)
  },
  // Split shell, the seam left open.
  pistachio(c) {
    c.moveTo(-0.04, -0.46)
    c.bezierCurveTo(0.34, -0.3, 0.38, 0.26, 0.02, 0.48)
    c.bezierCurveTo(-0.3, 0.26, -0.34, -0.26, -0.04, -0.46)
    c.moveTo(-0.04, -0.34)
    c.lineTo(0.02, 0.36)
  },
  // Two lobes with a crease.
  walnut(c) {
    c.moveTo(0, -0.48)
    c.bezierCurveTo(0.42, -0.4, 0.46, 0.34, 0, 0.48)
    c.bezierCurveTo(-0.46, 0.34, -0.42, -0.4, 0, -0.48)
    c.moveTo(0, -0.42)
    c.lineTo(0, 0.42)
  },
  // Round with a small point.
  hazelnut(c) {
    c.moveTo(0, -0.5)
    c.bezierCurveTo(0.4, -0.36, 0.42, 0.3, 0, 0.48)
    c.bezierCurveTo(-0.42, 0.3, -0.4, -0.36, 0, -0.5)
  },
  // Kidney curve.
  cashew(c) {
    c.moveTo(-0.18, -0.44)
    c.bezierCurveTo(0.26, -0.4, 0.42, 0.06, 0.16, 0.44)
    c.bezierCurveTo(0.02, 0.2, -0.14, 0.12, -0.3, 0.16)
    c.bezierCurveTo(-0.42, -0.12, -0.36, -0.4, -0.18, -0.44)
  },
}

const KINDS = Object.keys(SHAPES)

/** One drifting silhouette. */
function seed(i, n, w, h) {
  const kind = KINDS[i % KINDS.length]
  return {
    path: (() => {
      const p = new Path2D()
      SHAPES[kind](p)
      return p
    })(),
    // Spread over a jittered grid so they never clump or line up.
    x: ((i + 0.5) / n + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.14 - 0.07) * w,
    y: (Math.sin(i * 78.233) * 0.5 + 0.5) * h,
    size: 26 + (Math.sin(i * 39.42) * 0.5 + 0.5) * 46,
    spin: (Math.sin(i * 7.31) * 0.5 + 0.5) * Math.PI * 2,
    drift: 0.1 + (Math.sin(i * 21.7) * 0.5 + 0.5) * 0.16, // px per second, upward
    sway: 8 + (Math.sin(i * 4.11) * 0.5 + 0.5) * 16,
    phase: (Math.sin(i * 55.3) * 0.5 + 0.5) * Math.PI * 2,
    depth: 0.35 + (Math.sin(i * 17.7) * 0.5 + 0.5) * 0.65, // parallax weight
    alpha: 0.05 + (Math.sin(i * 91.1) * 0.5 + 0.5) * 0.05,
  }
}

export default function Atmosphere({ count = 14, tone = 'var(--sand)', className = '' }) {
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let bits = []
    let w = 0
    let h = 0
    let dpr = 1
    let live = false
    let t0 = performance.now()
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

    // The tone is a CSS variable on the host, so the layer follows whatever
    // section it is dropped into without being told.
    const ink = () => getComputedStyle(host).getPropertyValue('--atmo-ink').trim() || '#b3a99c'

    const measure = () => {
      const r = host.getBoundingClientRect()
      if (!r.width || !r.height) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = r.width
      h = r.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      bits = Array.from({ length: count }, (_, i) => seed(i, count, w, h))
      if (reduced) draw(performance.now())
    }

    const draw = (now) => {
      const dt = Math.min((now - t0) / 1000, 0.05)
      t0 = now
      pointer.x += (pointer.tx - pointer.x) * 0.045
      pointer.y += (pointer.ty - pointer.y) * 0.045

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = ink()

      for (const b of bits) {
        if (!reduced) {
          b.y -= b.drift * dt * 60
          if (b.y < -b.size) b.y = h + b.size
          b.phase += dt * 0.18
          b.spin += dt * 0.035
        }
        const x = b.x + Math.sin(b.phase) * b.sway + pointer.x * b.depth
        const y = b.y + pointer.y * b.depth * 0.5
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(b.spin)
        ctx.scale(b.size, b.size)
        ctx.globalAlpha = b.alpha
        ctx.fill(b.path)
        ctx.restore()
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }

    const start = () => {
      if (live) return
      live = true
      t0 = performance.now()
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    const stop = () => {
      live = false
      cancelAnimationFrame(raf)
      raf = 0
    }

    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(host)

    // Only run while the section is actually on screen.
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? start() : stop()),
      { rootMargin: '10% 0px' },
    )
    io.observe(host)

    // A slow lean toward the pointer, not a follow. Capped so it stays a drift.
    const onMove = (e) => {
      const r = host.getBoundingClientRect()
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 36
      pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 22
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [count, reduced])

  return (
    <div
      ref={hostRef}
      className={`atmo ${className}`}
      style={{ '--atmo-ink': tone }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="atmo__canvas" />
    </div>
  )
}
