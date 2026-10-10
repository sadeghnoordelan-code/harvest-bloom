import { useEffect, useRef, useState } from 'react'
import { HERO_CHAPTERS } from '../data/brand.js'
import { useScrollProgress } from '../hooks/useScrollProgress.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { useIsMobile } from '../hooks/useMediaQuery.js'
import { clamp, damp, smoothstep } from '../lib/math.js'

/**
 * Scroll-scrubbed hero.
 *
 * How long the pin lasts decides how precise the scrub feels. The clip is 9.9 s
 * at ~24 fps (238 frames). At 900vh on a 900 px viewport the pinned span is
 * ~8100 px, so one frame is ~34 px of scroll and a typical 100 px wheel notch
 * advances 2–3 frames. Raise these numbers for a finer scrub at the cost of a
 * longer hero; lower them for a shorter one.
 */
/* How much scroll the clip is stretched over — this is what sets the scrub
   resolution. Stated in pixels per frame rather than in viewport heights: a vh
   figure gives a different feel on every screen (1400vh is 2.5 frames per wheel
   notch on a 720 px window and 1.7 on a 1080 px one), whereas a pixel budget per
   frame is the same everywhere. At 55 px a 100 px notch advances the film about
   1.8 frames.

   The vh numbers below are only the fallback used until the clip reports its
   duration, after which the section is sized in pixels. It is a long section on
   purpose; the skip control and the skip link are the way past it. */
const PX_PER_FRAME = 55
const PX_PER_FRAME_MOBILE = 30 // touch covers ground faster than a wheel
const HERO_SCROLL_VH = 1400
const HERO_SCROLL_VH_MOBILE = 700

/** Approach rate of the smoothing filter, per second. Higher = tighter to the
 *  scroll position; too high and single wheel notches read as jumps. At 20 the
 *  film trails the scroll by about 50 ms — enough to take the step out of a
 *  wheel notch, short enough to read as locked to the scroll. */
const SCRUB_LAMBDA = 20
/** Nominal frame duration; used to skip seeks smaller than half a frame. */
const FRAME = 1 / 24

