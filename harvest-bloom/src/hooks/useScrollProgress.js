import { useEffect, useRef } from 'react'
import { clamp } from '../lib/math.js'

/**
 * Reports how far a tall section has been scrolled through, 0 to 1, via a
 * callback rather than state so it never triggers a React render.
 *
 * The sticky child stays pinned for exactly (section height − pin height)
 * pixels, so that is the span progress has to be measured against. Pass the pin
 * itself: on mobile its height is a viewport unit that does *not* track
 * `window.innerHeight` — the visual viewport grows and shrinks as the address
 * bar collapses, while the pin does not — and using innerHeight there puts the
 * scrub permanently out of register with the scroll.
 */
export function useScrollProgress(onProgress, pinRef) {
  const ref = useRef(null)
  const cb = useRef(onProgress)
  cb.current = onProgress

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0

    const measure = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const pinned = pinRef?.current?.offsetHeight || window.innerHeight
      const span = rect.height - pinned
      const p = span <= 0 ? 0 : clamp(-rect.top / span, 0, 1)
      cb.current(p, rect)
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The pin's height is a viewport unit; re-measure when it actually changes
    // rather than trusting a resize event, which mobile does not always send.
    let ro
    if (pinRef?.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(pinRef.current)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
    }
  }, [pinRef])

  return ref
}
