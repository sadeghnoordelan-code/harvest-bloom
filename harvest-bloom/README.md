# HARVEST BLOOM

Storefront for a house selling barberries, nuts and dried fruit. React + Vite,
no UI framework, no animation library.

```bash
npm install
npm run dev           # http://localhost:5173
npm run build
npm run preview
npm run build:single  # one self-contained .html, for sending to someone
```

`build:single` packs the production build into a single file next to the project
(`harvest-bloom-preview.html`, ~7.4 MB) that opens by double-clicking, with no
server and no network. It exists because a normal multi-file build cannot be
opened from `file://` at all: the entry is an ES module and browsers refuse to
load modules over that scheme. An *inline* module has no such restriction, so
the script, styles, pack shots, hero film and both typefaces are all embedded.

The app source is untouched by it. Assets keep their real paths in the bundle,
and a shim ahead of the app maps those paths to the embedded copies at the four
seams where this app names an asset — an `src`/`href` attribute, an image `src`
property, a media `src` property, and the hero's `fetch` of the film.

## Where things live

| Path | What it is |
| --- | --- |
| `src/data/products.js` | The catalogue. Prices, copy, origins, weight rules. |
| `src/data/brand.js` | Brand copy, nav, contact details, hero and story text. |
| `src/store/CartContext.jsx` | Cart state. A flat list of `{ id, grams }`. |
| `src/hooks/useLoopEngine.js` | The motion core behind the product sequence. |
| `src/components/HeroScrollVideo.jsx` | The scroll-scrubbed hero. |
| `src/lib/payment.js` | The payment seam. No gateway is connected. |
| `src/components/Atmosphere.jsx` | The drifting product silhouettes behind a section. |
| `src/styles/tokens.css` | The four colours, and the semantic tokens sections re-scope. |
| `tools/cutout/` | Regenerates the pack shots from the source photography. |

## Colour

Four colours: warm white, deep barberry burgundy, charcoal, warm neutral grey.
The page is built as a rhythm rather than a single ground — film, ivory, wine,
warm neutral, wine again (a lighter, rosier cast for the contact section), then
charcoal for the footer — so no section is a white template.

Components are never recoloured per section. They read *semantic* tokens
(`--ink`, `--ink-soft`, `--rule`, `--accent`, `--surface`) and a section
re-scopes those by carrying `.on-wine` or `.on-coal`. That is why the whole
product panel — its markup, layout and logic untouched — reads correctly on wine.

Two rules the tokens exist to protect:

- **Surfaces are literal hex.** A `--wine` defined as `color-mix(… var(--burgundy) …)`
  would be re-resolved inside a section that re-scopes `--accent`, and the
  background would move with the accent. Written literally, it cannot.
- **Nothing that carries a number takes an accent tint.** Prices, weights, the
  invoice and the total are plain `--ink` on their surface, at 14:1 or better.

### Changing the catalogue

`src/data/products.js` is the only place prices and product copy are written.
Prices are **minor units per 100 g** (`1180` is $11.80), so every amount stays an
integer and no rounding error accumulates. The loop, the product panel, the
header badge and the invoice all derive from it, so a stale cart can never
disagree with the catalogue.

Weights follow one rule, `normaliseGrams`: clamped to 100 g – 5 kg and settled
onto a 10 g grain. The stepper, the panel and the invoice all commit through it,
which is what keeps a quoted price and an ordered price equal.

## The product sequence

Scroll drives it, and nothing captures the wheel. The section carries a track
one `STEP_PX` tall per lot on top of a pinned viewport, so scrolling down walks
the lots forward and then releases to the order section, and scrolling back up
walks them in reverse and leaves for the story. There is no endless wrap and no
scroll-jacking: the page can always be scrolled straight through.

Clicking a pack, a name in the index or an arrow **scrolls** to that lot rather
than setting a second piece of state. Where the section is pinned the scroll
position *is* the state, so the two can never disagree.

At 150px a lot, six lots cost 750px of scroll — about one wheel notch each. At a
real 60fps the panel switches 50ms after the scroll crosses a midpoint and the
packs settle in 300ms.

### Pinning is gated on width

Pinning holds a block for the height of a viewport, so the block has to fit one.
It does at the two-column layout; it does not once the panel and the ring stack,
where the pair is over 1500px tall — pinning it there put the add-to-order button
under `overflow: hidden` and out of reach entirely.

So the pin is switched on at `min-width: 1101px` only, matching the width at
which the two columns split. Below it the section is ordinary flow, and because
page scroll is no longer driving the sequence, drag and swipe come back to do
that job instead. `pinned` is threaded through the engine, which is what decides
whether `setProgress` or `setIndex` owns the position and whether the drag
handlers are attached at all.

## The loop's geometry

The packs ride a band. Both come from a single `ringGeometry()` measurement, so
the band beneath a pack is literally the path that pack is travelling — they
cannot drift out of register.

On pointer widths it is a **half-ring**: the circle's centre sits on the right
edge of the stage, and the stage runs to the right edge of the viewport, so only
the left half of the structure is ever on screen and the rest carries off the
side. The focus — the leftmost point of the circle — lands beside the panel.

The angular step between packs is *not* 360/count. At that spacing a ring this
large would throw its neighbours far above and below the stage. It is solved
instead from where the neighbours should actually land:

```
rise:   r·sin(step) = DROP·h     how far a neighbour sits up or down
recede: r·(1−cos step) = BACK·w  how far it falls back toward the edge
```

whose ratio gives `tan(step/2)` directly, and `r` follows from the rise. Tune
`DROP` and `BACK` in `hooks/useLoopEngine.js` to change the arc; everything else
— pack size, band thickness, the band itself — follows.

