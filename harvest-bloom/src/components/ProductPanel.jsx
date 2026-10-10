import { useEffect, useRef, useState } from 'react'
import WeightSelector from './WeightSelector.jsx'
import { DEFAULT_WEIGHT } from '../data/products.js'
import { formatMoney, formatWeight, priceFor } from '../lib/format.js'
import { useCart } from '../store/CartContext.jsx'

/**
 * Details for whichever product is at the focus of the loop.
 * The weight kept here is per product, so moving around the loop and coming
 * back restores what you had chosen.
 */
export default function ProductPanel({ product, weights, setWeight, index, count }) {
  const grams = weights[product.id] ?? DEFAULT_WEIGHT
  const amount = priceFor(product.pricePer100g, grams)
  const cart = useCart()
  const [added, setAdded] = useState(false)
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    setAdded(false)
    clearTimeout(timer.current)
  }, [product.id])

  const add = () => {
    cart.add(product.id, grams)
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 2400)
  }

  const inOrder = cart.gramsOf(product.id)

  return (
    <div className="panel" key={product.id} data-product-id={product.id}>
      <header className="panel__head">
        <p className="panel__count">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <i />
          <span>{String(count).padStart(2, '0')}</span>
        </p>
        {product.signature && <p className="panel__flag">Signature</p>}
      </header>

      <h3 className="panel__name">{product.name}</h3>
      <p className="panel__native" lang="fa" dir="rtl">
        {product.native}
      </p>
      <p className="panel__tagline">{product.tagline}</p>
      <p className="panel__desc">{product.description}</p>

      <dl className="panel__spec">
        <div>
          <dt>Origin</dt>
          <dd>{product.origin}</dd>
        </div>
        <div>
          <dt>Harvest</dt>
          <dd>{product.harvest}</dd>
        </div>
        <div>
          <dt>Grade</dt>
          <dd>{product.grade}</dd>
        </div>
        <div>
          <dt>Packaging</dt>
          <dd>{product.packaging}</dd>
        </div>
      </dl>

      <ul className="panel__notes">
        {product.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <div className="panel__buy">
        <div className="panel__rate">
          <span className="panel__rateValue">{formatMoney(product.pricePer100g)}</span>
          <span className="panel__rateUnit">per 100 g</span>
        </div>

        <div className="panel__controls">
          <WeightSelector
            id={`weight-${product.id}`}
            grams={grams}
            onChange={(g) => setWeight(product.id, g)}
          />
          <div className="panel__total">
            <span className="panel__totalLabel">{formatWeight(grams)}</span>
            <span className="panel__totalValue">{formatMoney(amount)}</span>
          </div>
        </div>

        <button
          type="button"
          className={`btn btn--primary panel__add${added ? ' is-added' : ''}`}
          onClick={add}
        >
          <span className="btn__label">
            {added ? 'Added to order' : `Add ${formatWeight(grams)} to order`}
          </span>
        </button>

        {inOrder > 0 && (
          <p className="panel__inOrder">
            {formatWeight(inOrder)} of {product.name.toLowerCase()} already in your order
          </p>
        )}
      </div>
    </div>
  )
}
