/**
 * HARVEST BLOOM — product cutout pipeline.
 *
 * The supplied artwork is a composed poster: a flat two-tone backdrop, the
 * stand pouch on the left, a bowl of the loose product on the right, and the
 * brand emblem floating above. This lifts the pouch and bowl onto a transparent
 * canvas and exports the emblem as a standalone brand asset.
 *
 * The artwork itself is never altered — packaging, labels and logo are
 * untouched. Only the flat backdrop and its cast shadow are removed.
 *
 * How the backdrop is separated
 * -----------------------------
 * Not by colour: the dark wood panel on each pouch sits within ~10 RGB units of
 * the dark half of the backdrop. By *flatness* instead. Measured over a 7×7
 * window, the backdrop's local standard deviation peaks at about 1.3 while every
 * photographed part of the product is textured well above that. A threshold of
 * 2.8 clears the backdrop and its soft cast shadow without biting into the
 * pouch.
 *
 * Flatness is measured one half at a time, with the opposite half painted out in
 * that half's own backdrop tone, so the hard seam between the two tones never
 * lands inside the measuring window and never reads as an edge.
 *
 * Runs in the browser, where PNG and WebP decode and encode come for free — see
 * index.html in this folder. No image dependency, no build step.
 */

/** Local standard deviation of luminance over a (2r+1)² window, via integral images. */
export function localSigma(W, H, lum, r) {
  const stride = W + 1
  const s1 = new Float64Array(stride * (H + 1))
  const s2 = new Float64Array(stride * (H + 1))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = lum[y * W + x]
      const k = (y + 1) * stride + (x + 1)
      s1[k] = v + s1[k - 1] + s1[k - stride] - s1[k - stride - 1]
      s2[k] = v * v + s2[k - 1] + s2[k - stride] - s2[k - stride - 1]
    }
  }
  const box = (A, x0, y0, x1, y1) =>
    A[y1 * stride + x1] - A[y0 * stride + x1] - A[y1 * stride + x0] + A[y0 * stride + x0]

  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(H, y + r + 1)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(W, x + r + 1)
      const n = (x1 - x0) * (y1 - y0)
      const m = box(s1, x0, y0, x1, y1) / n
      out[y * W + x] = Math.sqrt(Math.max(box(s2, x0, y0, x1, y1) / n - m * m, 0))
    }
  }
  return out
}

/** Every mask pixel reachable from the image border, 4-connected. */
export function floodFromBorder(W, H, passable) {
  const seen = new Uint8Array(W * H)
  const stack = new Int32Array(W * H)
  let sp = 0
  const push = (i) => {
    if (!seen[i] && passable[i]) {
      seen[i] = 1
      stack[sp++] = i
    }
  }
  for (let x = 0; x < W; x++) {
    push(x)
    push((H - 1) * W + x)
  }
  for (let y = 0; y < H; y++) {
    push(y * W)
    push(y * W + W - 1)
  }
  while (sp > 0) {
    const i = stack[--sp]
    const x = i % W
    const y = (i / W) | 0
    if (x > 0) push(i - 1)
    if (x < W - 1) push(i + 1)
    if (y > 0) push(i - W)
    if (y < H - 1) push(i + W)
  }
  return seen
}

