import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import type { DrawPhase, Participant, WinnerRecord } from './types'
import { parseParticipantsFile } from './lib/parseFile'
import { pickRandomParticipant } from './lib/random'
import {
  playCount,
  playReveal,
  resumeAudio,
  setBacksound,
} from './lib/sounds'
import { DrawViewport } from './components/DrawViewport'
import logo from './assets/logo.png'

function fireCelebration(root: HTMLElement | null) {
  const rect = root?.getBoundingClientRect()
  const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5
  const y = rect ? (rect.top + rect.height * 0.35) / window.innerHeight : 0.35

  const count = 160
  confetti({
    particleCount: count,
    spread: 86,
    startVelocity: 38,
    origin: { x, y },
    ticks: 280,
    gravity: 0.9,
    scalar: 1.05,
    colors: ['#ffffff', '#fecaca', '#f87171', '#ef4444', '#b91c1c', '#7f1d1d'],
  })
  window.setTimeout(() => {
    confetti({
      particleCount: Math.floor(count * 0.6),
      angle: 60,
      spread: 70,
      origin: { x: Math.max(0.15, x - 0.2), y },
      colors: ['#fff', '#fca5a5', '#dc2626'],
    })
    confetti({
      particleCount: Math.floor(count * 0.6),
      angle: 120,
      spread: 70,
      origin: { x: Math.min(0.85, x + 0.2), y },
      colors: ['#fff', '#fecaca', '#b91c1c'],
    })
  }, 220)
}

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<Participant | null>(null)
  const snapshotRef = useRef<Participant[]>([])

  const [pool, setPool] = useState<Participant[]>([])
  const [history, setHistory] = useState<WinnerRecord[]>([])
  const [phase, setPhase] = useState<DrawPhase>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [drawKey, setDrawKey] = useState(0)
  const [displayWinner, setDisplayWinner] = useState<Participant | null>(null)

  const [backsound, setBacksoundOn] = useState(false)
  const [sfx, setSfx] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 960px)').matches : true,
  )

  const startDraw = useCallback(async () => {
    if (pool.length === 0) return
    if (phase === 'shuffling' || phase === 'countdown') return
    await resumeAudio()
    const w = pickRandomParticipant(pool)
    if (!w) return
    pendingRef.current = w
    setDisplayWinner(null)
    setDrawKey((k) => k + 1)
    setPhase('shuffling')
  }, [phase, pool])

  const onShuffleComplete = useCallback(() => {
    setPhase('countdown')
    setCountdown(3)
  }, [])

  useEffect(() => {
    setBacksound(backsound)
    return () => setBacksound(false)
  }, [backsound])

  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return
    if (countdown < 1) return

    if (sfx) playCount(countdown)
    const t = window.setTimeout(() => {
      if (countdown <= 1) {
        const w = pendingRef.current
        if (w) {
          setPool((p) => p.filter((x) => x.id !== w.id))
          setHistory((h) => [...h, { participant: w, at: Date.now() }])
          setDisplayWinner(w)
        }
        if (sfx) playReveal()
        fireCelebration(rootRef.current)
        setPhase('revealed')
        setCountdown(null)
      } else {
        setCountdown(countdown - 1)
      }
    }, 780)
    return () => window.clearTimeout(t)
  }, [phase, countdown, sfx])

  const drawAgain = useCallback(async () => {
    if (pool.length === 0) return
    if (phase === 'shuffling' || phase === 'countdown') return
    await resumeAudio()
    const w = pickRandomParticipant(pool)
    if (!w) return
    pendingRef.current = w
    setDisplayWinner(null)
    setDrawKey((k) => k + 1)
    setPhase('shuffling')
  }, [phase, pool])

  const undoLastWinner = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const last = h[h.length - 1]!
      setPool((p) => {
        if (p.some((x) => x.id === last.participant.id)) return p
        return [...p, last.participant]
      })
      return h.slice(0, -1)
    })
    setPhase('idle')
    pendingRef.current = null
    setCountdown(null)
    setDisplayWinner(null)
  }, [])

  const resetAll = useCallback(() => {
    const snap = snapshotRef.current
    setPool(snap.map((p) => ({ ...p })))
    setHistory([])
    setPhase('idle')
    pendingRef.current = null
    setCountdown(null)
    setDisplayWinner(null)
    setImportError(null)
  }, [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setImporting(true)
    setImportError(null)
    try {
      const list = await parseParticipantsFile(f)
      snapshotRef.current = list.map((p) => ({ ...p }))
      setPool(list)
      setHistory([])
      setPhase('idle')
      pendingRef.current = null
      setCountdown(null)
      setDisplayWinner(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Gagal membaca file.')
    } finally {
      setImporting(false)
    }
  }

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current ?? document.documentElement
    if (!document.fullscreenElement) void el.requestFullscreen?.()
    else void document.exitFullscreen?.()
  }, [])

  const pending = pendingRef.current
  const shuffling = phase === 'shuffling'
  const showCountdown = phase === 'countdown' && countdown !== null && countdown >= 1
  const revealed = phase === 'revealed'

  return (
    <div className="app" ref={rootRef}>
      <header className="topbar">
        <div className="topbar__brand">
          <img className="topbar__logo" src={logo} alt="" width={42} height={42} decoding="async" />
          <div>
            <h1 className="topbar__title">Topsell Undian</h1>
            <p className="topbar__sub">PT. Topsell Raharja Indonesia</p>
          </div>
        </div>
        <div className="topbar__actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={backsound}
              onChange={async (e) => {
                await resumeAudio()
                setBacksoundOn(e.target.checked)
              }}
            />
            <span>Backsound</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
            <span>SFX</span>
          </label>
          <button type="button" className="btn btn--ghost" onClick={toggleFullscreen}>
            Layar penuh
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="stage">
          <DrawViewport
            key={drawKey}
            pool={pool}
            active={shuffling}
            winner={pending}
            sfxOn={sfx}
            onShuffleComplete={onShuffleComplete}
          />

          {showCountdown && (
            <div className="countdown-overlay" role="presentation">
              <span className="countdown-overlay__num">{countdown}</span>
            </div>
          )}

          {revealed && displayWinner && (
            <div className="winner-overlay">
              <p className="winner-overlay__eyebrow">Pemenang</p>
              <p className="winner-overlay__name">{displayWinner.name}</p>
              <p className="winner-overlay__detail">
                {[displayWinner.no, displayWinner.category].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          <div className="stage__controls">
            <button
              type="button"
              className="btn btn--primary btn--xl"
              disabled={pool.length === 0 || shuffling || phase === 'countdown'}
              onClick={() => {
                void startDraw()
              }}
            >
              Mulai undian
            </button>
            <div className="stage__row">
              <button
                type="button"
                className="btn btn--secondary"
                disabled={pool.length === 0 || shuffling || phase === 'countdown'}
                onClick={() => void drawAgain()}
              >
                Undi lagi
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={history.length === 0}
                onClick={undoLastWinner}
                title="Kembalikan pemenang terakhir ke pool (hapus dari riwayat)"
              >
                Hapus pemenang dari daftar
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={snapshotRef.current.length === 0 && pool.length === 0}
                onClick={resetAll}
              >
                Reset semua
              </button>
            </div>
          </div>
        </main>

        <aside className={`panel ${historyOpen ? 'panel--open' : ''}`}>
          <div className="panel__head">
            <h2>Kontrol acara</h2>
            <button
              type="button"
              className="btn btn--ghost panel__close"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((o) => !o)}
            >
              {historyOpen ? 'Tutup' : 'Menu'}
            </button>
          </div>

          <section className="panel__section">
            <h3>Impor peserta</h3>
            <p className="panel__hint">
              Excel (.xlsx) atau CSV dengan kolom <strong>Nomor</strong>, <strong>Nama</strong>, opsional{' '}
              <strong>Kategori</strong>. Mendukung hingga ribuan baris.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => void onFile(e)}
            />
            <button
              type="button"
              className="btn btn--secondary"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? 'Membaca…' : 'Pilih file'}
            </button>
            {importError && <p className="panel__error">{importError}</p>}
            <p className="panel__stat">
              Pool: <strong>{pool.length}</strong> peserta · Riwayat:{' '}
              <strong>{history.length}</strong>
            </p>
          </section>

          <section className="panel__section">
            <h3>Riwayat pemenang</h3>
            <ol className="history-list">
              {history.length === 0 && <li className="history-list__empty">Belum ada pemenang.</li>}
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <li key={`${h.participant.id}-${h.at}`} className="history-list__item">
                    <span className="history-list__name">{h.participant.name}</span>
                    <span className="history-list__meta">
                      {[h.participant.no, h.participant.category].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        </aside>
      </div>

      <button
        type="button"
        className={`fab-menu ${historyOpen ? 'fab-menu--hide' : ''}`}
        aria-label="Buka menu kontrol"
        onClick={() => setHistoryOpen(true)}
      >
        Menu
      </button>

      <footer className="foot">
        <span>Peserta yang menang otomatis dikeluarkan dari pool · Gunakan fullscreen di LED</span>
      </footer>
    </div>
  )
}
