import { S, cached } from './store.js'
import { BELTS, ENERGY, REASONS, SIZES, SLEEP, STYLES } from './vocab.js'
import { byDateDesc, daysAgo, isoDate, posRole, rate, score, sum, topKeys, weekStart, ym } from './util.js'
import { rollTechId, seqById, sizeLabel } from './model.js'
import { activeOn } from './body.js'

const notWorked = r => r.result !== 'worked'

// Where rolls go wrong, grouped by position and role, worst first.
export function badSpots(from) {
  const bad = S.roll.filter(r => r.date >= from && notWorked(r))
  const groups = {}
  bad.forEach(r => {
    const g = groups[r.position + '|' + (r.role || '')] ||= { position: r.position, role: r.role, n: 0, weight: 0, reasons: {}, last: null }
    g.n++
    g.weight += 1 - score(r)
    ;(r.reasons || []).forEach(x => g.reasons[x] = (g.reasons[x] || 0) + 1)
    if (!g.last || r.date > g.last.date) g.last = r
  })
  return { bad, groups: Object.values(groups).sort((a, b) => b.weight - a.weight || b.n - a.n) }
}

export function stepStats(from) {
  const stats = {}
  S.roll.filter(r => r.seqId && r.nodeId && (!from || r.date >= from)).forEach(r => {
    const s = stats[r.seqId + '|' + r.nodeId] ||= { seqId: r.seqId, nodeId: r.nodeId, n: 0, broke: 0, worked: 0, partial: 0 }
    s.n++
    s[r.result]++
  })
  return stats
}

export function weakestStep(from) {
  let worst = null
  Object.values(stepStats(from)).forEach(s => {
    const bad = s.broke + s.partial * 0.5
    if (s.n < 2 || bad < 1) return
    const r = bad / s.n
    if (worst && (r < worst.r || (r === worst.r && s.n <= worst.n))) return
    const seq = seqById(s.seqId), node = seq?.nodes.find(n => n.id === s.nodeId)
    if (node) worst = { ...s, r, label: node.label, seq: seq.name }
  })
  return worst
}

export function techStats(id) {
  const rolls = S.roll.filter(r => rollTechId(r) === id)
  return {
    n: rolls.length,
    rate: rate(rolls),
    drilled: S.session.filter(s => (s.drilled || []).includes(id)).length,
    reps: sum(S.session.flatMap(s => (s.reps || []).filter(x => x.techId === id)), 'count'),
  }
}

export function monthlySeries(n) {
  const out = [], now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1), m = ym(first)
    const rolls = S.roll.filter(r => r.date.startsWith(m)), sessions = S.session.filter(s => s.date.startsWith(m))
    out.push({ m, label: first.toLocaleDateString(undefined, { month: 'short' }), rate: rate(rolls), n: rolls.length, sessions: sessions.length, minutes: sum(sessions, 'minutes'), broke: rolls.filter(r => r.result === 'broke').length })
  }
  return out
}

const sessionsInWeek = start => {
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const from = isoDate(start), to = isoDate(end)
  return S.session.filter(s => s.date >= from && s.date <= to).length
}

export function weeksOnTarget() {
  const target = S.settings.weeklyTarget || 3, start = weekStart(new Date())
  return [3, 2, 1, 0].map(i => { const w = new Date(start); w.setDate(w.getDate() - 7 * i); return sessionsInWeek(w) >= target })
}

export function weeklyStreak() {
  const target = S.settings.weeklyTarget || 3, start = weekStart(new Date())
  let streak = sessionsInWeek(start) >= target ? 1 : 0
  for (let i = 1; i < 520; i++) {
    const w = new Date(start); w.setDate(w.getDate() - 7 * i)
    if (sessionsInWeek(w) < target) break
    streak++
  }
  return streak
}

// Matchups: success against kinds of partners, compared with everyone else.
export function matchupGroups(rolls) {
  const dims = [
    { title: 'By partner belt', what: 'belt', order: BELTS.filter(b => b !== 'Unknown'), get: r => r.level && r.level !== 'Unknown' ? [r.level] : [], name: k => k.toLowerCase() + ' belt' },
    { title: 'By size', what: 'size', order: SIZES, get: r => r.size ? [r.size] : [], name: sizeLabel },
    { title: 'By style', what: 'style', order: STYLES, get: r => r.styles || [], name: k => k.toLowerCase() },
  ]
  return dims.map(d => ({
    ...d,
    noted: rolls.filter(r => d.get(r).length).length,
    rows: d.order.map(k => {
      const group = rolls.filter(r => d.get(r).includes(k)), others = rolls.filter(r => !d.get(r).includes(k))
      return { label: d.name(k), n: group.length, rate: rate(group), others: rate(others), rolls: group }
    }).filter(x => x.n),
  }))
}