Depth runs on `u`, the distance to the focus normalised so 0 is the focus and 1
is the far end of the sequence. Size and a little blur carry it; the fade only
starts past `u = 0.5`, so a lot is fully transparent by the time it is far
enough away to be off the arc.

Two layouts share the engine and differ only in that geometry: `ring` as above,
and `strip`, a shallow arc for touch.

`useLoopEngine` holds a float `pos` — `3.5` means "half way between the fourth
and fifth pack". Each frame it is damped toward `target` and written as
`transform`, `opacity`, `z-index` and `filter` straight to the DOM, so moving
through the sequence never re-renders React. Only the settled index is lifted
into state, which is what the panel listens to.

The sequence is linear, not a loop: `t` is simply `i - pos`, so it runs out at
both ends and lots far enough from the focus fade to nothing and take themselves
out of the way. Depth over the visible span is carried by size and a little blur
rather than by fading, so the lots you can see stay solid.

`prefers-reduced-motion` drops the damping — the packs then track the scroll
exactly, with nothing still moving once it stops — rather than disabling the
sequence.

## The hero

The clip is scrubbed by scroll and by nothing else. It never plays: there is no
`autoplay`, no `controls`, no play button, and a `play` listener that pauses
anything which manages to start it anyway. The whole file is fetched up front and
handed to the `<video>` as a blob URL, because seeking against a partially
buffered file stalls. Scroll position drives a damped `currentTime`, and seeks
smaller than half a frame are skipped.

### Scrub resolution

`PX_PER_FRAME` sets the feel, and it is stated in pixels per frame rather than
in viewport heights on purpose: a vh figure gives a different scrub on every
screen — 1400vh is 2.5 frames per wheel notch on a 720px window and 1.7 on a
1080px one — whereas a pixel budget per frame is identical everywhere. Once the
clip reports its duration the section is sized as
`frames × PX_PER_FRAME + 100lvh`; the vh constants are only the fallback until
then.

At 55px a 100px wheel notch advances the film ~1.8 frames, and a 57px notch
(Firefox's default) ~1.0. **The cost is a long section: ~19 screens of scroll on
desktop, ~11 on mobile.** That is the honest price of frame-level control over a
238-frame clip — resolution and section length are the same number. The skip
control and the skip link are the way past it. Lower `PX_PER_FRAME` for a
shorter hero and a coarser scrub.

### Reduced motion does not switch the film off

It used to, and that was wrong: with `prefers-reduced-motion: reduce` the hero
collapsed to one viewport and held a single frame, which turned the product into
a still image. Anyone browsing with that preference set — it is on by default in
some environments — saw a picture rather than the film.

The distinction the setting is about is *autonomous* motion, and the scrub is
not autonomous: every frame is driven directly by the visitor's own scroll, like
dragging a jog wheel. So the film, the full scrub length, the rail, the hint and
the skip control all stay. What the preference does turn off is the scrub's
easing — `smooth` tracks the scroll exactly, so nothing keeps moving after the
scroll stops — the chapter copy's travel, and everything that runs by itself:
the atmosphere drift, hover travel and entrance
reveals.

### Why progress is measured from the pin

A sticky child stays pinned for exactly `section height − pin height` pixels, so
that is the span progress divides by. Using `window.innerHeight` instead is
correct only where the two happen to match: on mobile the pin is a viewport unit
that does not track the visual viewport as the address bar collapses, and the
film would reach its last frame about 1% of the section before the pin released
— the tail of the scroll showing a frozen frame. `useScrollProgress` takes the
pin element and measures it.

The pin is `100lvh`, not `100svh`. `svh` is the height with the mobile address
bar showing, so the moment that bar collapses the pin is shorter than the screen
and a strip of the next section appears under the film.

How precise the scrub feels is set by `HERO_SCROLL_VH` in
`components/HeroScrollVideo.jsx`. At the default 900 vh the pinned span is about
8100 px for a 9.9 s clip, so one frame is roughly 34 px of scroll and a typical
wheel notch advances two or three frames. Raise it for a finer scrub and a
longer hero; lower it for a shorter one.

`prefers-reduced-motion` replaces the whole thing with a single held frame and
no pin.

## Payment

Nothing is connected, and the checkout button never pretends otherwise — it
reports that no provider is configured and holds an order reference. To go live,
implement a provider with the same shape and register it at boot:

```js
import { setPaymentProvider } from './lib/payment.js'

setPaymentProvider({
  id: 'stripe',
  async createCheckoutSession(order) {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
    const { url } = await res.json()
    return { status: 'redirect', url }
  },
})
```

`buildOrder()` already serialises the cart into a gateway-agnostic payload with
amounts in minor units. No UI has to change.

## Product artwork

`public/products/*.webp` are the supplied pack shots with the studio backdrop
removed — the packaging, labels and logo are the original artwork and must not
be redrawn or replaced. `public/brand/emblem.webp` is the emblem lifted from the
same source.

To regenerate them from `../Photos`:

```bash
npm run assets
```

That starts Vite in `assets` mode and opens `tools/cutout/index.html`. Press
**Regenerate assets**. The pixel work runs in the browser — canvas gives PNG and
WebP decode and encode for free, so the pipeline needs no image dependency — and
the finished bytes are written back through a small dev-only bridge.

The routes that bridge exposes write to your working tree, so they are mounted
**only** under `npm run assets`. Plain `npm run dev` never exposes them, and they
are never part of a production build.

How the backdrop is separated, and why it is separated by flatness rather than
by colour, is documented at the top of `tools/cutout/cutout.js`.
