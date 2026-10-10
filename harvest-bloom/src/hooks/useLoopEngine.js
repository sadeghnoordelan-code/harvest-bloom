import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clamp, damp, smoothstep } from '../lib/math.js'

/**
 * The motion core behind the product sequence.
 *
 * Scroll owns the position. The section pins, and how far you have scrolled
 * through it is the index: one step of scroll brings the next lot forward, and
 * once the last one has passed, the page carries on to the next section. There
 * is no wheel capture and no endless wrap — scrolling never gets held hostage,
 * and scrolling back up walks the lots in reverse and then leaves the section
 * the way it came.
 *
 * `pos` is a float: 3.5 means "half way between lot 3 and lot 4". It is damped
 * toward the scroll-derived target and written straight to the DOM, so moving
 * through the sequence never re-renders React. Only the settled index is lifted
 * into state, which is what the information panel listens to.
 */

const LAMBDA = 16 // smoothing of the scroll-derived position, per second
const SUB_DT = 1 / 240

/**
 * Where the band runs and where the packs sit on it, in stage coordinates whose
 * origin is the centre of the stage.
 *
 * ring: a half-ring. The circle's centre sits on the right edge of the stage,
 * so only its left half is on screen and the rest carries off the side.
 * strip: a wide, shallow arc with the focus at the top, for touch.
 */
export function ringGeometry(w, h, layout) {
  if (!w || !h) return null

  // Scale at three points of the depth curve below. A pack passes through every
  // angle as the sequence advances, so the box has to hold the widest pack at
  // each of them — reserve for the side pass as well as the focus and the rear.
  const REAR = 0.52
  const SIDE = 0.71

  if (layout === 'strip') {
    const item = Math.min(w * 0.5, h * 0.6)
    const rx = Math.max((w / 2) * 0.96 - (item * SIDE) / 2, 56)
    const ry = Math.max(Math.min(h * 0.13, (h / 2 - (item * REAR) / 2) / 2), 22)
    const lift = ry + (item * REAR) / 4 - item / 4
    return {
      layout,
      w,
      h,
      item,
      cx: 0,
      cy: ry - lift,
      rx,
      ry,
      step: (Math.PI * 2) / 6,
      band: clamp(Math.min(item * 0.44, ry * 1.15), 34, 150),
      at: (a) => ({ x: rx * Math.sin(a), y: ry * (1 - Math.cos(a)) - lift }),
    }
  }

  // The angular step is solved from where the neighbouring packs should land —
  //   rise:   r·sin(step) = DROP·h
  //   recede: r·(1-cos step) = BACK·w
  // whose ratio gives tan(step/2) directly, and r follows from the rise.
  const DROP = 0.4
  const BACK = 0.105
  const step = 2 * Math.atan((BACK * w) / (DROP * h))
  const originalRadius = clamp((DROP * h) / Math.sin(step), 140, 1600)
  const radiusLimit = w > 825 ? w - 225 : Math.min(w / 1.26, w - 75)
  const r = Math.min(originalRadius, radiusLimit)
  const cx = w / 2 // circle centre on the stage's right edge
  const item = clamp(r * 0.52, 150, 420)
  return {
    layout,
    w,
    h,
    item,
    cx,
    cy: 0,
    rx: r,
    ry: r,
    step,
    band: clamp(r * 0.34, 64, 260),
    at: (a) => ({ x: cx - r * Math.cos(a), y: r * Math.sin(a) }),
  }
}

/** Drag pixels that move the sequence on by one lot, when it is not pinned. */
const DRAG_STEP = 130
const CLICK_SLOP = 6

