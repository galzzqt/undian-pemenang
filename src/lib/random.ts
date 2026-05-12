import type { Participant } from '../types'

/** Uniform index in [0, max) using crypto when available */
export function randomInt(max: number): number {
  if (max <= 0) return 0
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! % max
}

export function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[randomInt(arr.length)]!
}

export function pickRandomParticipant(pool: readonly Participant[]): Participant | undefined {
  return pickRandom(pool)
}

/** Acak dari pool tanpa satu peserta (agar nama pemenang tidak bocor saat animasi) */
export function pickRandomParticipantExcluding(
  pool: readonly Participant[],
  exclude: Participant,
): Participant | undefined {
  const filtered = pool.filter((p) => p.id !== exclude.id)
  return pickRandomParticipant(filtered)
}
