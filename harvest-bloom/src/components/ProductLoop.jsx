import { useCallback, useRef, useState } from 'react'
import Atmosphere from './Atmosphere.jsx'
import ProductPanel from './ProductPanel.jsx'
import { DEFAULT_WEIGHT, IMAGE_SIZE, products } from '../data/products.js'
import { useLoopEngine } from '../hooks/useLoopEngine.js'
import { useIsMobile, useMediaQuery } from '../hooks/useMediaQuery.js'
import { useScrollProgress } from '../hooks/useScrollProgress.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

/**
 * The product sequence.
 *
 * Scroll drives it. The track is one step of scroll per lot on top of the
 * pinned viewport: scrolling down walks the lots forward and then releases to
 * the order section, and scrolling back up walks them in reverse and leaves for
 * the story. Nothing captures the wheel, so the page is never held.
 *
 * Clicking a pack, a name in the index or an arrow scrolls to that lot rather
 * than setting a second piece of state — the scroll position *is* the state, so
 * the two can never disagree.
 */

/** Scroll distance that brings the next lot forward. About one wheel notch. */
const STEP_PX = 150

export default function ProductLoop() {
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const layout = isMobile ? 'strip' : 'ring'
  const pinRef = useRef(null)

  // Pinning only works where the panel and the ring sit side by side and the
  // pair fits one viewport. Once they stack, the block is far taller than the
  // screen, and pinning it would put the add-to-order button out of reach.
  const pinned = useMediaQuery('(min-width: 1101px)')

  const { stageRef, itemRefs, activeIndex, geometry, setProgress, setIndex, consumedDrag } =
    useLoopEngine({ count: products.length, layout, reduced, pinned })

  const trackRef = useScrollProgress(setProgress, pinRef)

  // Weight is remembered per product for the length of the visit.
  const [weights, setWeights] = useState(() =>
    Object.fromEntries(products.map((p) => [p.id, DEFAULT_WEIGHT])),
  )
  const setWeight = useCallback((id, grams) => {
    setWeights((w) => (w[id] === grams ? w : { ...w, [id]: grams }))
  }, [])

  const active = products[activeIndex]

  /**
   * Where the section is pinned, scrolling to the lot's slice of the track is
   * the only move — the scroll position *is* the state, so setting an index
   * separately would let the two disagree. Where it is not pinned, the index is
   * the state and is set directly.
   */
  const goTo = useCallback(
    (index) => {
      const i = Math.min(Math.max(index, 0), products.length - 1)
      if (!pinned) {
        setIndex(i)
        return
      }
      const track = trackRef.current
      const pin = pinRef.current
      if (!track || !pin) return
      const span = track.offsetHeight - pin.offsetHeight
      if (span <= 0) return
      const top =
        track.getBoundingClientRect().top +
        window.scrollY +
        (span * i) / (products.length - 1)
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
    },
    [pinned, reduced, setIndex, trackRef],
  )

  const step = useCallback((dir) => goTo(activeIndex + dir), [goTo, activeIndex])

  const onKeyDown = (e) => {
    const fwd = layout === 'ring' ? 'ArrowDown' : 'ArrowRight'
    const back = layout === 'ring' ? 'ArrowUp' : 'ArrowLeft'
    let handled = true
    if (e.key === fwd || e.key === 'PageDown') step(1)
    else if (e.key === back || e.key === 'PageUp') step(-1)
    else if (e.key === 'Home') goTo(0)
    else if (e.key === 'End') goTo(products.length - 1)
    else handled = false
    if (handled) e.preventDefault()
  }

  // One step of scroll per lot, on top of the pinned viewport. Unpinned, the
  // track is just a wrapper and takes its natural height.
  const trackHeight = pinned ? `calc(${(products.length - 1) * STEP_PX}px + 100svh)` : 'auto'

  return (
    <section id="collection" className="collection on-wine" aria-labelledby="collection-title">
      <Atmosphere className="collection__atmo" count={16} tone="var(--ivory)" />

      <div className="collection__intro">
        <p className="eyebrow">The collection</p>
        <h2 className="collection__title" id="collection-title">
          Six lots, <em>bought whole.</em>
        </h2>
        <p className="collection__lede">
          Scroll to bring each lot forward, or choose one. Set a weight, and the price follows.
        </p>
      </div>

      <div
        className={`collection__track${pinned ? ' is-pinned' : ''}`}
        ref={trackRef}
        style={{ height: trackHeight }}
      >
        <div className="collection__pin" ref={pinRef}>
          <div className="collection__body">
            <div className="collection__panelCol">
              <ProductPanel
                product={active}
                weights={weights}
                setWeight={setWeight}
                index={activeIndex}
                count={products.length}
              />
            </div>

            <div
              className={`loop${layout === 'ring' ? ' loop--half' : ''}`}
              data-layout={layout}
              // The ring takes the space it has and the pack size follows from
              // it, so the two can never disagree about how much room there is.
              style={geometry ? { '--item': `${Math.round(geometry.item)}px` } : undefined}
            >
              <div className="loop__glow" aria-hidden="true" />
              <LoopBand geometry={geometry} />

              <div
                className="loop__stage"
                ref={stageRef}
                tabIndex={0}
                role="listbox"
                aria-label="Product sequence"
                aria-activedescendant={`loop-item-${active.id}`}
                onKeyDown={onKeyDown}
              >
                {products.map((p, i) => (
                  <button
                    key={p.id}
                    id={`loop-item-${p.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    aria-label={`${p.name} — ${p.tagline}`}
                    className="loop__item"
                    ref={(el) => {
                      itemRefs.current[i] = el
                    }}
                    onClick={() => {
                      if (consumedDrag()) return // that was a drag, not a click
                      goTo(i)
                    }}
                    tabIndex={-1}
                  >
                    <img
                      className="loop__img"
                      src={`${p.image}.webp`}
                      alt={`${p.name} in a HARVEST BLOOM stand pouch, beside a bowl of the loose product`}
                      width={IMAGE_SIZE.width}
                      height={IMAGE_SIZE.height}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable="false"
                    />
                    <span className="loop__caption">{p.name}</span>
                  </button>
                ))}
              </div>

              <div className="loop__nav">
                <button
                  type="button"
                  className="loop__navBtn"
                  onClick={() => step(-1)}
                  disabled={activeIndex === 0}
                  aria-label="Previous product"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d={layout === 'ring' ? 'M5 12.5 10 7l5 5.5' : 'M12.5 5 7 10l5.5 5'} />
                  </svg>
                </button>
                <span className="loop__navRule" aria-hidden="true" />
                <button
                  type="button"
                  className="loop__navBtn"
                  onClick={() => step(1)}
                  disabled={activeIndex === products.length - 1}
                  aria-label="Next product"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d={layout === 'ring' ? 'M5 7.5 10 13l5-5.5' : 'M7.5 5 13 10l-5.5 5'} />
                  </svg>
                </button>
              </div>

              <ol className="loop__dots" aria-label="Choose a product">
                {products.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`loop__dot${i === activeIndex ? ' is-active' : ''}`}
                      onClick={() => goTo(i)}
                      aria-label={p.name}
                      aria-current={i === activeIndex ? 'true' : undefined}
                    >
                      <span>{p.name}</span>
                    </button>
                  </li>
                ))}
              </ol>

              <p className="loop__hint" aria-hidden="true">
                {isMobile ? 'Swipe on, or tap a pack' : 'Scroll on, or click a pack'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The band the packs ride.
 *
 * Drawn from the engine's own geometry, so it cannot drift out of register with
 * them. It is brightest where the packs come forward and dissolves as the path
 * recedes, which reads as depth rather than as a drawn circle.
 */
function LoopBand({ geometry }) {
  if (!geometry) return null
  const { w, h, cx, cy, rx, ry, band, layout } = geometry
  const x = w / 2 + cx
  const y = h / 2 + cy
  // Mapped across the stage in user space rather than across the shape's own
  // box: on the half-ring the circle is far wider than the stage, so an
  // object-box gradient would put its whole falloff off screen.
  const fade =
    layout === 'ring'
      ? [
          [0, 0.05],
          [0.44, 0.44],
          [0.84, 0.26],
          [1, 0.06],
        ]
      : [
          [0, 0.05],
          [0.5, 0.3],
          [1, 0.05],
        ]

  return (
    <svg
      className="loop__band"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hb-band" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
          {fade.map(([offset, opacity]) => (
            <stop key={offset} offset={offset} stopColor="var(--sand)" stopOpacity={opacity} />
          ))}
        </linearGradient>
        <linearGradient
          id="hb-band-edge"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={w}
          y2="0"
        >
          {fade.map(([offset, opacity]) => (
            <stop
              key={offset}
              offset={offset}
              stopColor="var(--sand)"
              stopOpacity={Math.min(opacity * 2.1, 1)}
            />
          ))}
        </linearGradient>
      </defs>

      <ellipse
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="url(#hb-band)"
        strokeWidth={band}
      />
      {/* A hairline on each rim gives the ribbon an edge to catch the light. */}
      <ellipse
        cx={x}
        cy={y}
        rx={rx + band / 2}
        ry={ry + band / 2}
        fill="none"
        stroke="url(#hb-band-edge)"
        strokeWidth="1"
      />
      <ellipse
        cx={x}
        cy={y}
        rx={Math.max(rx - band / 2, 1)}
        ry={Math.max(ry - band / 2, 1)}
        fill="none"
        stroke="url(#hb-band-edge)"
        strokeWidth="1"
      />
    </svg>
  )
}
