/**
 * Single source of truth for the catalogue.
 *
 * Prices are stored as minor units (cents) per 100 g so all arithmetic stays in
 * integers and never accumulates floating point error. Change a price, a
 * description or an origin here and it propagates to the loop, the product
 * panel, the cart and the invoice.
 *
 * `image` files are produced by tools/cutout from the supplied artwork — the
 * packaging, labels and logo are the original assets, cut out of their flat
 * studio backdrop. Do not replace them.
 */

/**
 * Intrinsic size of every pack shot. All six share one crop box, so they share
 * one aspect ratio — quoting it on the <img> reserves the space and keeps the
 * loop from shifting as the images arrive.
 */
export const IMAGE_SIZE = { width: 729, height: 728 }

export const CURRENCY = {
  code: 'USD',
  symbol: '$',
  locale: 'en-US',
}

/** Grams. The stepper moves in this unit; manual entry is clamped to the range. */
export const WEIGHT_STEP = 100
export const WEIGHT_MIN = 100
export const WEIGHT_MAX = 5000
export const WEIGHT_GRAIN = 10
export const DEFAULT_WEIGHT = 200

/**
 * The house weighs to the nearest 10 g, so that is the granularity a typed
 * weight settles on. The panel, the stepper and the invoice all commit through
 * this one rule, which is what keeps a quoted price and an ordered price equal.
 */
export const normaliseGrams = (grams) => {
  const n = Math.round(Number(grams) / WEIGHT_GRAIN) * WEIGHT_GRAIN
  if (!Number.isFinite(n)) return WEIGHT_MIN
  return Math.min(Math.max(n, WEIGHT_MIN), WEIGHT_MAX)
}

export const products = [
  {
    id: 'barberries',
    name: 'Barberries',
    latin: 'Berberis vulgaris',
    native: 'زرشک پفکی ممتاز',
    signature: true,
    tagline: 'The house signature — sun-jewelled, tart, impossibly light.',
    description:
      'Hand-picked at first blush from the terraced groves of South Khorasan, then shade-dried whole so each berry keeps its lacquer-red skin and its clean, bright acidity.',
    origin: 'South Khorasan, Iran',
    harvest: 'Late autumn, single lot',
    grade: 'Puffaki — the plump, air-dried grade',
    packaging: 'Nitrogen-flushed, light-barrier stand pouch',
    notes: ['Bright citrus acidity', 'Rose and pomegranate finish', 'No added sugar or oil'],
    pricePer100g: 1180,
    image: '/products/barberries',
  },
  {
    id: 'pistachio',
    name: 'Pistachios',
    latin: 'Pistacia vera',
    native: 'مغز پسته ممتاز',
    tagline: 'Long jade kernels with a slow, buttery sweetness.',
    description:
      'Whole kernels from the Rafsanjan basin, sorted by hand for colour and length, then gently roasted in small batches so the green stays green.',
    origin: 'Rafsanjan, Iran',
    harvest: 'September, first shake',
    grade: 'Extra-long kernel, colour sorted',
    packaging: 'Nitrogen-flushed, light-barrier stand pouch',
    notes: ['Buttery, faintly sweet', 'Deep jade kernel', 'Small-batch roasted'],
    pricePer100g: 1640,
    image: '/products/pistachio',
  },
  {
    id: 'walnut',
    name: 'Walnuts',
    latin: 'Juglans regia',
    native: 'مغز گردو ممتاز',
    tagline: 'Pale light-halves, snapped fresh, never bitter.',
    description:
      'Mountain-grown halves from Tuyserkan, cracked to order and kept cold from grove to pouch so the oils stay sweet and the skins stay pale.',
    origin: 'Tuyserkan, Hamadan',
    harvest: 'Early October',
    grade: 'Light halves, 80 % whole',
    packaging: 'Nitrogen-flushed, light-barrier stand pouch',
    notes: ['Sweet, creamy oil', 'Pale unblemished skin', 'Cold chain from grove'],
    pricePer100g: 980,
    image: '/products/walnut',
  },
  {
    id: 'hazelnut',
    name: 'Hazelnuts',
    latin: 'Corylus avellana',
    native: 'مغز فندق ممتاز',
    tagline: 'Round, blond and toasted just to the turn.',
    description:
      'Grown on the Caspian slopes where sea air slows the ripening. Roasted until the skin lifts and the sugars caramelise, then cooled fast.',
    origin: 'Rudsar, Gilan',
    harvest: 'August, hand-gathered',
    grade: '13–15 mm, calibre sorted',
    packaging: 'Nitrogen-flushed, light-barrier stand pouch',
    notes: ['Toasted praline aroma', 'Crisp, dry snap', 'Skin-on, hand-rubbed'],
    pricePer100g: 1240,
    image: '/products/hazelnut',
  },
  {
    id: 'almond',
    name: 'Almonds',
    latin: 'Prunus dulcis',
    native: 'مغز بادام ممتاز',
    tagline: 'Slim Mamra kernels, dense and quietly sweet.',
    description:
      'Rain-fed trees on the Chaharmahal highlands give a smaller, denser kernel with far less water and a marzipan sweetness that roasting only deepens.',
    origin: 'Chaharmahal & Bakhtiari',
    harvest: 'Late August',
    grade: 'Mamra, rain-fed, whole kernel',
    packaging: 'Nitrogen-flushed, light-barrier stand pouch',
    notes: ['Marzipan sweetness', 'Dense, low-moisture kernel', 'Rain-fed, unirrigated'],
    pricePer100g: 1090,
    image: '/products/almond',
  },
  {
    id: 'cashew',
    name: 'Cashews',
    latin: 'Anacardium occidentale',
    native: 'مغز بادام هندی ممتاز',
    tagline: 'W-320 wholes with a clean, milky break.',
    description:
      'Steam-shelled rather than drum-cracked, which keeps the kernel whole and the ivory colour even. Finished with nothing but a little heat.',
    origin: 'Kerala, India',
    harvest: 'March to May',
    grade: 'W-320, first-grade whole',
    packaging: 'Nitrogen-flushed, light-barrier stand pouch',
    notes: ['Milky, delicate break', 'Even ivory colour', 'Unsalted, unoiled'],
    pricePer100g: 1420,
    image: '/products/cashew',
  },
]

export const productById = Object.fromEntries(products.map((p) => [p.id, p]))
