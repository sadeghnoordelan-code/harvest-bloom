/** Brand copy, navigation and contact details. Placeholders are marked TODO. */

export const BRAND = {
  name: 'HARVEST BLOOM',
  wordmark: ['HARVEST', 'BLOOM'],
  emblem: '/brand/emblem',
  emblemSize: { width: 204, height: 179 },
  line: 'Gourmet barberries, nuts and dried fruit',
  established: '1998',
}

export const NAV = [
  { id: 'story', label: 'About', href: '#story' },
  { id: 'collection', label: 'Products', href: '#collection' },
  { id: 'order', label: 'Order', href: '#order' },
  { id: 'contact', label: 'Contact', href: '#contact' },
]

/* TODO: replace the placeholder values below with the real details. */
export const CONTACT = {
  phone: '+00 000 000 0000',
  phoneNote: 'Concierge, 9am to 6pm',
  email: 'hello@harvestbloom.example',
  emailNote: 'Replies within one business day',
  support: 'care@harvestbloom.example',
  supportNote: 'Orders, shipping and returns',
  address: ['HARVEST BLOOM Atelier', 'Street address', 'City, Postal code', 'Country'],
  social: [
    { label: 'Instagram', handle: '@harvestbloom', href: '#' },
    { label: 'Pinterest', handle: '/harvestbloom', href: '#' },
    { label: 'LinkedIn', handle: '/harvest-bloom', href: '#' },
  ],
}

/** Overlay copy for the scroll-scrubbed hero, keyed to normalised progress. */
export const HERO_CHAPTERS = [
  {
    at: 0.0,
    eyebrow: 'Established 1998 — single origin',
    title: ['Grown slowly.', 'Sealed at harvest.'],
    body: 'A small house that buys one lot at a time, from growers we can name.',
  },
  {
    at: 0.36,
    eyebrow: 'The signature',
    title: ['Barberry,', 'our first love.'],
    body: 'Shade-dried whole, so the skin stays lacquer-red and the acidity stays bright.',
  },
  {
    at: 0.7,
    eyebrow: 'The craft',
    title: ['Sorted by hand.', 'Nothing added.'],
    body: 'Colour-graded, nitrogen-flushed and closed the same week it is picked.',
  },
]

/** Editorial band between the hero and the collection. */
export const STORY = {
  eyebrow: 'The house',
  heading: ['We buy small,', 'and we buy once.'],
  body: [
    'HARVEST BLOOM began with a single terrace of barberry in South Khorasan and a stubborn idea: that the best fruit is not the biggest, and that nothing should be added to it.',
    'Every lot is bought whole from one grower, graded by hand on a lit table, and closed under nitrogen within days of picking. When a lot is gone, it is gone.',
  ],
  pillars: [
    { k: '01', t: 'Named growers', d: 'One lot, one family, one terrace. Traceable to the row.' },
    { k: '02', t: 'Hand-graded', d: 'Colour and calibre sorted on a lit table, never by machine alone.' },
    { k: '03', t: 'Sealed at source', d: 'Nitrogen-flushed, light-barrier pouches closed within the week.' },
    { k: '04', t: 'Nothing added', d: 'No sugar, no oil, no sulphur, no preservative. Ever.' },
  ],
}