export function hardestMatchup(rolls) {
  let hardest = null
  matchupGroups(rolls).forEach(d => d.rows.forEach(x => {
    if (x.n < 4 || rolls.length - x.n < 4 || x.others == null) return
    const gap = x.others - x.rate
    if (gap >= 0.15 && (!hardest || gap > hardest.gap)) hardest = { ...x, gap }
  }))
  return hardest
}

export function breakSummary(rolls) {
  const spots = {}, causes = {}
  const bad = rolls.filter(notWorked)
  bad.forEach(r => {
    const k = posRole(r.position, r.role)
    spots[k] = (spots[k] || 0) + 1
    ;(r.reasons || []).forEach(x => causes[x] = (causes[x] || 0) + 1)
  })
  return { bad: bad.length, spot: topKeys(spots, 1)[0] || '', cause: topKeys(causes, 1)[0] || '' }
}

// Problem trends: is each cause or problem spot fading or growing? Last 30 days vs the 30 before.
export function problemTrends() {
  const a = daysAgo(29), b = daysAgo(59)
  const months = monthlySeries(6).map(s => ({ label: s.label, rolls: S.roll.filter(r => r.date.startsWith(s.m)) }))
  const build = (label, inScope, isBad, minRolls) => {
    const cur = S.roll.filter(r => r.date >= a && inScope(r)), prev = S.roll.filter(r => r.date >= b && r.date < a && inScope(r))
    const cc = cur.filter(isBad).length, pc = prev.filter(isBad).length
    const c = cur.length ? cc / cur.length : null, p = prev.length ? pc / prev.length : null
    let state = 'steady'
    if (cur.length < minRolls || prev.length < minRolls) state = 'thin'
    else if (pc === 0 && cc >= 2) state = 'new'
    else if (p - c >= 0.1 && pc >= 2) state = 'fading'
    else if (c - p >= 0.1 && cc >= 2) state = 'growing'
    return {
      label, cur: c, prev: p, state,
      total: S.roll.filter(r => inScope(r) && isBad(r)).length,
      months: months.map(m => { const scoped = m.rolls.filter(inScope); return { label: m.label, v: scoped.length ? scoped.filter(isBad).length / scoped.length : null } }),
    }
  }
  const causes = REASONS
    .map(x => build(x, () => true, r => notWorked(r) && (r.reasons || []).includes(x), 3))
    .filter(t => t.total).sort((x, y) => y.total - x.total)
  const spotCounts = {}
  S.roll.filter(notWorked).forEach(r => { const k = r.position + '|' + (r.role || 'Neutral'); spotCounts[k] = (spotCounts[k] || 0) + 1 })
  const spots = topKeys(spotCounts, 6).map(k => {
    const [position, role] = k.split('|')
    return build(position + (role !== 'Neutral' ? ', ' + role.toLowerCase() : ''), r => r.position === position && (r.role || 'Neutral') === role, notWorked, 2)
  })
  return { causes, spots }
}

