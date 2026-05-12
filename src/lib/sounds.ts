/** Web Audio: ambient bed + draw ticks + countdown + reveal sting */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  return ctx
}

export async function resumeAudio(): Promise<void> {
  const c = getCtx()
  if (c?.state === 'suspended') await c.resume()
}

let bgOscs: OscillatorNode[] = []

export function setBacksound(on: boolean): void {
  const c = getCtx()
  if (!c) return
  if (!on) {
    bgOscs.forEach((o) => {
      try {
        o.stop()
      } catch {
        /* */
      }
    })
    bgOscs = []
    return
  }
  if (bgOscs.length) return

  const master = c.createGain()
  master.gain.value = 0.06
  master.connect(c.destination)

  const freqs = [110, 164.81, 196]
  freqs.forEach((f, i) => {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.value = 0.25 + i * 0.08
    o.connect(g)
    g.connect(master)
    o.start()
    bgOscs.push(o)
  })
}

export function playTick(intensity: number): void {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(880 + intensity * 400, t)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
  o.connect(g)
  g.connect(c.destination)
  o.start(t)
  o.stop(t + 0.05)
}

export function playCount(n: number): void {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(220 + (4 - n) * 90, t)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  o.connect(g)
  g.connect(c.destination)
  o.start(t)
  o.stop(t + 0.6)
}

export function playReveal(): void {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  const chord = [523.25, 659.25, 783.99, 1046.5]
  chord.forEach((f, i) => {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t + i * 0.04)
    g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.04 + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    o.connect(g)
    g.connect(c.destination)
    o.start(t + i * 0.04)
    o.stop(t + 1)
  })
}
