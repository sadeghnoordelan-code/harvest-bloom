import { BRAND, NAV } from '../data/brand.js'

export default function Footer() {
  const jump = (href) => (e) => {
    e.preventDefault()
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <footer className="ftr on-coal">
      <div className="ftr__inner">
        <span className="ftr__word">
          {BRAND.wordmark[0]} <em>{BRAND.wordmark[1]}</em>
        </span>
        <nav className="ftr__nav" aria-label="Footer">
          {NAV.map((n) => (
            <a key={n.id} href={n.href} onClick={jump(n.href)}>
              {n.label}
            </a>
          ))}
        </nav>
        <p className="ftr__legal">
          &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
