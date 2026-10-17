// Reads training logs exported by other apps (myBJJ, spreadsheets, other trackers) as CSV or JSON.
// It works out which columns hold the date, mat time, rolls, class type, notes and techniques.
// Anything it can't place is kept in the session's notes, so nothing from the original file is lost.
//
// Mat time can arrive many ways: one duration column ("1:30", "90 min", "1.5", "PT1H30M", seconds),
// separate hours / minutes / seconds columns, or start and end times. Rolls can be a count column,
// a list inside each session (JSON), or a separate table or file of rolls matched by date.

import { isoDate, slug } from './util.js'
import { allTechs } from './model.js'
import { LIBRARY_GROUPS, RANKS, TECH_TYPES } from './vocab.js'
import { isZip, readZip } from './zip.js'

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

// ---------- Times, links and media ----------

// The time of day a class started, as "HH:MM", when the export includes one.
export function parseTime(raw) {
  const s = String(raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d)) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }
  const m = s.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i)
  if (!m) return ''
  let h = +m[1]
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0)
  return h < 24 ? String(h).padStart(2, '0') + ':' + m[2] : ''
}

const IMAGE = /\.(jpe?g|png|heic|heif|webp|gif)$/i
const DATA = /\.(json|csv|tsv|txt)$/i
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif' }
const baseName = name => name.replace(/^.*\//, '').replace(/\.[^.]+$/, '')

// Values in a row that could name a photo, or an id the media files are named after.
function keysOf(row) {
  const keys = new Set()
  Object.values(row).forEach(v => String(v ?? '').split(/[\s,;|"']+/).forEach(token => {
    const t = token.replace(/^.*\//, '')
    if (IMAGE.test(t)) keys.add(baseName(t).toLowerCase())
    else if (/^[A-Za-z0-9_-]{8,}$/.test(t) && /\d/.test(t) && !/^\d{4}-\d{2}-\d{2}/.test(t)) keys.add(t.toLowerCase())
  }))
  return [...keys].slice(0, 30)
}

// Which part of the export a media file belongs to, from its folder names.
function mediaKind(folders, name) {
  const path = [...folders, name].join('/').toLowerCase()
  if (/(^|\/)profile/.test(path)) return 'profile'
  if (/(^|\/)techniques?/.test(path)) return 'technique'
  return 'journal'
}

async function expand(files) {
  const dataFiles = [], media = [], skipped = []
  for (const file of files) {
    if (isZip(file)) {
      for (const e of await readZip(file)) {
        const type = MIME[e.name.split('.').pop().toLowerCase()]
        if (IMAGE.test(e.name)) media.push({ name: e.name, kind: mediaKind(e.folders, e.name), modified: e.modified, blob: async () => new Blob([await e.blob()], { type }) })
        else if (DATA.test(e.name)) dataFiles.push({ name: e.path, text: async () => (await e.blob()).text() })
        else skipped.push(e.name)
      }
    } else if (IMAGE.test(file.name) || file.type.startsWith('image/')) {
      media.push({ name: file.name, kind: mediaKind([file.webkitRelativePath || ''], file.name), modified: new Date(file.lastModified), blob: async () => file })
    } else dataFiles.push(file)
  }
  return { dataFiles, media, skipped }
}

// ---------- Techniques ----------

function readTechniques(tables) {
  const known = Object.fromEntries(allTechs().map(t => [t.name.toLowerCase(), t]))
  return tables.filter(t => /techni|move/i.test(t.name)).flatMap(t => t.rows.map(row => {
    const headers = Object.keys(row), find = re => headers.find(h => re.test(norm(h)))
    const name = String(row[find(/\b(name|title|technique)\b/)] ?? '').trim()
    if (!name) return null
    const position = LIBRARY_GROUPS.find(g => norm(row[find(/\bposition\b/)] ?? '').includes(norm(g))) || ''
    const type = TECH_TYPES.find(x => norm(row[find(/\b(type|category)\b/)] ?? '').includes(norm(x))) || ''
    const link = Object.values(row).find(v => /^https?:\/\//.test(String(v).trim())) || ''
    const notes = String(row[find(/\b(notes?|description|details|steps)\b/)] ?? '').trim()
    return { name, position, type, link, notes, match: known[name.toLowerCase()] || null, keys: keysOf(row) }
  })).filter(Boolean)
}

// ---------- Profile and rank history ----------

const PROFILE_FIELDS = {
  name: /^(full name|name|display name|athlete name|user name|username)$/,
  firstName: /^first name$/,
  lastName: /^(last name|surname)$/,
  nickname: /^nick ?name$/,
  gym: /\b(academy|gym|club|school|dojo|home gym)\b/,
  team: /\b(team|affiliation|association)\b/,
  coach: /\b(coach|instructor|professor|teacher|head coach)\b/,
  startDate: /\b(start date|started|training since|began|first class|start training|jiu jitsu since|bjj since)\b/,
  belt: /^(belt|rank|belt color|belt colour|current belt|current rank|grade)$/,
  stripes: /\b(stripes?|degrees?)\b/,
  beltDate: /\b(belt|rank|promotion|promoted|graduation)\b.*\b(date|since|on)\b|^last promotion$/,
  birthday: /\b(birthday|birth date|date of birth|dob|born)\b/,
  weight: /^(body weight|weight|current weight)$/,
  height: /^height$/,
  weightClass: /\b(weight class|division)\b/,
  goal: /\b(goal|goals|bio|about|about me)\b/,
}

const beltOf = text => RANKS.find(r => norm(text).split(' ').includes(r.toLowerCase())) || ''

// Reads one object's profile fields; returns how many it recognised, so the best match wins.
function profileFrom(obj) {
  const flat = flatten(obj), out = {}
  for (const [key, value] of Object.entries(flat)) {
    const k = norm(key.split(' ').slice(-2).join(' ')), v = String(value ?? '').trim()
    if (!v || v.length > 300) continue
    for (const [field, re] of Object.entries(PROFILE_FIELDS)) if (!out[field] && re.test(k)) { out[field] = v; break }
  }
  if (!out.name && (out.firstName || out.lastName)) out.name = [out.firstName, out.lastName].filter(Boolean).join(' ')
  const p = {
    name: out.name || out.nickname || '', gym: out.gym || '', team: out.team || '', coach: out.coach || '',
    startDate: parseDate(out.startDate), birthday: parseDate(out.birthday), weight: out.weight || '', height: out.height || '',
    weightClass: out.weightClass || '', goal: out.goal || '',
    belt: beltOf(out.belt || ''), stripes: Math.min(4, parseInt(out.stripes, 10) || 0), beltDate: parseDate(out.beltDate),
  }
  const score = Object.values(p).filter(v => v !== '' && v !== 0).length
  return { profile: p, score }
}

function promotionsFrom(tables) {
  return tables.filter(t => /promot|belt|rank|graduat|stripe/i.test(t.name)).flatMap(t => t.rows.map(row => {
    const headers = Object.keys(row)
    const date = parseDate(row[pickColumns(headers).date] ?? row[headers.find(h => /date|on|when/.test(norm(h)))])
    const belt = beltOf(row[headers.find(h => /belt|rank|color|colour/.test(norm(h)))] ?? '')
    const stripes = Math.min(4, parseInt(row[headers.find(h => /stripe|degree/.test(norm(h)))], 10) || 0)
    const note = String(row[headers.find(h => /note|comment|by|coach|professor/.test(norm(h)))] ?? '').trim()
    return date && belt ? { date, belt, stripes, note } : null
  })).filter(Boolean)
}

// The profile is the object (or one-row table) that looks most like a person.
function findProfile(roots, tables) {
  const candidates = []
  const visit = (v, key, depth) => {
    if (!v || typeof v !== 'object' || depth > 4) return
    if (Array.isArray(v)) return
    candidates.push({ obj: v, bonus: /profile|user|athlete|me|account|person/i.test(key) ? 2 : 0 })
    Object.entries(v).forEach(([k, x]) => visit(x, k, depth + 1))
  }
  roots.forEach(r => visit(r, '', 0))
  tables.filter(t => /profile|user|athlete|account/i.test(t.name) && t.rows.length).forEach(t => candidates.push({ obj: t.rows[0], bonus: 2 }))
  const best = candidates.map(c => ({ ...profileFrom(c.obj), bonus: c.bonus })).sort((a, b) => (b.score + b.bonus) - (a.score + a.bonus))[0]
  const promotions = promotionsFrom(tables)
  if ((!best || best.score < 2) && !promotions.length) return null
  return { ...(best && best.score >= 2 ? best.profile : {}), promotions }
}

// ---------- Public ----------

export async function readOtherApp(files) {
  const { dataFiles, media, skipped: otherFiles } = await expand([...files])
  const tables = (await Promise.all(dataFiles.map(readTables))).flat().filter(t => t.rows.length)
  const roots = (await Promise.all(dataFiles.map(async f => { try { return JSON.parse(await f.text()) } catch { return null } }))).filter(Boolean)
  const profile = findProfile(roots, tables)
  const techniques = readTechniques(tables)
  const sessionTables = tables.filter(t => !/techni|move|promot|belt|rank|graduat|profile|user|athlete|account/i.test(t.name))
  const empty = { sessions: [], skipped: [], columns: {}, headers: [], techniques, media, otherFiles, profile }
  if (!sessionTables.length) return empty
  const main = [...sessionTables].sort((a, b) => sessionScore(b) - sessionScore(a))[0]
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
  rows.forEach(row => {
    const date = parseDate(row[columns.date])
    if (!date) { skipped.push(row); return }
    const moves = String(row[columns.techniques] ?? '').split(/[,;|\n]/).map(s => s.trim()).filter(Boolean)
    const known = moves.filter(m => techsByName[m.toLowerCase()]), unknown = moves.filter(m => !techsByName[m.toLowerCase()])
    // Internal ids mean nothing to you, so they stay out of the notes (they're kept for matching photos).
    const extras = headers.filter(h => !used.has(h) && !/(^| )(id|uuid|guid)$/.test(norm(h)) && String(row[h] ?? '').trim()).map(h => `${h}: ${row[h]}`)
    const outside = rollsByDate[date] || []
    const rounds = (parseInt(row[columns.rounds] ?? row[rollList], 10) || 0) || outside.length
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
      date, time: parseTime(row[columns.start] || row[columns.date]), type: parseType(typeText),
      minutes: matTime(row, columns), rounds, importKeys: keysOf(row),
      focus: [], drilled: known.map(m => techsByName[m.toLowerCase()]), reps: [], photos: [], notes,
    })
  })
  return { ...empty, sessions, skipped, columns, headers }
}

// Decides where each photo goes: a session (by file name, then by date), a move, or your profile.
// `sessions` and `techs` are everything in the journal once this import is applied.
export function matchMedia(media, sessions, techs) {
  const byKey = {}, byDate = {}
  sessions.forEach(s => { (s.importKeys || []).forEach(k => byKey[k] ||= s); (byDate[s.date] ||= []).push(s) })
  const techByKey = {}
  techs.forEach(t => { techByKey[slug(t.name)] = t; (t.importKeys || []).forEach(k => techByKey[k] ||= t) })
  const nearDate = date => {
    for (const shift of [0, -1, 1]) {
      const d = new Date(date); d.setDate(d.getDate() + shift)
      const hit = byDate[isoDate(d)]
      if (hit) return hit[0]
    }
    return null
  }
  const add = (map, id, m) => { if (!map.has(id)) map.set(id, []); map.get(id).push(m) }
  const plan = { sessions: new Map(), techs: new Map(), profile: null, unmatched: [] }
  media.forEach(m => {
    const base = baseName(m.name).toLowerCase()
    const tokens = base.split(/[^a-z0-9-]+/).filter(t => t.length >= 6)
    if (m.kind === 'profile') { plan.profile ||= m; return }
    if (m.kind === 'technique') {
      const tech = techByKey[base] || techByKey[slug(base)] || tokens.map(t => techByKey[t]).find(Boolean)
        || techs.find(t => t.name.length > 4 && slug(base).includes(slug(t.name)))
      if (tech) add(plan.techs, tech.id, m)
      else plan.unmatched.push(m)
      return
    }
    const dated = base.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/)
    const session = byKey[base] || tokens.map(t => byKey[t]).find(Boolean)
      || (dated && nearDate(new Date(+dated[1], dated[2] - 1, +dated[3])))
      || nearDate(m.modified)
    if (session) add(plan.sessions, session.id, m)
    else plan.unmatched.push(m)
  })
  return plan
}
