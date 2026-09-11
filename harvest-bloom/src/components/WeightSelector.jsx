import { useEffect, useState } from 'react'
import { normaliseGrams, WEIGHT_MAX, WEIGHT_MIN, WEIGHT_STEP } from '../data/products.js'
import { clamp } from '../lib/math.js'

/**
 * Weight stepper with free-text entry.
 *
 * While the field has focus the raw string is kept as typed so a value can be
 * cleared and retyped; it is clamped to the allowed range on blur or Enter.
 * Every accepted value is pushed up immediately, which is what makes the price
 * read-out and the invoice update as you type.
 */
export default function WeightSelector({
  grams,
  onChange,
  id,
  size = 'lg',
  label = 'Weight',
}) {
  const [draft, setDraft] = useState(String(grams))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(String(grams))
  }, [grams, editing])

  const nudge = (dir) => {
    const next = clamp(
      Math.round(grams / WEIGHT_STEP) * WEIGHT_STEP + dir * WEIGHT_STEP,
      WEIGHT_MIN,
      WEIGHT_MAX,
    )
    onChange(next)
  }

  // Settling on the house's 10 g grain is what stops the panel quoting a price
  // the invoice would then round away from.
  const commit = (raw) => {
    const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10)
    const next = normaliseGrams(Number.isFinite(n) ? n : WEIGHT_MIN)
    setDraft(String(next))
    onChange(next)
  }

  return (
    <div className={`weight weight--${size}`}>
      <button
        type="button"
        className="weight__btn"
        onClick={() => nudge(-1)}
        disabled={grams <= WEIGHT_MIN}
        aria-label={`Decrease ${label.toLowerCase()} by ${WEIGHT_STEP} grams`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8h10" />
        </svg>
      </button>

      <div className="weight__field">
        <input
          id={id}
          className="weight__input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          aria-label={`${label} in grams`}
          onFocus={(e) => {
            setEditing(true)
            e.target.select()
          }}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 5)
            setDraft(raw)
            const n = parseInt(raw, 10)
            if (Number.isFinite(n) && n >= WEIGHT_MIN && n <= WEIGHT_MAX) onChange(n)
          }}
          onBlur={(e) => {
            setEditing(false)
            commit(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              nudge(1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              nudge(-1)
            }
          }}
        />
        <span className="weight__unit">g</span>
      </div>

      <button
        type="button"
        className="weight__btn"
        onClick={() => nudge(1)}
        disabled={grams >= WEIGHT_MAX}
        aria-label={`Increase ${label.toLowerCase()} by ${WEIGHT_STEP} grams`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
    </div>
  )
}
