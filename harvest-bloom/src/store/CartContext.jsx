import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { normaliseGrams, productById } from '../data/products.js'
import { priceFor } from '../lib/format.js'

/**
 * Cart state is a flat list of { id, grams }. Everything else — names, prices,
 * line amounts, the subtotal — is derived from the catalogue at read time, so a
 * price change in data/products.js is reflected everywhere at once and a stale
 * cart can never disagree with the catalogue.
 */

const STORAGE_KEY = 'harvest-bloom.cart.v1'

const initialState = { items: [] }

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return { items: action.items }

    case 'add': {
      const grams = normaliseGrams(action.grams)
      const existing = state.items.find((i) => i.id === action.id)
      if (!existing) return { items: [...state.items, { id: action.id, grams }] }
      // Adding a product already in the order tops up its weight.
      return {
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, grams: normaliseGrams(i.grams + grams) } : i,
        ),
      }
    }

    case 'setGrams':
      return {
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, grams: normaliseGrams(action.grams) } : i,
        ),
      }

    case 'remove':
      return { items: state.items.filter((i) => i.id !== action.id) }

    case 'clear':
      return initialState

    default:
      return state
  }
}

const CartContext = createContext(null)

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed
      .filter((i) => i && productById[i.id] && Number.isFinite(i.grams))
      .map((i) => ({ id: i.id, grams: normaliseGrams(i.grams) }))
  } catch {
    return null
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    const stored = readStored()
    if (stored?.length) dispatch({ type: 'hydrate', items: stored })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
    } catch {
      /* private mode or blocked storage — the cart simply won't persist */
    }
  }, [state.items])

  const value = useMemo(() => {
    const lines = state.items.map((item) => {
      const product = productById[item.id]
      return {
        id: item.id,
        grams: item.grams,
        name: product.name,
        native: product.native,
        image: product.image,
        pricePer100g: product.pricePer100g,
        amount: priceFor(product.pricePer100g, item.grams),
      }
    })

    return {
      lines,
      count: lines.length,
      totalGrams: lines.reduce((s, l) => s + l.grams, 0),
      subtotal: lines.reduce((s, l) => s + l.amount, 0),
      has: (id) => state.items.some((i) => i.id === id),
      gramsOf: (id) => state.items.find((i) => i.id === id)?.grams ?? 0,
      add: (id, grams) => dispatch({ type: 'add', id, grams }),
      setGrams: (id, grams) => dispatch({ type: 'setGrams', id, grams }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clear: () => dispatch({ type: 'clear' }),
    }
  }, [state.items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