export function useLoopEngine({ count, layout = 'ring', reduced = false, pinned = true }) {
  const stageRef = useRef(null)
  const itemRefs = useRef([])

  const pos = useRef(0)
  const target = useRef(0)
  const geomRef = useRef(null)
  const dragging = useRef(false)

  const [activeIndex, setActiveIndex] = useState(0)
  const [geometry, setGeometry] = useState(null)
  const activeRef = useRef(0)

  /** Called by the section as it is scrolled through: 0 is the first lot, 1 the last. */
  const setProgress = useCallback(
    (p) => {
      if (!pinned) return
      target.current = Math.round(clamp(p, 0, 1) * (count - 1))
    },
    [count, pinned],
  )

  /** Used where the section is not pinned and scroll therefore does not drive it. */
  const setIndex = useCallback(
    (i) => {
      target.current = clamp(i, 0, count - 1)
    },
    [count],
  )

  // Wheel steps use the motion target so rapid input cannot race React state.
  const stepIndex = useCallback((dir) => {
    const next = clamp(Math.round(target.current) + dir, 0, count - 1)
    if (next === target.current) return false
    target.current = next
    return true
  }, [count])

  /* ---- geometry ---------------------------------------------------------- */
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const g = ringGeometry(r.width, r.height, layout)
      geomRef.current = g
      setGeometry((prev) => (prev && g && prev.w === g.w && prev.h === g.h && prev.layout === g.layout ? prev : g))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout])

  /* ---- the frame loop ----------------------------------------------------
     A layout effect, so the initial `render()` lays the packs out along the band
     before the browser paints. As a plain effect the first paint would catch all
     six stacked on top of each other at full size. */
  useLayoutEffect(() => {
    let raf = 0
    let last = performance.now()

    const place = (i, t) => {
      const el = itemRefs.current[i]
      const g = geomRef.current
      if (!el || !g) return

      // `t` is the signed distance to the focus in lots. The sequence is linear
      // now rather than a loop, so it simply runs out at either end: lots far
      // enough away are transparent and take themselves out of the way.
      const half = count / 2
      const u = clamp(Math.abs(t) / half, 0, 1)
      const a = t * (g.step ?? (Math.PI * 2) / count)
      const { x, y } = g.at(a)

      const scale = 1 - 0.46 * Math.pow(u, 0.85)
      const opacity = 1 - smoothstep(0.5, 0.98, u)
      const blur = u * 1.7

      el.style.transform =
        `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), 0)` +
        ` scale(${scale.toFixed(4)})`
      el.style.opacity = opacity.toFixed(3)
      el.style.zIndex = String(1000 - Math.round(u * 900))
      el.style.filter = blur > 0.12 ? `blur(${blur.toFixed(2)}px)` : 'none'
      el.style.pointerEvents = opacity > 0.45 ? 'auto' : 'none'
      el.dataset.focused = Math.abs(t) < 0.5 ? 'true' : 'false'
    }

    const render = () => {
      const p = pos.current
      for (let i = 0; i < count; i++) place(i, i - p)
      const idx = clamp(Math.round(p), 0, count - 1)
      if (idx !== activeRef.current) {
        activeRef.current = idx
        setActiveIndex(idx)
      }
    }

    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now

      // Reduced motion takes the smoothing away, not the sequence: the packs
      // then track the scroll exactly, with nothing still moving once it stops.
      if (dragging.current) {
        // A drag moves the packs directly; nothing to settle toward.
      } else if (reduced) {
        pos.current = target.current
      } else {
        let remaining = dt
        while (remaining > 0) {
          const s = Math.min(SUB_DT, remaining)
          remaining -= s
          pos.current = damp(pos.current, target.current, LAMBDA, s)
        }
        if (Math.abs(target.current - pos.current) < 0.0004) pos.current = target.current
      }
      render()
    }

    render()
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [count, layout, reduced])

  /* ---- drag and swipe ----------------------------------------------------
     Only where the section is not pinned. Where it is, scroll already moves the
     sequence and a drag would be fighting it for the same gesture. */
  useEffect(() => {
    const el = stageRef.current
    if (!el || pinned) return
    let startPos = 0
    let start = 0
    let travelled = 0
    let pid = null

    const axis = (e) => (layout === 'ring' ? e.clientY : e.clientX)

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return
      pid = e.pointerId
      dragging.current = true
      startPos = pos.current
      start = axis(e)
      travelled = 0
      el.dataset.dragging = 'true'
    }
    const onMove = (e) => {
      if (!dragging.current || e.pointerId !== pid) return
      const v = axis(e)
      travelled = Math.max(travelled, Math.abs(v - start))
      // Dragging up (or left) brings the next lot forward. Clamped, because the
      // sequence has two ends now rather than wrapping.
      pos.current = clamp(startPos + (start - v) / DRAG_STEP, 0, count - 1)
      target.current = pos.current
      if (travelled > CLICK_SLOP) {
        if (!el.hasPointerCapture?.(pid)) el.setPointerCapture?.(pid)
        e.preventDefault()
      }
    }
    const onUp = (e) => {
      if (!dragging.current || (pid !== null && e.pointerId !== pid)) return
      dragging.current = false
      el.dataset.dragging = 'false'
      if (el.hasPointerCapture?.(pid)) el.releasePointerCapture?.(pid)
      pid = null
      target.current = clamp(Math.round(pos.current), 0, count - 1)
      el.dataset.wasDrag = travelled > CLICK_SLOP ? 'true' : 'false'
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('lostpointercapture', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('lostpointercapture', onUp)
      dragging.current = false
    }
  }, [count, layout, pinned])

  /** True when the last pointer sequence was a drag, so a click can be ignored. */
  const consumedDrag = useCallback(() => {
    const el = stageRef.current
    const was = el?.dataset.wasDrag === 'true'
    if (el) el.dataset.wasDrag = 'false'
    return was
  }, [])

  return { stageRef, itemRefs, activeIndex, geometry, setProgress, setIndex, stepIndex, consumedDrag }
}
