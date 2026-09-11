export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export const lerp = (a, b, t) => a + (b - a) * t

/**
 * Frame-rate independent exponential smoothing.
 * `lambda` is the rate of approach per second; higher is snappier.
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export const mapRange = (v, inMin, inMax, outMin, outMax) =>
  outMin + ((clamp(v, inMin, inMax) - inMin) / (inMax - inMin)) * (outMax - outMin)

/** Shortest signed distance from `a` to `b` around a loop of `len`. */
export const wrapDelta = (a, b, len) => {
  let d = (b - a) % len
  if (d > len / 2) d -= len
  if (d < -len / 2) d += len
  return d
}

export const mod = (n, m) => ((n % m) + m) % m