// How often each area of the game was ticked as going well or giving trouble after class.
export function areaCounts(field, from) {
  const counts = {}
  S.session.filter(s => !from || s.date >= from).forEach(s => (s[field] || []).forEach(a => counts[a] = (counts[a] || 0) + 1))
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

// "Try next" ideas that worked but aren't in a sequence yet.
export const unpromoted = () => S.roll.filter(r => r.tryNext && r.tryStatus === 'worked' && !r.promoted && !r.promoteSkip).sort(byDateDesc)

// ---------- Energy, sleep and injuries vs how rolls go ----------
// Each tag splits sessions into groups, and each group is compared with the other tagged sessions.
// A finding needs 5+ sessions with rolls and 10+ rolls on both sides, a gap of 10+ points in how
// often rolls broke down, and a gap a simple two-proportion test calls unlikely to be chance.
// Rolls from one session aren't independent, so even then the wording stays modest.
const MIN_SESSIONS = 5, MIN_ROLLS = 10, MIN_GAP = 0.1, MIN_Z = 1.65

// Untagged sessions count as injury-free only when the log shows nothing active that day,
// and only from the first logged injury on, since before that nobody was keeping track.
const injuryState = s => {
  if ((s.injuryIds || []).length) return 'hurt'
  const first = S.injury.reduce((m, i) => !m || i.startDate < m ? i.startDate : m, '')
  return first && s.date >= first && !activeOn(s.date).length ? 'healthy' : ''
}

const BODY_DIMS = [
  { key: 'sleep', title: 'Sleep', groups: SLEEP, of: s => s.sleep, days: { poor: 'poor-sleep days', ok: 'OK-sleep days', good: 'good-sleep days' }, others: 'other days you noted sleep' },
  { key: 'energy', title: 'Energy', groups: ENERGY, of: s => s.energy, days: { low: 'low-energy days', ok: 'OK-energy days', high: 'high-energy days' }, others: 'other days you noted energy' },
  { key: 'injury', title: 'Injuries', groups: { hurt: 'Around an injury', healthy: 'Injury-free' }, of: injuryState, days: { hurt: 'days you train around an injury', healthy: 'injury-free days' }, others: 'the rest' },
]

const tally = (sessions, bySession) => {
  const rolls = sessions.flatMap(s => bySession[s.id] || [])
  return { sessions: sessions.length, withRolls: sessions.filter(s => bySession[s.id]).length, rolls: rolls.length, broke: rolls.filter(r => r.result === 'broke').length, rate: rate(rolls) }
}

function finding(dim, key, g, rest) {
  if (g.withRolls < MIN_SESSIONS || rest.withRolls < MIN_SESSIONS || g.rolls < MIN_ROLLS || rest.rolls < MIN_ROLLS) return null
  const p1 = g.broke / g.rolls, p2 = rest.broke / rest.rolls, pooled = (g.broke + rest.broke) / (g.rolls + rest.rolls)
  const z = pooled > 0 && pooled < 1 ? (p1 - p2) / Math.sqrt(pooled * (1 - pooled) * (1 / g.rolls + 1 / rest.rolls)) : 0
  if (Math.abs(p1 - p2) < MIN_GAP || Math.abs(z) < MIN_Z) return null
  const days = dim.days[key]
  const text = p2 === 0 ? `Your rolls broke down ${Math.round(p1 * 100)}% of the time on ${days}, and not once on ${dim.others}.`
    : p1 === 0 ? `None of your rolls broke down on ${days}, against ${Math.round(p2 * 100)}% on ${dim.others}.`
    : p1 / p2 >= 2 ? `Your rolls break down about ${Math.round(p1 / p2 * 10) / 10}× as often on ${days}.`
    : `Your rolls break down ${Math.round(Math.abs(p1 - p2) / p2 * 100)}% ${p1 > p2 ? 'more' : 'less'} often on ${days}.`
  const detail = `${Math.round(p1 * 100)}% of ${g.rolls} rolls over ${g.withRolls} sessions, against ${Math.round(p2 * 100)}% of ${rest.rolls} rolls on ${dim.others}.`
  return { dim: dim.key, key, text, detail, z: Math.abs(z), worse: p1 > p2 }
}

// Every dimension's groups, plus at most one finding per dimension, strongest first.
export const bodyInsights = () => cached('bodyInsights', () => {
  const bySession = {}
  S.roll.forEach(r => r.sessionId && (bySession[r.sessionId] ||= []).push(r))
  const dims = BODY_DIMS.map(dim => {
    const tagged = S.session.filter(s => dim.of(s))
    const rows = Object.entries(dim.groups).map(([key, label]) => ({ key, label, ...tally(tagged.filter(s => dim.of(s) === key), bySession) }))
    const best = rows.map(row => finding(dim, row.key, row, tally(tagged.filter(s => dim.of(s) !== row.key), bySession))).filter(Boolean).sort((a, b) => b.z - a.z)[0]
    return { key: dim.key, title: dim.title, tagged: tagged.length, rows, finding: best || null }
  })
  return { dims, findings: dims.map(d => d.finding).filter(Boolean).sort((a, b) => b.z - a.z), min: { sessions: MIN_SESSIONS, rolls: MIN_ROLLS } }
})