export default function HeroScrollVideo({ onSkip }) {
  const videoRef = useRef(null)
  const pinRef = useRef(null)
  const chapterRefs = useRef([])
  const railRef = useRef(null)
  const hintRef = useRef(null)
  const veilRef = useRef(null)

  const progress = useRef(0) // target, written by scroll
  const smooth = useRef(0) // damped, drives currentTime
  const seeking = useRef(false)
  const seekStarted = useRef(0)
  const lastSet = useRef(-1)

  const reduced = useReducedMotion()
  const isMobile = useIsMobile()
  const [ready, setReady] = useState(false)
  const [loadPct, setLoadPct] = useState(0)
  const [failed, setFailed] = useState(false)
  /** Scrub distance in px, once the clip's duration is known. */
  const [scrubPx, setScrubPx] = useState(0)

  const sectionRef = useScrollProgress((p) => {
    progress.current = p
  }, pinRef)

  /* ---- Load the clip fully before scrubbing -------------------------------
     Seeking against a partially buffered file stalls, so the whole 3.8 MB is
     pulled down first and handed to the element as a blob URL. */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let url = null
    let cancelled = false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const fallback = () => {
      if (cancelled) return
      video.src = '/hero.mp4'
      video.load()
    }

    ;(async () => {
      try {
        const res = await fetch('/hero.mp4', { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const total = Number(res.headers.get('content-length')) || 0
        if (!res.body || !total) {
          const blob = await res.blob()
          if (cancelled) return
          url = URL.createObjectURL(blob)
          video.src = url
          return
        }
        const reader = res.body.getReader()
        const chunks = []
        let received = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          if (!cancelled) setLoadPct(Math.round((received / total) * 100))
        }
        if (cancelled) return
        url = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }))
        video.src = url
      } catch {
        fallback()
      } finally {
        clearTimeout(timeout)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  /* ---- Element wiring ---------------------------------------------------- */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onSeeked = () => {
      seeking.current = false
    }
    const onLoaded = () => {
      setFailed(false)
      setReady(true)
      // The clip is never played — scroll is the only thing that moves it. A
      // hair of a seek forces the first frame to decode and paint, which is all
      // priming was ever for; calling play() would be an autoplay, however
      // briefly it lasted.
      try {
        video.currentTime = FRAME * 0.5
      } catch {
        /* the scrub loop will set it on its first frame instead */
      }
    }
    const onError = () => setFailed(true)
    // Scroll is the only thing allowed to move this clip. If anything else ever
    // starts it — a browser gesture heuristic, an extension — it stops at once.
    const onPlay = () => video.pause()

    video.addEventListener('seeked', onSeeked)
    video.addEventListener('loadeddata', onLoaded)
    video.addEventListener('error', onError)
    video.addEventListener('play', onPlay)
    return () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('error', onError)
      video.removeEventListener('play', onPlay)
    }
  }, [])

  /* ---- The scrub loop ----------------------------------------------------
     Runs entirely outside React: it reads a ref and writes to the DOM, so
     scrolling the hero never triggers a re-render. */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      // Reduced motion takes the *easing* away, not the film: the frame then
      // tracks the scroll position exactly, with nothing continuing to move
      // after the scroll stops.
      smooth.current = reduced
        ? progress.current
        : damp(smooth.current, progress.current, SCRUB_LAMBDA, dt)
      const p = smooth.current

      const video = videoRef.current
      if (video && video.readyState >= 2 && video.duration) {
        // A seek that lands on the frame already shown does not always produce a
        // `seeked` event. Without this the gate would stay closed and the scrub
        // would freeze for the rest of the visit.
        if (seeking.current && now - seekStarted.current > 260) seeking.current = false

        // Stop a hair short of the end; seeking to exactly duration can stall.
        const t = clamp(p * video.duration, 0, video.duration - FRAME * 0.5)
        if (!seeking.current && Math.abs(t - lastSet.current) > FRAME * 0.5) {
          seeking.current = true
          seekStarted.current = now
          lastSet.current = t
          try {
            video.currentTime = t
          } catch {
            seeking.current = false
          }
        }
      }

      // Overlay copy: each chapter fades in over its slice of the timeline.
      for (let i = 0; i < HERO_CHAPTERS.length; i++) {
        const el = chapterRefs.current[i]
        if (!el) continue
        const start = HERO_CHAPTERS[i].at
        const next = HERO_CHAPTERS[i + 1]?.at ?? 1.06
        const inT = smoothstep(start, start + 0.07, p)
        const outT = 1 - smoothstep(next - 0.09, next - 0.01, p)
        const a = i === 0 ? outT : Math.min(inT, outT)
        el.style.opacity = a.toFixed(3)
        // Reduced motion keeps the cross-fade — it is tied to the scroll, not
        // self-running — but drops the travel that comes with it.
        el.style.transform = reduced
          ? 'none'
          : `translate3d(0, ${((1 - a) * 26).toFixed(2)}px, 0)`
        el.style.visibility = a < 0.01 ? 'hidden' : 'visible'
      }

      if (railRef.current) railRef.current.style.transform = `scaleY(${p.toFixed(4)})`
      if (hintRef.current) {
        const a = 1 - smoothstep(0.005, 0.05, p)
        hintRef.current.style.opacity = a.toFixed(3)
      }
      // Deepen the scrim slightly as the clip plays out.
      if (veilRef.current) veilRef.current.style.opacity = (0.28 + p * 0.22).toFixed(3)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  /* The film is the hero. `prefers-reduced-motion` turns off what moves on its
     own — the drift, the loop's self-advance, hover travel, entrance reveals,
     the scrub's easing — but not this, because every frame of it is driven
     directly by the visitor's own scroll. Switching it off left a still image
     where the product was. */

  /* ---- Scrub distance ----------------------------------------------------
     Once the clip's length is known the section is sized in pixels, at a fixed
     budget per frame, so a wheel notch advances the film by the same amount on
     a short window as on a tall one. Until then the vh fallback applies. */
  useEffect(() => {
    const video = videoRef.current
    if (!ready || !video?.duration) return
    const frames = video.duration / FRAME
    setScrubPx(Math.round(frames * (isMobile ? PX_PER_FRAME_MOBILE : PX_PER_FRAME)))
  }, [ready, isMobile])

  const scrollVh = isMobile ? HERO_SCROLL_VH_MOBILE : HERO_SCROLL_VH

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="hero"
      // The pin is one viewport tall, so the section is the scrub distance plus
      // that. Falls back to the vh figure until the clip's duration is known.
      style={
        failed
          ? { height: '100lvh' }
          : scrubPx
          ? { '--hero-scroll': scrollVh, height: `calc(${scrubPx}px + 100lvh)` }
          : { '--hero-scroll': scrollVh }
      }
      aria-label="HARVEST BLOOM introduction"
    >
      <div className="hero__pin" ref={pinRef}>
        <div className="hero__stage">
          <video
            ref={videoRef}
            className="hero__video"
            muted
            playsInline
            preload="auto"
            disableRemotePlayback
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="hero__veil" ref={veilRef} />
          <div className="hero__grain" aria-hidden="true" />
        </div>

        <div className="hero__copy">
          {HERO_CHAPTERS.map((c, i) => (
            <article
              key={c.eyebrow}
              className="hero__chapter"
              ref={(el) => {
                chapterRefs.current[i] = el
              }}
            >
              <p className="hero__eyebrow">{c.eyebrow}</p>
              <h1 className="hero__title">
                {c.title.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h1>
              <p className="hero__body">{c.body}</p>
            </article>
          ))}
        </div>

        <div className="hero__rail" aria-hidden="true">
          <span className="hero__railFill" ref={railRef} />
        </div>
        <div className="hero__hint" ref={hintRef}>
          <span>Scroll to play</span>
          <i />
        </div>
        <button type="button" className="hero__skip" onClick={onSkip}>
          Skip to the collection
        </button>

        {!ready && !failed && (
          <div className="hero__loading" role="status">
            <span className="hero__loadingBar">
              <i style={{ transform: `scaleX(${Math.max(loadPct, 4) / 100})` }} />
            </span>
            <span className="hero__loadingText">Loading film {loadPct}%</span>
          </div>
        )}
        {failed && (
          <p className="hero__loading hero__loading--error" role="status">
            The intro film could not be loaded.
          </p>
        )}
      </div>
    </section>
  )
}