/** Columns spanning the blend between the two backdrop tones, widened past it. */
function seamBounds(W, H, data, margin = 8) {
  const at = (x, y) => {
    const i = (y * W + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  const cols = []
  for (let x = 1; x < W; x++) {
    if (Math.abs(x - W / 2) >= 40) continue
    const a = at(x - 1, 3)
    const b = at(x, 3)
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 40) cols.push(x)
  }
  const mid = (W / 2) | 0
  if (!cols.length) return [mid - margin, mid + margin]
  return [Math.min(...cols) - margin, Math.max(...cols) + margin]
}

/** Median colour of a column range, sampled from the top and bottom edges. */
function backdropTone(W, H, data, x0, x1) {
  const ch = [[], [], []]
  const rows = [0, 1, 2, 3, 4, 5, H - 6, H - 5, H - 4, H - 3, H - 2, H - 1]
  for (const y of rows) {
    for (let x = x0; x < x1; x += 3) {
      const i = (y * W + x) * 4
      ch[0].push(data[i])
      ch[1].push(data[i + 1])
      ch[2].push(data[i + 2])
    }
  }
  return ch.map((a) => {
    a.sort((p, q) => p - q)
    return a[a.length >> 1]
  })
}

/** The flat backdrop, as a mask, resolved half by half so the seam is ignored. */
export function backdropMask({ W, H, data }, threshold, radius) {
  const [s0, s1] = seamBounds(W, H, data)
  const left = backdropTone(W, H, data, 0, Math.max(1, s0))
  const right = backdropTone(W, H, data, Math.min(W - 1, s1), W)

  const half = (fillFrom, fillTo, tone) => {
    const lum = new Float32Array(W * H)
    const flat = (tone[0] + tone[1] + tone[2]) / 3
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        lum[y * W + x] =
          x >= fillFrom && x < fillTo ? flat : (data[i] + data[i + 1] + data[i + 2]) / 3
      }
    }
    const sigma = localSigma(W, H, lum, radius)
    const passable = new Uint8Array(W * H)
    for (let i = 0; i < passable.length; i++) passable[i] = sigma[i] <= threshold ? 1 : 0
    return floodFromBorder(W, H, passable)
  }

  const bgLeft = half(s0, W, left)
  const bgRight = half(0, s1, right)

  const bg = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < s0; x++) bg[row + x] = bgLeft[row + x]
    for (let x = s1; x < W; x++) bg[row + x] = bgRight[row + x]
    // The seam strip belongs to the backdrop only when both sides agree, which
    // rejoins the pouch and the bowl where they meet across it.
    const both = bgLeft[row + Math.max(0, s0 - 1)] && bgRight[row + Math.min(W - 1, s1)]
    for (let x = s0; x < s1; x++) bg[row + x] = both ? 1 : 0
  }
  return { bg, seam: [s0, s1], tones: { left, right } }
}

/** 4-connected components, largest first. */
export function components(W, H, mask) {
  const labels = new Int32Array(W * H).fill(-1)
  const stack = new Int32Array(W * H)
  const found = []
  let id = 0

  for (let seed = 0; seed < W * H; seed++) {
    if (!mask[seed] || labels[seed] >= 0) continue
    let sp = 0
    stack[sp++] = seed
    labels[seed] = id
    let area = 0
    let x0 = W
    let y0 = H
    let x1 = 0
    let y1 = 0
    while (sp > 0) {
      const i = stack[--sp]
      const x = i % W
      const y = (i / W) | 0
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x > 0 && mask[i - 1] && labels[i - 1] < 0) (labels[i - 1] = id), (stack[sp++] = i - 1)
      if (x < W - 1 && mask[i + 1] && labels[i + 1] < 0) (labels[i + 1] = id), (stack[sp++] = i + 1)
      if (y > 0 && mask[i - W] && labels[i - W] < 0) (labels[i - W] = id), (stack[sp++] = i - W)
      if (y < H - 1 && mask[i + W] && labels[i + W] < 0) (labels[i + W] = id), (stack[sp++] = i + W)
    }
    found.push({ id, area, box: [x0, y0, x1 + 1, y1 + 1] })
    id++
  }
  found.sort((a, b) => b.area - a.area)
  return { labels, comps: found }
}

export function erode(W, H, m) {
  const o = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      o[i] =
        m[i] &&
        (x === 0 || m[i - 1]) &&
        (x === W - 1 || m[i + 1]) &&
        (y === 0 || m[i - W]) &&
        (y === H - 1 || m[i + W])
          ? 1
          : 0
    }
  }
  return o
}

export function dilate(W, H, m) {
  const o = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      o[i] =
        m[i] ||
        (x > 0 && m[i - 1]) ||
        (x < W - 1 && m[i + 1]) ||
        (y > 0 && m[i - W]) ||
        (y < H - 1 && m[i + W])
          ? 1
          : 0
    }
  }
  return o
}

