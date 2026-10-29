import { createHash } from 'node:crypto'

export function hashSeed(...parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

export function rngFrom(seedHex) {
  let a = parseInt(seedHex.slice(0, 8), 16) >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick(rng, arr) {
  if (!arr.length) return undefined
  return arr[Math.floor(rng() * arr.length)]
}

export function weightedPick(rng, items, weightOf) {
  const weights = items.map((it) => Math.max(0, Number(weightOf(it)) || 0))
  const total = weights.reduce((a, b) => a + b, 0)
  if (!total) return pick(rng, items)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export function round(n, digits = 2) {
  const p = 10 ** digits
  return Math.round(n * p) / p
}
