import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Participant } from '../types'
import { pickRandomParticipant, pickRandomParticipantExcluding } from '../lib/random'
import { playTick } from '../lib/sounds'

type Props = {
  pool: readonly Participant[]
  active: boolean
  winner: Participant | null
  sfxOn: boolean
  onShuffleComplete: () => void
}

const ROWS = 7
const CENTER = 3

type ReelState = {
  names: string[]
  subs: string[]
  motion: number
  blur: number
  t: number
}

/** Gulir nama: kecepatan sedang → melambat panjang → berhenti halus di pemenang (tengah) */
export function DrawViewport({ pool, active, winner, sfxOn, onShuffleComplete }: Props) {
  const [reel, setReel] = useState<ReelState | null>(null)
  const doneRef = useRef(false)
  const sfxRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    doneRef.current = false
    if (!active || !winner || pool.length === 0) {
      setReel(null)
      return
    }

    const start = performance.now()
    /** Durasi lebih panjang agar terasa tidak terburu-buru */
    const duration = 10800

    const tick = (now: number) => {
      const rawT = Math.min(1, (now - start) / duration)

      /**
       * Energi gulir: turun mulai awal tapi pengereman terasa panjang di ujung (pow tinggi).
       */
      const settle = (1 - rawT) ** 2.35
      /** Frekuensi sin rendah = scroll tidak terlalu cepat; turun saat mendekati stop */
      const wobbleHz = 0.0068 + settle * 0.016
      const motion = settle * 12 * Math.sin(now * wobbleHz)
      const blur = settle * 0.9

      const names: string[] = []
      const subs: string[] = []
      for (let i = 0; i < ROWS; i++) {
        const isCenter = i === CENTER
        let pick: Participant
        if (rawT < 1) {
          /** Selama gulir: jangan pernah tampilkan nama pemenang (tengah & samping) */
          pick =
            pickRandomParticipantExcluding(pool, winner) ??
            pickRandomParticipant(pool) ??
            winner
        } else {
          /** Satu frame berhenti: hanya baris tengah yang pemenang */
          pick = isCenter
            ? winner
            : pickRandomParticipantExcluding(pool, winner) ??
              pickRandomParticipant(pool) ??
              winner
        }
        names.push(pick.name)
        subs.push([pick.no, pick.category].filter(Boolean).join(' · '))
      }

      const displayT = 1 - (1 - rawT) ** 2.6
      setReel({ names, subs, motion, blur, t: displayT })

      const tickGap = 72 + (1 - settle) * 240
      if (sfxOn && now - sfxRef.current > tickGap) {
        playTick(displayT * 0.65)
        sfxRef.current = now
      }

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!doneRef.current) {
        doneRef.current = true
        const names: string[] = []
        const subs: string[] = []
        for (let i = 0; i < ROWS; i++) {
          const p =
            i === CENTER
              ? winner
              : pickRandomParticipantExcluding(pool, winner) ??
                pickRandomParticipant(pool) ??
                winner
          names.push(p.name)
          subs.push([p.no, p.category].filter(Boolean).join(' · '))
        }
        setReel({
          names,
          subs,
          motion: 0,
          blur: 0,
          t: 1,
        })
        onShuffleComplete()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, onShuffleComplete, pool, sfxOn, winner])

  const glow = active && reel ? 0.28 + reel.t * 0.62 : reel?.t ? 0.5 : 0

  return (
    <div className="draw-viewport draw-viewport--solo">
      <div className="draw-viewport__center">
        <p className="draw-viewport__label">UNDIAN PEMENANG TOPSELL</p>
        <div
          className="draw-viewport__card"
          style={{ '--g': glow } as React.CSSProperties}
        >
          <div className="draw-viewport__scan" />
          {active && reel ? (
            <motion.div 
              className="scroll-reel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="scroll-reel__strip"
                animate={{ translateY: reel.motion }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                {reel.names.map((name, i) => {
                  const isCenter = i === CENTER
                  const rowBlur = isCenter ? 0 : reel.blur
                  return (
                    <motion.div
                      key={i}
                      className="scroll-reel__row"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        filter: rowBlur > 0.02 ? `blur(${rowBlur}px)` : "none"
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="scroll-reel__name">{name}</span>
                      {isCenter && reel.subs[i] ? (
                        <span className="scroll-reel__sub">{reel.subs[i]}</span>
                      ) : null}
                    </motion.div>
                  )
                })}
              </motion.div>
            </motion.div>
          ) : (
            <motion.span 
              className="draw-viewport__placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              Siap mengundi
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
}
