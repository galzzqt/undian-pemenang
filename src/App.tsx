import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { DrawPhase, Participant, WinnerRecord } from './types'
import { parseParticipantsFile } from './lib/parseFile'
import { pickRandomParticipant } from './lib/random'
import {
  playCount,
  playReveal,
  resumeAudio,
  setBacksound,
  setBacksoundVolume,
  setSfxVolume,
} from './lib/sounds'
import { DrawViewport } from './components/DrawViewport'
import logo from './assets/logo.png'

// Persistent storage functions
const SESSION_KEY = 'topsell_undian_session'

interface SessionData {
  pool: Participant[]
  history: WinnerRecord[]
  snapshot: Participant[]
}

function saveSession(data: SessionData): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch (error) {
    console.warn('Gagal menyimpan session:', error)
  }
}

function loadSession(): SessionData | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (error) {
    console.warn('Gagal memuat session:', error)
    return null
  }
}

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
  const [sessionReady, setSessionReady] = useState(false)

  const [backsound, setBacksoundOn] = useState(false)
  const [sfx, setSfx] = useState(true)
  const [backsoundLevel, setBacksoundLevel] = useState(5)
  const [sfxLevel, setSfxLevel] = useState(100)
  const [historyOpen, setHistoryOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 960px)').matches : true,
  )
  const [controlOpen, setControlOpen] = useState(true)

  // Load session on app startup
  useEffect(() => {
    const session = loadSession()
    if (session) {
      setPool(session.pool)
      setHistory(session.history)
      snapshotRef.current = session.snapshot
    }
    setSessionReady(true)
  }, [])

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
    setBacksoundVolume(backsoundLevel / 100)
  }, [backsoundLevel])

  useEffect(() => {
    setSfxVolume(sfxLevel / 100)
  }, [sfxLevel])

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
    if (snap.length === 0 && pool.length === 0) return
    setPool(snap.map((p) => ({ ...p })))
    setHistory([])
    setPhase('idle')
    pendingRef.current = null
    setCountdown(null)
    setDisplayWinner(null)
    setImportError(null)
  }, [pool.length])

  // Auto-save session after initial hydration to avoid overwriting existing session.
  useEffect(() => {
    if (!sessionReady) return
    const sessionData: SessionData = {
      pool,
      history,
      snapshot: snapshotRef.current,
    }
    saveSession(sessionData)
  }, [history, pool, sessionReady])

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

  const downloadTemplate = useCallback(async () => {
    setImportError(null)
    try {
      const XLSX = await import('xlsx')
      const rows = [
        ['Nomor', 'Nama', 'Kategori'],
        ['001', 'Budi Santoso', 'Regular'],
        ['002', 'Siti Aminah', 'VIP'],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Peserta')
      XLSX.writeFile(wb, 'template-peserta-undian.xlsx')
    } catch {
      setImportError('Gagal membuat template. Coba lagi.')
    }
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
            <p className="topbar__sub">PT. Topsel Raharja Indonesia</p>
          </div>
        </div>
        <div className="topbar__actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={backsound}
              onChange={async (e) => {
                const checked = e.target.checked
                try {
                  await resumeAudio()
                } catch {
                  // Tetap update toggle meski browser menolak resume audio context.
                }
                setBacksoundOn(checked)
              }}
            />
            <span>Backsound</span>
          </label>
          <label className="toggle toggle--volume">
            <span>Vol Backsound</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={backsoundLevel}
              onChange={(e) => setBacksoundLevel(Number(e.target.value))}
            />
            <span>{backsoundLevel}%</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
            <span>SFX</span>
          </label>
          <label className="toggle toggle--volume">
            <span>Vol SFX</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sfxLevel}
              onChange={(e) => setSfxLevel(Number(e.target.value))}
            />
            <span>{sfxLevel}%</span>
          </label>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => window.open('https://choliltopsell.github.io/generator/', '_blank', 'noopener,noreferrer')}
          >
            Kembali ke Generator
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
            <motion.div 
              className="countdown-overlay" 
              role="presentation"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span 
                className="countdown-overlay__num"
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                {countdown}
              </motion.span>
            </motion.div>
          )}

          <AnimatePresence>
          {revealed && displayWinner && (
            <motion.div
              className="winner-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="winner-modal-title"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <motion.div 
                className="winner-modal__backdrop" 
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div 
                className="winner-modal__box"
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <motion.button
                  type="button"
                  className="winner-modal__close"
                  onClick={() => setPhase('idle')}
                  aria-label="Tutup popup pemenang"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ×
                </motion.button>
                <motion.p 
                  className="winner-modal__eyebrow" 
                  id="winner-modal-title"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  Pemenang
                </motion.p>
                <motion.p 
                  className="winner-modal__name"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  {displayWinner.name}
                </motion.p>
                <motion.p 
                  className="winner-modal__detail"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  {[displayWinner.no, displayWinner.category].filter(Boolean).join(' · ')}
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                disabled={history.length === 0}
                onClick={undoLastWinner}
                title="Kembalikan pemenang terakhir ke pool (hapus dari riwayat)"
              >
                Hapus riwayat pemenang
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

        <div className={`side-column ${historyOpen ? 'side-column--open' : ''}`}>
        <aside className="panel panel--control">
          <div className="panel__head">
            <h2>Kontrol acara</h2>
            <div className="panel__head-actions">
              <button
                type="button"
                className="btn btn--ghost panel__toggle"
                aria-expanded={controlOpen}
                onClick={() => setControlOpen((o) => !o)}
              >
                {controlOpen ? 'Hide' : 'Tampil'}
              </button>
              <button
                type="button"
                className="btn btn--ghost panel__close"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen((o) => !o)}
              >
                {historyOpen ? 'Tutup' : 'Menu'}
              </button>
            </div>
          </div>

          {controlOpen ? (
            <section className="panel__section">
              <h3>Impor peserta</h3>
              <p className="panel__hint">
                Excel (.xlsx) atau CSV dengan kolom <strong>Nama</strong>, opsional{' '}
                <strong>Kategori</strong>, <strong>Nomor</strong>. Mendukung hingga ribuan baris.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => void onFile(e)}
              />
              <div className="panel__file-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={importing}
                  onClick={() => fileRef.current?.click()}
                >
                  {importing ? 'Membaca…' : 'Pilih file'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void downloadTemplate()}
                >
                  Download template Excel
                </button>
              </div>
              {importError && <p className="panel__error">{importError}</p>}
              <p className="panel__stat">
                Pool: <strong>{pool.length}</strong> peserta · Riwayat:{' '}
                <strong>{history.length}</strong>
                <p>Peserta yang menang otomatis dikeluarkan dari pool</p>
              </p>
            </section>
          ) : null}
        </aside>

          <aside className="panel panel--history">
            <div className="panel__head">
              <h2>Riwayat pemenang</h2>
            </div>
            <ol className="history-list">
              {history.length === 0 && <li className="history-list__empty">Belum ada pemenang.</li>}
              {history
                .slice()
                .reverse()
                .map((h, idx) => {
                  const winnerNumber = history.length - idx
                  return (
                  <li key={`${h.participant.id}-${h.at}`} className="history-list__item">
                    <span className="history-list__number">{winnerNumber}.</span>
                    <span className="history-list__name">{h.participant.name}</span>
                    <span className="history-list__meta">
                      {[h.participant.no, h.participant.category].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                  )
                })}
            </ol>
          </aside>
        </div>
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
        <span>*Untuk Fullscreen gunakan tombol F11</span>
      </footer>
    </div>
  )
}
