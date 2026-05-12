/** Web Audio: draw ticks + countdown + reveal sting, plus MP3 backsound */
import backsoundUrl from '../assets/backsound.mp3'

let ctx: AudioContext | null = null
let bgAudio: HTMLAudioElement | null = null
let sfxVolume = 1
let backsoundVolume = 0.35

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

function getBgAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!bgAudio) {
    bgAudio = new Audio(backsoundUrl)
    bgAudio.loop = true
    bgAudio.preload = 'auto'
    bgAudio.volume = backsoundVolume
  }
  return bgAudio
}

export function setBacksoundVolume(volume: number): void {
  backsoundVolume = Math.max(0, Math.min(1, volume))
  const audio = getBgAudio()
  if (audio) audio.volume = backsoundVolume
}

export function setSfxVolume(volume: number): void {
  sfxVolume = Math.max(0, Math.min(1, volume))
}

export function setBacksound(on: boolean): void {
  const audio = getBgAudio()
  if (!audio) return

  if (!on) {
    audio.pause()
    audio.currentTime = 0
    return
  }
  audio.volume = backsoundVolume
  void audio.play().catch(() => {
    /* Browser may block autoplay until user gesture. */
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
  g.gain.exponentialRampToValueAtTime(0.08 * sfxVolume, t + 0.01)
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
  g.gain.exponentialRampToValueAtTime(0.18 * sfxVolume, t + 0.02)
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
    g.gain.exponentialRampToValueAtTime(0.12 * sfxVolume, t + i * 0.04 + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    o.connect(g)
    g.connect(c.destination)
    o.start(t + i * 0.04)
    o.stop(t + 1)
  })
}
