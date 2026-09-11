import Atmosphere from './Atmosphere.jsx'
import { BRAND, CONTACT } from '../data/brand.js'
import Reveal from './Reveal.jsx'

export default function Contact() {
  return (
    <section id="contact" className="contact on-wine" aria-labelledby="contact-title">
      <Atmosphere className="contact__atmo" count={11} tone="var(--ivory)" />

      <Reveal className="contact__lead">
        <p className="eyebrow">Get in touch</p>
        <h2 className="contact__title" id="contact-title">
          Speak to the house.
        </h2>
        <p className="contact__lede">
          Lots are small and often spoken for before they are listed. Tell us what you
          are looking for and we will tell you what is in the room.
        </p>
      </Reveal>

      <div className="contact__grid">
        <Reveal as="div" className="contact__card" delay={60}>
          <h3>Concierge</h3>
          <a className="contact__big" href={`tel:${CONTACT.phone.replace(/[^\d+]/g, '')}`}>
            {CONTACT.phone}
          </a>
          <p className="contact__note">{CONTACT.phoneNote}</p>
        </Reveal>

        <Reveal as="div" className="contact__card" delay={120}>
          <h3>Enquiries</h3>
          <a className="contact__big" href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
          <p className="contact__note">{CONTACT.emailNote}</p>
        </Reveal>

        <Reveal as="div" className="contact__card" delay={180}>
          <h3>Customer support</h3>
          <a className="contact__big" href={`mailto:${CONTACT.support}`}>
            {CONTACT.support}
          </a>
          <p className="contact__note">{CONTACT.supportNote}</p>
        </Reveal>

        <Reveal as="div" className="contact__card" delay={240}>
          <h3>Atelier</h3>
          <address className="contact__address">
            {CONTACT.address.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
        </Reveal>

        <Reveal as="div" className="contact__card contact__card--wide" delay={300}>
          <h3>Elsewhere</h3>
          <ul className="contact__social">
            {CONTACT.social.map((s) => (
              <li key={s.label}>
                <a href={s.href}>
                  <span>{s.label}</span>
                  <em>{s.handle}</em>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="div" className="contact__card contact__card--brand" delay={360}>
          <img
            src={`${BRAND.emblem}.webp`}
            alt=""
            width={BRAND.emblemSize.width}
            height={BRAND.emblemSize.height}
            loading="lazy"
            decoding="async"
          />
          <p>{BRAND.line}</p>
          <p className="contact__note">Established {BRAND.established}</p>
        </Reveal>
      </div>
    </section>
  )
}
