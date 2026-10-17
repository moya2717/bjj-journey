import { RESULTS } from './vocab.js'

// DOM
export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

let toastTimer
export function toast(message) {
  const el = $('#toast')
  el.textContent = message
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800)
}

// Ids
export const newId = kind => kind + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export const slug = s => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Dates are stored as local "YYYY-MM-DD" strings, so they sort and compare as text.
const pad = n => String(n).padStart(2, '0')
export const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
export const today = () => isoDate(new Date())
export const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
export const ym = d => isoDate(d).slice(0, 7)
export function daysAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return isoDate(d) }
export function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
export function monthRange(m) { const [y, mm] = m.split('-').map(Number); return [isoDate(new Date(y, mm - 1, 1)), isoDate(new Date(y, mm, 0))] }
export function shiftMonth(m, n) { const [y, mm] = m.split('-').map(Number); return ym(new Date(y, mm - 1 + n, 1)) }

export const fmtDate = s => parseD(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const fmtDateLong = s => parseD(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
export const fmtMonthY = s => s ? parseD(s).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''
// Class times are stored as "HH:MM" and shown in the phone's own format ("6:30 PM").
export const fmtTime = t => t ? new Date(2000, 0, 1, ...t.split(':').map(Number)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
export const dayPart = t => !t ? '' : t < '12:00' ? 'Morning' : t < '17:00' ? 'Afternoon' : 'Evening'
export function monthLabel(m) { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }

export function span(from, to = today()) {
  if (!from) return ''
  const a = parseD(from), b = parseD(to)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
  if (b.getDate() < a.getDate()) months--
  if (months < 1) return plural(Math.max(0, Math.round((b - a) / 864e5)), 'day')
  const years = Math.floor(months / 12), rest = months % 12
  return [years ? plural(years, 'yr') : '', rest ? rest + ' mo' : ''].filter(Boolean).join(' ')
}

// Text and numbers
export const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'))
export const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)
export const pct = x => x == null ? '—' : Math.round(x * 100) + '%'
export const hrs = minutes => { const h = minutes / 60; return h >= 10 ? Math.round(h).toString() : (Math.round(h * 10) / 10).toString() }
export const sum = (list, f) => list.reduce((t, x) => t + (+(typeof f === 'function' ? f(x) : x[f]) || 0), 0)
export const topKeys = (counts, n) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0])

export const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)
export const byDateAsc = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0)

// A roll counts 1 when it worked, ½ when it partly worked.
export const score = roll => RESULTS[roll.result]?.score ?? 0
export const rate = rolls => rolls.length ? rolls.reduce((t, r) => t + score(r), 0) / rolls.length : null
export const posRole = (position, role) => esc(position) + (role && role !== 'Neutral' ? ', ' + esc(role.toLowerCase()) : '')
