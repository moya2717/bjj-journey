// Reads training logs exported by other apps (myBJJ, spreadsheets, other trackers) as CSV or JSON.
// It works out which columns hold the date, mat time, rolls, class type, notes and techniques.
// Anything it can't place is kept in the session's notes, so nothing from the original file is lost.
//
// Mat time can arrive many ways: one duration column ("1:30", "90 min", "1.5", "PT1H30M", seconds),
// separate hours / minutes / seconds columns, or start and end times. Rolls can be a count column,
// a list inside each session (JSON), or a separate table or file of rolls matched by date.

import { isoDate } from './util.js'
import { allTechs } from './model.js'

const FIELDS = {
  date: ['date', 'day', 'session date', 'training date', 'class date', 'start date', 'date time', 'datetime', 'start', 'start time', 'started at', 'created', 'created at', 'timestamp', 'when'],
  type: ['type', 'class', 'class type', 'session type', 'training type', 'category', 'style', 'gi', 'gi no gi', 'kind', 'discipline'],
  rounds: ['rounds', 'rolls', 'rolls logged', 'total rolls', 'number of rolls', 'rounds rolled', 'sparring rounds', 'sparring rolls', 'spar rounds', 'spars', 'sparring', 'rolled', 'live rounds'],
  notes: ['notes', 'note', 'description', 'comments', 'comment', 'journal', 'entry', 'reflection', 'summary', 'details', 'text', 'body', 'thoughts'],
  techniques: ['techniques', 'technique', 'moves', 'move', 'drilled', 'skills', 'tags', 'positions'],
  title: ['title', 'name', 'class name', 'session name', 'subject'],
}

// Words that mark a column as part of the mat time.
const TIME_PARTS = {
  hours: /\b(hours?|hrs?)\b/,
  minutes: /\b(minutes?|mins?)\b/,
  seconds: /\b(seconds?|secs?)\b/,
  duration: /\b(duration|mat time|time trained|training time|length|total time|elapsed)\b/,
  end: /\b(end|ended|finish|finished|stop)\b/,
}

const ROLL_WORDS = /\b(rolls?|rounds?|spars?|sparring|matches)\b/

// "durationMinutes" and "Duration (min)" become "duration minutes" and "duration min".
const norm = s => String(s).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// ---------- Reading files into rows ----------

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
  const [header = [], ...body] = rows.filter(r => r.some(c => c.trim()))
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim().replace(/^﻿/, ''), (r[i] ?? '').trim()])))
}

