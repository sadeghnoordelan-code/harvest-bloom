/**
 * Payment seam.
 *
 * The checkout flow calls `createCheckoutSession(order)` and reacts to the
 * returned status. No gateway is wired up yet, so the default provider reports
 * `unconfigured` and the UI says so plainly - it never simulates a successful
 * charge.
 *
 * To go live, implement a provider with the same shape and pass it to
 * `setPaymentProvider()` at boot. Nothing in the UI needs to change:
 *
 *   setPaymentProvider({
 *     id: 'stripe',
 *     async createCheckoutSession(order) {
 *       const res = await fetch('/api/checkout', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify(order),
 *       })
 *       const { url } = await res.json()
 *       return { status: 'redirect', url }
 *     },
 *   })
 *
 * A provider must resolve to one of:
 *   { status: 'redirect', url }        - hand off to a hosted checkout
 *   { status: 'requires_action', ... } - 3DS or similar
 *   { status: 'error', message }       - surfaced to the customer
 *   { status: 'unconfigured' }         - no gateway connected
 */

const placeholderProvider = {
  id: 'placeholder',
  async createCheckoutSession() {
    return { status: 'unconfigured' }
  },
}

let provider = placeholderProvider

export function setPaymentProvider(next) {
  provider = next || placeholderProvider
}

export function getPaymentProvider() {
  return provider
}

/** Stable, human-quotable reference so a customer can be helped by phone. */
export function makeOrderReference() {
  const n = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')
  return `HB-${new Date().getFullYear()}-${n}`
}

/**
 * Serialise cart state into a gateway-agnostic order payload.
 * Amounts stay in minor units.
 */
export function buildOrder({ lines, subtotal, currency, reference }) {
  return {
    reference,
    currency,
    subtotal,
    total: subtotal,
    lines: lines.map((l) => ({
      sku: l.id,
      name: l.name,
      grams: l.grams,
      unitPricePer100g: l.pricePer100g,
      amount: l.amount,
    })),
    createdAt: new Date().toISOString(),
  }
}

export async function createCheckoutSession(order) {
  try {
    return await provider.createCheckoutSession(order)
  } catch (err) {
    return { status: 'error', message: err?.message || 'Checkout could not be started.' }
  }
}
