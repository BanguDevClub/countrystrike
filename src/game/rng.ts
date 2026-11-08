/**
 * Small, deterministic PRNG (mulberry32).
 *
 * Every random event in the game is derived from a stored 32-bit state so that
 * a reload never rerolls a result and a seed can reproduce a world.
 */
export class RNG {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Current internal state, persist this value after a batch of rolls. */
  get value(): number {
    return this.state >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  int(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max))
    const hi = Math.floor(Math.max(min, max))
    return lo + Math.floor(this.next() * (hi - lo + 1))
  }

  /** Inclusive die roll: dice(6) → 1..6. */
  dice(sides: number): number {
    return this.int(1, sides)
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error('RNG.pick called with an empty array')
    return values[Math.floor(this.next() * values.length)] as T
  }

  shuffle<T>(values: readonly T[]): T[] {
    const copy = [...values]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1))
      const a = copy[i] as T
      const b = copy[j] as T
      copy[i] = b
      copy[j] = a
    }
    return copy
  }

  sample<T>(values: readonly T[], count: number): T[] {
    return this.shuffle(values).slice(0, Math.min(count, values.length))
  }

  weighted<T>(values: readonly T[], weights: readonly number[]): T {
    if (values.length !== weights.length || values.length === 0) {
      throw new Error('RNG.weighted requires matching, non-empty arrays')
    }
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
    if (total <= 0) return values[0] as T
    let threshold = this.next() * total
    for (let i = 0; i < values.length; i += 1) {
      threshold -= Math.max(0, weights[i] ?? 0)
      if (threshold <= 0) return values[i] as T
    }
    return values[values.length - 1] as T
  }
}

export const randomSeed = (): number => {
  const cryptoValue = globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0]
  return cryptoValue ?? Math.floor(Math.random() * 0xffffffff)
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount

export const roundTo = (value: number, decimals = 0): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0)