/** Erode then dilate: sheds the thin cast-shadow tail, keeps the body intact. */
export function open(W, H, m, k) {
  let a = m
  for (let i = 0; i < k; i++) a = erode(W, H, a)
  for (let i = 0; i < k; i++) a = dilate(W, H, a)
  const o = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) o[i] = a[i] && m[i] ? 1 : 0 // never grow past the silhouette
  return o
}

/** Separable box blur, repeated — a cheap gaussian for the alpha feather. */
function blur(W, H, src, r, passes) {
  let cur = Float32Array.from(src)
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0
        let n = 0
        for (let k = -r; k <= r; k++) {
          const xx = x + k
          if (xx >= 0 && xx < W) {
            s += cur[y * W + xx]
            n++
          }
        }
        tmp[y * W + x] = s / n
      }
    }
    const out = new Float32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0
        let n = 0
        for (let k = -r; k <= r; k++) {
          const yy = y + k
          if (yy >= 0 && yy < H) {
            s += tmp[yy * W + x]
            n++
          }
        }
        out[y * W + x] = s / n
      }
    }
    cur = out
  }
  return cur
}

/**
 * Mask to RGBA. The silhouette is trimmed by a pixel before it is feathered, so
 * no rim of backdrop colour survives to fringe against the ivory page.
 */
export function toRGBA({ W, H, data }, mask) {
  const core = erode(W, H, mask)
  const soft = blur(W, H, core, 1, 2)
  const out = new Uint8ClampedArray(W * H * 4)
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    out[p] = data[p]
    out[p + 1] = data[p + 1]
    out[p + 2] = data[p + 2]
    out[p + 3] = Math.round(255 * (core[i] ? Math.max(soft[i], 0.98) : Math.min(soft[i], 1)))
  }
  return out
}

/** Tight bounds of everything above a given alpha. */
export function alphaBounds(W, H, rgba, t = 8) {
  let x0 = W
  let y0 = H
  let x1 = 0
  let y1 = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (rgba[(y * W + x) * 4 + 3] > t) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return [x0, y0, x1 + 1, y1 + 1]
}

export const SETTINGS = {
  threshold: 2.8, // local sigma at or below this is backdrop
  radius: 3, // flatness window radius, px
  opening: 4, // morphological opening, px — clears the cast-shadow tail
  minArea: 0.01, // components smaller than this share of the frame are specks
}

/** Segment one poster into a product cutout and, if present, the free-floating emblem. */
export function segment(image, settings = SETTINGS) {
  const { W, H } = image
  const { bg } = backdropMask(image, settings.threshold, settings.radius)
  const fg = new Uint8Array(W * H)
  for (let i = 0; i < fg.length; i++) fg[i] = bg[i] ? 0 : 1

  const first = components(W, H, fg)
  const total = W * H
  // The emblem floats free above the product; it ships as a brand asset, not as
  // part of the pack shot.
  const isEmblem = (c) => c.box[3] < H * 0.3 && c.box[0] > W * 0.25 && c.box[2] < W * 0.78
  const keep = first.comps.filter((c) => c.area > total * settings.minArea && !isEmblem(c))
  const embComp = first.comps.find((c) => isEmblem(c) && c.area > total * 0.004)

  const maskFrom = (labels, ids) => {
    const set = new Set(ids)
    const m = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) if (labels[i] >= 0 && set.has(labels[i])) m[i] = 1
    return m
  }

  const opened = open(W, H, maskFrom(first.labels, keep.map((c) => c.id)), settings.opening)
  const second = components(W, H, opened)
  const body = maskFrom(
    second.labels,
    second.comps.filter((c) => c.area > total * settings.minArea).map((c) => c.id),
  )

  const product = toRGBA(image, body)
  const emblem = embComp ? toRGBA(image, maskFrom(first.labels, [embComp.id])) : null
  return {
    product,
    emblem,
    productBox: alphaBounds(W, H, product),
    emblemBox: emblem ? alphaBounds(W, H, emblem) : null,
  }
}