// Nested objects become "parent child" columns. Lists of objects (like a session's rolls)
// become a count column plus a readable summary column.
function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix} ${key}` : key
    if (Array.isArray(value)) {
      if (value.some(v => v && typeof v === 'object')) {
        out[name] = String(value.length)
        out[name + ' details'] = value.map(describe).join('; ')
      } else out[name] = value.join(', ')
    } else if (value && typeof value === 'object') {
      if (prefix.split(' ').length < 3) flatten(value, name, out)
      else out[name] = JSON.stringify(value)
    } else out[name] = String(value ?? '')
  }
  return out
}

const describe = v => typeof v !== 'object' ? String(v)
  : Object.entries(flatten(v)).filter(([, x]) => x !== '').map(([k, x]) => `${k}: ${x}`).join(', ')

// Every list of objects in a JSON file is a candidate table: sessions, rolls, and so on.
function jsonTables(value) {
  const tables = []
  const visit = (v, key) => {
    if (Array.isArray(v)) {
      if (v.length && v.every(x => x && typeof x === 'object' && !Array.isArray(x))) tables.push({ name: key, rows: v.map(o => flatten(o)) })
      else v.forEach(x => visit(x, key))
    } else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => visit(x, k))
  }
  visit(value, '')
  return tables
}

async function readTables(file) {
  const text = await file.text()
  try { return jsonTables(JSON.parse(text)) } catch { return [{ name: file.name, rows: parseCSV(text) }] }
}

// ---------- Making sense of values ----------

function pickColumns(headers) {
  const taken = new Set(), columns = {}
  const find = (field, test) => headers.find(h => !taken.has(h) && FIELDS[field].some(c => test(norm(h), c)))
  for (const field of Object.keys(FIELDS)) {
    const h = find(field, (h, c) => h === c) || find(field, (h, c) => h.includes(c) && c.length > 3)
    if (h) { columns[field] = h; taken.add(h) }
  }
  // Mat time columns, which may be several working together.
  const free = headers.filter(h => !taken.has(h) || h === columns.date)
  const part = re => free.find(h => re.test(norm(h)) && !/\b(start|end|date)\b/.test(norm(h)) && h !== columns.date)
  columns.hours = part(TIME_PARTS.hours)
  columns.minutes = part(TIME_PARTS.minutes)
  columns.seconds = part(TIME_PARTS.seconds)
  columns.duration = free.find(h => TIME_PARTS.duration.test(norm(h)) && ![columns.hours, columns.minutes, columns.seconds].includes(h))
    || headers.find(h => norm(h) === 'time')
  columns.end = headers.find(h => TIME_PARTS.end.test(norm(h)) && h !== columns.date)
  columns.start = headers.find(h => /\b(start|started|begin)\b/.test(norm(h)) && h !== columns.end)
  Object.keys(columns).forEach(k => columns[k] || delete columns[k])
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

const parseMoment = raw => {
  const s = String(raw ?? '').trim()
  if (/^\d{9,13}$/.test(s)) return s.length > 10 ? +s : +s * 1000
  const t = Date.parse(s)
  if (!isNaN(t)) return t
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i)
  return m ? ((+m[1] % 12) + (/pm/i.test(m[3] || '') ? 12 : 0) + (!m[3] && +m[1] === 12 ? 12 : 0)) * 3600000 + +m[2] * 60000 : NaN
}

// Reads one duration value. `unit` comes from the column name when it says hours, minutes or seconds.
export function parseMinutes(raw, unit = '') {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 0
  const iso = s.match(/^p(?:t)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/)
  if (iso && s.length > 1) return Math.round((+iso[1] || 0) * 60 + (+iso[2] || 0) + (+iso[3] || 0) / 60)
  let m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (m) return m[3] ? +m[1] * 60 + +m[2] + Math.round(+m[3] / 60) : +m[1] * 60 + +m[2]
  const h = s.match(/([\d.]+)\s*h/), mins = s.match(/([\d.]+)\s*m(?!s)/), secs = s.match(/([\d.]+)\s*s/)
  if (h || mins || secs) return Math.round((h ? +h[1] * 60 : 0) + (mins ? +mins[1] : 0) + (secs && !mins ? +secs[1] / 60 : 0))
  const n = parseFloat(s.replace(',', '.'))
  if (isNaN(n)) return 0
  if (unit === 'hours') return Math.round(n * 60)
  if (unit === 'seconds') return Math.round(n / 60)
  if (unit === 'minutes') return Math.round(n)
  if (n > 600) return Math.round(n / 60)      // a session longer than 10 hours is really seconds
  if (n <= 6) return Math.round(n * 60)       // a session shorter than 6 minutes is really hours
  return Math.round(n)
}

const unitOf = header => {
  const h = norm(header)
  return TIME_PARTS.hours.test(h) ? 'hours' : TIME_PARTS.seconds.test(h) ? 'seconds' : TIME_PARTS.minutes.test(h) ? 'minutes' : ''
}

// Anything over 10 hours is a clock time or a misread, not a training session.
const plausible = minutes => minutes > 0 && minutes <= 600 ? minutes : 0

function matTime(row, c) {
  const parts = ['hours', 'minutes', 'seconds'].filter(k => c[k] && String(row[c[k]] ?? '').trim() !== '')
  if (parts.length) return plausible(parts.reduce((t, k) => t + parseMinutes(row[c[k]], k), 0))
  if (c.duration && String(row[c.duration] ?? '').trim()) return plausible(parseMinutes(row[c.duration], unitOf(c.duration)))
  if (c.end) {
    const start = parseMoment(row[c.start || c.date]), end = parseMoment(row[c.end])
    if (!isNaN(start) && !isNaN(end) && end > start) return plausible(Math.round((end - start) / 60000))
  }
  return 0
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

// The sessions table is the one that looks most like a training log.
function sessionScore(table) {
  const headers = Object.keys(table.rows[0] || {}), c = pickColumns(headers)
  return (c.date ? 10 : 0) + (c.hours || c.minutes || c.duration || c.end ? 4 : 0) + (c.type ? 2 : 0) + (c.notes ? 1 : 0)
    - (ROLL_WORDS.test(norm(table.name)) ? 6 : 0) + Math.min(table.rows.length, 500) / 1000
}

// ---------- Public ----------

export async function readOtherApp(files) {
  const tables = (await Promise.all([...files].map(readTables))).flat().filter(t => t.rows.length)
  if (!tables.length) return { sessions: [], skipped: [], columns: {}, headers: [], rollsMatched: 0 }
  const main = [...tables].sort((a, b) => sessionScore(b) - sessionScore(a))[0]
  const rows = main.rows
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const columns = pickColumns(headers)
  const used = new Set(Object.values(columns))
  const techsByName = Object.fromEntries(allTechs().map(t => [t.name.toLowerCase(), t.id]))

  // Rolls kept in their own table or file: count them per day.
  const rollsByDate = {}
  tables.filter(t => t !== main && (ROLL_WORDS.test(norm(t.name)) || ROLL_WORDS.test(norm(Object.keys(t.rows[0]).join(' '))))).forEach(t => {
    const dateCol = pickColumns(Object.keys(t.rows[0])).date
    t.rows.forEach(r => { const d = parseDate(r[dateCol]); if (d) (rollsByDate[d] ||= []).push(describe(r)) })
  })
  // A session's own list of rolls ("rolls" → count, "rolls details" → summary).
  const rollList = headers.find(h => ROLL_WORDS.test(norm(h)) && headers.includes(h + ' details'))

  const sessions = [], skipped = []
  let rollsMatched = 0
  rows.forEach(row => {
    const date = parseDate(row[columns.date])
    if (!date) { skipped.push(row); return }
    const moves = String(row[columns.techniques] ?? '').split(/[,;|\n]/).map(s => s.trim()).filter(Boolean)
    const known = moves.filter(m => techsByName[m.toLowerCase()]), unknown = moves.filter(m => !techsByName[m.toLowerCase()])
    const extras = headers.filter(h => !used.has(h) && String(row[h] ?? '').trim()).map(h => `${h}: ${row[h]}`)
    const outside = rollsByDate[date] || []
    const listed = parseInt(row[columns.rounds] ?? row[rollList], 10) || 0
    const rounds = listed || outside.length
    if (rounds) rollsMatched++
    const typeText = row[columns.type] || ''
    const notes = [
      row[columns.title],
      row[columns.notes],
      unknown.length && `Techniques: ${unknown.join(', ')}`,
      typeText && parseType(typeText) === 'Gi' && !/^gi$/i.test(typeText.trim()) && `Class: ${typeText}`,
      outside.length && `Rolls:\n${outside.map(r => '• ' + r).join('\n')}`,
      ...extras,
    ].filter(Boolean).join('\n')
    sessions.push({
      id: 'session_imp_' + hash(JSON.stringify(row)), kind: 'session', imported: [...files].map(f => f.name).join(', '),
      date, type: parseType(typeText), minutes: matTime(row, columns), rounds,
      focus: [], drilled: known.map(m => techsByName[m.toLowerCase()]), reps: [], photos: [], notes,
    })
  })
  return { sessions, skipped, columns, headers, rollsMatched }
}
