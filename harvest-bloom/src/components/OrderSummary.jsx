import { useState } from 'react'
import WeightSelector from './WeightSelector.jsx'
import { CURRENCY, IMAGE_SIZE } from '../data/products.js'
import { formatMoney, formatWeight } from '../lib/format.js'
import { useCart } from '../store/CartContext.jsx'
import { buildOrder, createCheckoutSession, makeOrderReference } from '../lib/payment.js'

/**
 * Order summary and checkout.
 *
 * Every line is derived from cart state, so editing a weight here recalculates
 * that line and the total in the same render. Checkout hands a
 * gateway-agnostic payload to lib/payment.js; with no provider connected it
 * reports that plainly rather than pretending the order was paid.
 */
export default function OrderSummary() {
  const cart = useCart()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const pay = async () => {
    if (!cart.lines.length || busy) return
    setBusy(true)
    setStatus(null)
    const reference = makeOrderReference()
    const order = buildOrder({
      lines: cart.lines,
      subtotal: cart.subtotal,
      currency: CURRENCY.code,
      reference,
    })
    const result = await createCheckoutSession(order)
    setBusy(false)

    if (result.status === 'redirect' && result.url) {
      window.location.assign(result.url)
      return
    }
    setStatus({ ...result, reference })
  }

  const empty = cart.lines.length === 0

  return (
    <section id="order" className="order order-band" aria-labelledby="order-title">
      <div className="order__intro">
        <p className="eyebrow">Your order</p>
        <h2 className="order__title" id="order-title">
          The invoice
        </h2>
        <p className="order__lede">
          Adjust any weight and the line recalculates as you type.
        </p>
      </div>

      <div className="order__sheet">
        {empty ? (
          <div className="order__empty">
            <p>Nothing selected yet.</p>
            <a
              className="btn btn--ghost"
              href="#collection"
              onClick={(e) => {
                e.preventDefault()
                document
                  .querySelector('#collection')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              Browse the collection
            </a>
          </div>
        ) : (
          <>
            <div className="order__head" aria-hidden="true">
              <span>Lot</span>
              <span>Per 100 g</span>
              <span>Weight</span>
              <span>Amount</span>
              <span />
            </div>

            <ul className="order__lines">
              {cart.lines.map((line) => (
                <li className="order__line" key={line.id}>
                  <div className="order__lot">
                    <img
                      src={`${line.image}.webp`}
                      alt=""
                      width={IMAGE_SIZE.width}
                      height={IMAGE_SIZE.height}
                      loading="lazy"
                      decoding="async"
                    />
                    <div>
                      <p className="order__lotName">{line.name}</p>
                      <p className="order__lotNative" lang="fa" dir="rtl">
                        {line.native}
                      </p>
                    </div>
                  </div>

                  <div className="order__rate">
                    <span className="order__mobLabel">Per 100 g</span>
                    {formatMoney(line.pricePer100g)}
                  </div>

                  <div className="order__weight">
                    <span className="order__mobLabel">Weight</span>
                    <WeightSelector
                      id={`order-weight-${line.id}`}
                      grams={line.grams}
                      size="sm"
                      label={`${line.name} weight`}
                      onChange={(g) => cart.setGrams(line.id, g)}
                    />
                  </div>

                  <div className="order__amount">
                    <span className="order__mobLabel">Amount</span>
                    {formatMoney(line.amount)}
                  </div>

                  <button
                    type="button"
                    className="order__remove"
                    onClick={() => cart.remove(line.id)}
                    aria-label={`Remove ${line.name} from your order`}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>

            <div className="order__totals">
              <div className="order__row">
                <span>Items</span>
                <span>
                  {cart.count} {cart.count === 1 ? 'lot' : 'lots'} ·{' '}
                  {formatWeight(cart.totalGrams)}
                </span>
              </div>
              <div className="order__row">
                <span>Subtotal</span>
                <span>{formatMoney(cart.subtotal)}</span>
              </div>
              <div className="order__row order__row--muted">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="order__row order__row--total">
                <span>Total</span>
                <span>{formatMoney(cart.subtotal)}</span>
              </div>
            </div>

            <div className="order__actions">
              <button type="button" className="order__clear" onClick={cart.clear}>
                Clear order
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={pay}
                disabled={busy}
              >
                <span className="btn__label">
                  {busy ? 'Contacting gateway…' : 'Proceed to Payment'}
                </span>
              </button>
            </div>

            {status && (
              <div
                className={`order__notice order__notice--${status.status === 'error' ? 'error' : 'info'}`}
                role="status"
              >
                {status.status === 'unconfigured' ? (
                  <>
                    <p className="order__noticeTitle">
                      Payment is not connected on this build.
                    </p>
                    <p>
                      Your order reference is{' '}
                      <strong>{status.reference}</strong>. Nothing has been charged and no
                      card details were requested. Your selection remains in your basket.
                      Please contact us to arrange your order.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="order__noticeTitle">Checkout could not be started.</p>
                    <p>{status.message || 'Please try again shortly.'}</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
