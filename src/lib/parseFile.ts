import type { Participant } from '../types'

function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function scoreHeaderCell(cell: string): { no: number; name: number; category: number } {
  const n = normalizeHeader(cell)
  let no = 0
  let name = 0
  let category = 0
  if (
    /^(no|nomor|no\.|id|participant|peserta|tiket|ticket|number|#)/i.test(n) ||
    n.includes('nomor') ||
    n.includes('peserta')
  )
    no = 2
  if (/nama|name|peserta|participant|full/i.test(n)) name = 2
  if (/kategori|category|kelas|group|type|tipe/i.test(n)) category = 2
  return { no, name, category }
}

function detectHeaderRow(rows: string[][]): { rowIndex: number; colMap: { no: number; name: number; category?: number } } | null {
  let best: { rowIndex: number; score: number; colMap: { no: number; name: number; category?: number } } | null = null

  for (let r = 0; r < Math.min(8, rows.length); r++) {
    const row = rows[r]
    if (!row || row.length < 2) continue
    const scores = row.map((c) => scoreHeaderCell(String(c ?? '')))
    let noCol = -1
    let nameCol = -1
    let catCol = -1
    let score = 0
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i]!
      if (s.no >= 2 && noCol < 0) {
        noCol = i
        score += 3
      }
      if (s.name >= 2 && nameCol < 0) {
        nameCol = i
        score += 3
      }
      if (s.category >= 2 && catCol < 0) {
        catCol = i
        score += 1
      }
    }
    if (noCol >= 0 && nameCol >= 0 && noCol !== nameCol) {
      const colMap: { no: number; name: number; category?: number } = { no: noCol, name: nameCol }
      if (catCol >= 0) colMap.category = catCol
      if (!best || score > best.score) best = { rowIndex: r, score, colMap }
    }
  }

  if (best) return { rowIndex: best.rowIndex, colMap: best.colMap }

  // Fallback: treat as data from row 0 — kolom A = nomor, B = nama, C = kategori
  const first = rows[0]
  if (first && first.length >= 2) {
    return {
      rowIndex: -1,
      colMap: { no: 0, name: 1, category: first.length > 2 ? 2 : undefined },
    }
  }
  return null
}

function makeId(no: string, name: string, index: number): string {
  const enc = new TextEncoder().encode(`${no}|${name}|${index}`)
  let h = 2166136261
  for (let i = 0; i < enc.length; i++) {
    h ^= enc[i]!
    h = Math.imul(h, 16777619)
  }
  return `p-${(h >>> 0).toString(16)}-${index}`
}

export async function parseParticipantsFile(file: File): Promise<Participant[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('File kosong atau tidak memiliki sheet.')
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error('Sheet tidak dapat dibaca.')

  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as string[][]

  const cleaned = rows.map((row) => row.map((c) => String(c ?? '').trim()))
  const detected = detectHeaderRow(cleaned)
  if (!detected) throw new Error('Format tidak dikenali. Gunakan kolom Nomor & Nama.')

  const { rowIndex, colMap } = detected
  const out: Participant[] = []
  let seq = 0

  const startRow = rowIndex < 0 ? 0 : rowIndex + 1
  for (let r = startRow; r < cleaned.length; r++) {
    const row = cleaned[r]
    if (!row) continue
    const no = String(row[colMap.no] ?? '').trim()
    const name = String(row[colMap.name] ?? '').trim()
    const category =
      colMap.category !== undefined ? String(row[colMap.category] ?? '').trim() : ''
    if (!name && !no) continue
    if (!name) continue
    const displayNo = no || String(seq + 1)
    out.push({
      id: makeId(displayNo, name, seq),
      no: displayNo,
      name,
      category: category || '',
    })
    seq++
  }

  if (out.length === 0) throw new Error('Tidak ada baris data peserta setelah header.')
  if (out.length > 5000) throw new Error('Maksimal 5000 baris untuk performa. Hubungi panitia untuk pemisahan file.')

  return out
}
