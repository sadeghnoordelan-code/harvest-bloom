import Atmosphere from './Atmosphere.jsx'
import { STORY } from '../data/brand.js'
import Reveal from './Reveal.jsx'

export default function Story() {
  return (
    <section id="story" className="story" aria-labelledby="story-title">
      <Atmosphere className="story__atmo" count={9} tone="var(--sand)" />
      <Reveal className="story__lead">
        <p className="eyebrow">{STORY.eyebrow}</p>
        <h2 className="story__title" id="story-title">
          {STORY.heading[0]}
          <br />
          <em>{STORY.heading[1]}</em>
        </h2>
      </Reveal>

      <Reveal className="story__body" delay={90}>
        {STORY.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </Reveal>

      <ol className="story__pillars">
        {STORY.pillars.map((p, i) => (
          <Reveal as="li" key={p.k} className="story__pillar" delay={120 + i * 70}>
            <span className="story__k">{p.k}</span>
            <h3>{p.t}</h3>
            <p>{p.d}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}
