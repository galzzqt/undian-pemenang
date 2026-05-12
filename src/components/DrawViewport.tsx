import { useEffect, useRef, useState } from 'react'
import type { Participant } from '../types'
import { pickRandomParticipant } from '../lib/random'
import { playTick } from '../lib/sounds'

type Props = {
  pool: readonly Participant[]
  active: boolean
  winner: Participant | null
  sfxOn: boolean
  onShuffleComplete: () => void
}

const LANE_COUNT = 5

/** Satu loop rAF: kartu tengah + kolom samping; setState sekali per frame */
export function DrawViewport({ pool, active, winner, sfxOn, onShuffleComplete }: Props) {
  const [frame, setFrame] = useState({
    hero: '',
    sub: '',
    glow: 0,
    rails: Array.from({ length: LANE_COUNT }, () => ''),
  })
  const doneRef = useRef(false)
  const sfxRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    doneRef.current = false
    if (!active || !winner || pool.length === 0) {
      if (!active) {
        setFrame((f) => ({ ...f, glow: 0 }))
      }
      return
    }

    const start = performance.now()
    const duration = 5600

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = 1 - (1 - t) ** 3.2
      const bias = ease ** 1.35

      const showWinner = Math.random() < bias
      const pick = showWinner ? winner : pickRandomParticipant(pool) ?? winner
      const rails = Array.from({ length: LANE_COUNT }, () => pickRandomParticipant(pool)?.name ?? '—')

      setFrame({
        hero: pick.name,
        sub: [pick.no, pick.category].filter(Boolean).join(' · '),
        glow: 0.35 + ease * 0.65,
        rails,
      })

      const tickGap = 28 + ease * 220
      if (sfxOn && now - sfxRef.current > tickGap) {
        playTick(ease)
        sfxRef.current = now
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!doneRef.current) {
        doneRef.current = true
        setFrame({
          hero: winner.name,
          sub: [winner.no, winner.category].filter(Boolean).join(' · '),
          glow: 1,
          rails,
        })
        onShuffleComplete()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, onShuffleComplete, pool, sfxOn, winner])

  return (
    <div className="draw-viewport">
      <div className="draw-viewport__grid">
        <aside className="draw-viewport__rails" aria-hidden="true">
          {frame.rails.map((text, i) => (
            <div key={i} className="draw-viewport__rail">
              <span className="draw-viewport__rail-text">{text}</span>
            </div>
          ))}
        </aside>

        <div className="draw-viewport__center">
          <p className="draw-viewport__label">UNDIAN PEMENANG TOPSELL</p>
          <div
            className="draw-viewport__card"
            style={{ '--g': frame.glow } as React.CSSProperties}
          >
            <div className="draw-viewport__scan" />
            {active || frame.hero ? (
              <>
                <span className="draw-viewport__hero">{frame.hero || '—'}</span>
                <span className="draw-viewport__meta">{frame.sub}</span>
              </>
            ) : (
              <span className="draw-viewport__placeholder">Siap mengacak peserta</span>
            )}
          </div>
        </div>

        <aside className="draw-viewport__rails draw-viewport__rails--right" aria-hidden="true">
          {frame.rails.map((_, i) => (
            <div key={i} className="draw-viewport__rail">
              <span className="draw-viewport__rail-text">{frame.rails[LANE_COUNT - 1 - i]!}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
