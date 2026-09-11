import { CURRENCY } from '../data/products.js'

const money = new Intl.NumberFormat(CURRENCY.locale, {
  style: 'currency',
  currency: CURRENCY.code,
  minimumFractionDigits: 2,
})

/** `cents` are minor units. All catalogue prices are stored this way. */
export const formatMoney = (cents) => money.format(cents / 100)

/** Price of `grams` at a per-100 g rate, rounded to whole minor units. */
export const priceFor = (pricePer100g, grams) =>
  Math.round((pricePer100g * grams) / 100)

export const formatWeight = (grams) =>
  grams >= 1000
    ? `${(grams / 1000).toLocaleString(CURRENCY.locale, { maximumFractionDigits: 2 })} kg`
    : `${grams} g`

export const formatGrams = (grams) => `${grams.toLocaleString(CURRENCY.locale)} g`
