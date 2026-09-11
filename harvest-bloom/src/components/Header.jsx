import { useEffect, useRef, useState } from 'react'
import { BRAND, NAV } from '../data/brand.js'
import { formatMoney } from '../lib/format.js'
import { useCart } from '../store/CartContext.jsx'

export default function Header() {
  const cart = useCart()
  const [lifted, setLifted] = useState(false)
  const [onFilm, setOnFilm] = useState(true)
  const [open, setOpen] = useState(false)
  const pulseRef = useRef(null)
  const lastCount = useRef(cart.count)

  // Charcoal type is unreadable over the film, and an ivory bar would hide it.
  // While the header sits over the hero it goes light on a soft scrim instead,
  // and only takes the ivory treatment once the film is behind it.
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const hero = document.querySelector('#hero')
        const headerH = document.querySelector('.hdr')?.offsetHeight ?? 0
        setOnFilm(hero ? hero.getBoundingClientRect().bottom > headerH : false)
        setLifted(window.scrollY > 24)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // Flash the indicator whenever a line is added.
  useEffect(() => {
    if (cart.count > lastCount.current && pulseRef.current) {
      const el = pulseRef.current
      el.classList.remove('is-pulse')
      void el.offsetWidth
      el.classList.add('is-pulse')
    }
    lastCount.current = cart.count
  }, [cart.count])

  const jump = (href) => (e) => {
    e.preventDefault()
    setOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header
      className={`hdr${onFilm ? ' is-onFilm' : lifted ? ' is-lifted' : ''}${open ? ' is-open' : ''}`}
    >
      <div className="hdr__inner">
        <a className="hdr__brand" href="#hero" onClick={jump('#hero')} aria-label={BRAND.name}>
          <img
            className="hdr__emblem"
            src={`${BRAND.emblem}.webp`}
            alt=""
            width={BRAND.emblemSize.width}
            height={BRAND.emblemSize.height}
            decoding="async"
          />
          <span className="hdr__word">
            <span>{BRAND.wordmark[0]}</span>
            <span>{BRAND.wordmark[1]}</span>
          </span>
        </a>

        <nav className="hdr__nav" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.id} href={n.href} onClick={jump(n.href)}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hdr__right">
          <a
            className="hdr__cart"
            href="#order"
            onClick={jump('#order')}
            ref={pulseRef}
            aria-label={`Your order: ${cart.count} ${cart.count === 1 ? 'item' : 'items'}, ${formatMoney(cart.subtotal)}`}
          >
            <span className="hdr__cartCount">{String(cart.count).padStart(2, '0')}</span>
            <span className="hdr__cartRule" aria-hidden="true" />
            <span className="hdr__cartTotal">{formatMoney(cart.subtotal)}</span>
          </a>

          <button
            type="button"
            className="hdr__burger"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <i />
            <i />
          </button>
        </div>
      </div>

      <div className="hdr__sheet" hidden={!open}>
        {NAV.map((n) => (
          <a key={n.id} href={n.href} onClick={jump(n.href)}>
            {n.label}
          </a>
        ))}
      </div>
    </header>
  )
}
