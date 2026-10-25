// Training load and runs. Load uses the session-RPE idea: minutes × effort on a 1–10 scale.
// Runs and other activities use the RPE you logged, or else their intensity; BJJ sessions use a
// typical effort for the kind of class. Runs are ordinary "Running" activities, nothing separate.
import { S, cached } from './store.js'
import { byDateAsc, daysAgo, isoDate, monthRange, parseD, shiftMonth, sum, weekStart, ym } from './util.js'

export const LOAD_TYPES = ['Mat', 'Runs', 'Other']
const INTENSITY_RPE = { Easy: 3, Moderate: 5, Hard: 7 }
const CLASS_RPE = { Gi: 6, 'No-gi': 6, 'Open mat': 7, Private: 5, Competition: 9, 'Drilling only': 4 }
export const rpeIntensity = rpe => rpe <= 4 ? 'Easy' : rpe <= 7 ? 'Moderate' : 'Hard'

export const isRun = a => a.kind === 'activity' && a.type === 'Running'
const effort = x => +x.rpe || (x.kind === 'session' ? CLASS_RPE[x.type] || 6 : INTENSITY_RPE[x.intensity] || 5)
const typeOf = x => x.kind === 'session' ? 0 : isRun(x) ? 1 : 2

const entries = () => cached('loadEntries', () => [...S.session, ...S.activity].map(x => ({ date: x.date, t: typeOf(x), min: +x.minutes || 0, load: (+x.minutes || 0) * effort(x) })))

function tally(from, to) {
  const list = entries().filter(e => e.date >= from && e.date <= to)
  const by = f => LOAD_TYPES.map((_, t) => Math.round(sum(list.filter(e => e.t === t), f)))
  const load = by('load')
  return { minutes: by('min'), load, total: sum(load, x => x) }
}

const weekFrom = i => { const w = weekStart(new Date()); w.setDate(w.getDate() - 7 * i); return w }
const weekEnd = w => { const e = new Date(w); e.setDate(e.getDate() + 6); return isoDate(e) }

// Oldest first, ending with this week (or month) so far.
export const loadWeeks = n => Array.from({ length: n }, (_, k) => {
  const w = weekFrom(n - 1 - k)
  return { label: w.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), ...tally(isoDate(w), weekEnd(w)) }
})
export const loadMonths = n => Array.from({ length: n }, (_, k) => {
  const m = shiftMonth(ym(new Date()), k - n + 1)
  return { label: parseD(m).toLocaleDateString(undefined, { month: 'short' }), ...tally(...monthRange(m)) }
})

// This week so far against the 4 full weeks before it, and last week against the one before.
// A week more than 40% over the 4-week average is a spike worth easing into.
export const loadTrend = () => cached('loadTrend', () => {
  const w = loadWeeks(6), now = w[5].total, last = w[4].total, before = w[3].total
  const avg = sum(w.slice(1, 5), 'total') / 4
  return { now, last, before, avg, ratio: avg ? now / avg : null, wow: before ? (last - before) / before : null, spike: avg > 0 && now > avg * 1.4 }
})

// ---------- Runs ----------

const KM = { km: 1, mi: 1.609344 }
export const runs = () => cached('runs', () => S.activity.filter(isRun).sort(byDateAsc))
export const distUnit = () => S.settings.distUnit || runs().at(-1)?.unit || 'mi'
export const distIn = (r, unit) => (+r.distance || 0) * KM[r.unit || 'mi'] / KM[unit]
export const paceOf = (minutes, dist) => dist > 0 && minutes > 0 ? minutes / dist : null
export const fmtDist = d => (Math.round(d * 10) / 10).toString()

// Minutes as "1:05:30" or "32:15"; pace in minutes per unit as "8:42".
export function fmtClock(minutes) {
  if (minutes == null) return '—'
  const s = Math.round(minutes * 60), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, pad = n => String(n).padStart(2, '0')
  return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60)
}

export const runStats = () => cached('runStats', () => {
  const unit = distUnit(), list = runs()
  const total = rs => ({ n: rs.length, dist: sum(rs, r => distIn(r, unit)), minutes: sum(rs, 'minutes') })
  const pace = rs => { const paced = rs.filter(r => +r.distance && +r.minutes); return paceOf(sum(paced, 'minutes'), sum(paced, r => distIn(r, unit))) }
  const inRange = (from, to) => list.filter(r => r.date >= from && r.date <= to)
  const weeks = Array.from({ length: 12 }, (_, k) => {
    const w = weekFrom(11 - k), rs = inRange(isoDate(w), weekEnd(w))
    return { label: w.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), counts: [Math.round(total(rs).dist * 10) / 10], pace: pace(rs) }
  })
  return {
    unit, n: list.length, weeks,
    week: total(inRange(isoDate(weekFrom(0)), '9999')),
    month: total(list.filter(r => r.date.startsWith(ym(new Date())))),
    longest: list.reduce((best, r) => distIn(r, unit) > (best ? distIn(best, unit) : 0) ? r : best, null),
    pace30: pace(inRange(daysAgo(29), '9999')), pacePrev: pace(inRange(daysAgo(59), daysAgo(30))),
  }
})
