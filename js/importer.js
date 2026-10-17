// Reads training logs exported by other apps (myBJJ, spreadsheets, other trackers) as CSV or JSON.
// It guesses which column is the date, duration, class type, notes and techniques. Anything it
// can't place is kept in the session's notes, so nothing from the original file is lost.

import { isoDate } from './util.js'
import { allTechs } from './model.js'

const FIELDS = {
  date: ['date', 'day', 'session date', 'training date', 'class date', 'start', 'start date', 'start time', 'date time', 'datetime', 'created', 'created at', 'timestamp', 'when'],
  minutes: ['duration', 'minutes', 'mins', 'duration min', 'duration minutes', 'mat time', 'time trained', 'training time', 'length', 'hours', 'duration hours', 'time'],
  type: ['type', 'class', 'class type', 'session type', 'training type', 'category', 'style', 'gi', 'gi no gi', 'kind'],
  rounds: ['rounds', 'rolls', 'sparring rounds', 'number of rolls', 'spars', 'sparring'],
  notes: ['notes', 'note', 'description', 'comments', 'comment', 'journal', 'entry', 'reflection', 'summary', 'details', 'text', 'body', 'thoughts'],
  techniques: ['techniques', 'technique', 'moves', 'move', 'drilled', 'skills', 'tags', 'positions'],
  title: ['title', 'name', 'class name', 'session name', 'subject'],
}

// "durationMinutes" and "Duration (min)" both become "duration minutes" / "duration min".
const norm = s => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ---------- Reading the file ----------

function parseCSV(text) {
  const firstLine = text.split(/\r?\n/)[0]
  const delimiter = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows.filter(r => r.some(c => c.trim()))
  return (body || []).map(r => Object.fromEntries((header || []).map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

// In JSON, the training log is the biggest list of objects anywhere in the file.
function largestObjectList(value) {
  let best = []
  const visit = v => {
    if (Array.isArray(v)) {
      if (v.length > best.length && v.every(x => x && typeof x === 'object' && !Array.isArray(x))) best = v
      v.forEach(visit)
    } else if (v && typeof v === 'object') Object.values(v).forEach(visit)
  }
  visit(value)
  return best.map(o => Object.fromEntries(Object.entries(o).map(([k, v]) =>
    [k, Array.isArray(v) ? v.map(x => typeof x === 'object' ? (x?.name ?? x?.title ?? JSON.stringify(x)) : x).join(', ') : v && typeof v === 'object' ? (v.name ?? v.title ?? JSON.stringify(v)) : String(v ?? '')])))
}

// ---------- Making sense of values ----------

function pickColumns(headers) {
  const taken = new Set(), columns = {}
  const find = (field, test) => headers.find(h => !taken.has(h) && FIELDS[field].some(c => test(norm(h), c)))
  for (const field of Object.keys(FIELDS)) {
    const h = find(field, (h, c) => h === c) || find(field, (h, c) => h.includes(c) && c.length > 3)
    if (h) { columns[field] = h; taken.add(h) }
  }
  return columns
}

export function parseDate(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return isoDate(new Date(+m[1], m[2] - 1, +m[3]))
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    const [month, day] = +m[1] > 12 ? [+m[2], +m[1]] : [+m[1], +m[2]]
    return isoDate(new Date(year, month - 1, day))
  }
  if (/^\d{9,13}$/.test(s)) return isoDate(new Date(s.length > 10 ? +s : +s * 1000))
  const t = Date.parse(s)
  return isNaN(t) ? '' : isoDate(new Date(t))
}

export function parseMinutes(raw, header = '') {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 0
  let m = s.match(/^(\d+):(\d{2})/)
  if (m) return +m[1] * 60 + +m[2]
  const h = s.match(/([\d.]+)\s*h/), mins = s.match(/([\d.]+)\s*m/)
  if (h || mins) return Math.round((h ? +h[1] * 60 : 0) + (mins ? +mins[1] : 0))
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return Math.round(norm(header).includes('hour') || n <= 6 ? n * 60 : n)
}

function parseType(raw) {
  const s = norm(raw)
  if (/no ?gi|nogi/.test(s)) return 'No-gi'
  if (s.includes('open')) return 'Open mat'
  if (s.includes('private')) return 'Private'
  if (/comp|tournament|match/.test(s)) return 'Competition'
  if (s.includes('drill')) return 'Drilling only'
  return 'Gi'
}

function hash(text) {
  let h = 0
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h.toString(36)
}

// ---------- Public ----------

export async function readOtherApp(file) {
  const text = await file.text()
  let rows
  try { rows = largestObjectList(JSON.parse(text)) } catch { rows = parseCSV(text) }
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const columns = pickColumns(headers)
  const techsByName = Object.fromEntries(allTechs().map(t => [t.name.toLowerCase(), t.id]))
  const used = new Set(Object.values(columns))

  const sessions = [], skipped = []
  rows.forEach(row => {
    const date = parseDate(row[columns.date])
    if (!date) { skipped.push(row); return }
    const moves = String(row[columns.techniques] ?? '').split(/[,;|\n]/).map(s => s.trim()).filter(Boolean)
    const known = moves.filter(m => techsByName[m.toLowerCase()]), unknown = moves.filter(m => !techsByName[m.toLowerCase()])
    const extras = headers.filter(h => !used.has(h) && String(row[h] ?? '').trim()).map(h => `${h}: ${row[h]}`)
    const typeText = row[columns.type] || ''
    const notes = [
      row[columns.title],
      row[columns.notes],
      unknown.length && `Techniques: ${unknown.join(', ')}`,
      typeText && parseType(typeText) === 'Gi' && !/^gi$/i.test(typeText.trim()) && `Class: ${typeText}`,
      ...extras,
    ].filter(Boolean).join('\n')
    sessions.push({
      id: 'session_imp_' + hash(JSON.stringify(row)), kind: 'session', imported: file.name,
      date, type: parseType(typeText), minutes: parseMinutes(row[columns.minutes], columns.minutes || ''),
      rounds: parseInt(row[columns.rounds], 10) || 0, focus: [], drilled: known.map(m => techsByName[m.toLowerCase()]),
      reps: [], photos: [], notes,
    })
  })
  return { sessions, skipped, columns, headers }
}
