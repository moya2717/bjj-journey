import { S } from './store.js'
import { SOLO_DRILLS } from './catalog.js'
import { RANKS } from './vocab.js'
import { byDateAsc, isoDate, monthRange, parseD, plural, sum, today, weekStart } from './util.js'
import { allTechs, rollTechId, techById } from './model.js'

// An achievement family is a list of dated events and a ladder of targets.
// Each rung unlocks on the day the running total first reaches it.
function family(section, key, events, tiers, title, desc) {
  const sorted = [...events].sort(byDateAsc)
  const total = sum(sorted, 'amount')
  return tiers.map(target => {
    let running = 0
    const crossing = sorted.find(e => (running += e.amount) >= target)
    return { id: `${key}:${target}`, family: key, section, target, total, title: title(target), desc: desc(target), unlockedOn: crossing?.date || null }
  })
}

const count = (list, dateOf = x => x.date) => list.map(x => ({ date: dateOf(x), amount: 1 }))
const createdDate = rec => rec.createdAt ? isoDate(new Date(rec.createdAt)) : today()
const big = n => n.toLocaleString()

function streakFamily() {
  const target = S.settings.weeklyTarget || 3
  const perWeek = {}
  S.session.forEach(s => { const w = isoDate(weekStart(parseD(s.date))); perWeek[w] = (perWeek[w] || 0) + 1 })
  const hitWeeks = Object.keys(perWeek).filter(w => perWeek[w] >= target).sort()
  const events = []
  let run = 0, prev = null
  hitWeeks.forEach(w => {
    const consecutive = prev && Math.round((parseD(w) - parseD(prev)) / 864e5) === 7
    run = consecutive ? run + 1 : 1
    prev = w
    events.push({ date: w, run })
  })
  const best = Math.max(0, ...events.map(e => e.run))
  return [2, 4, 8, 12, 26, 52].map(n => ({
    id: `streak:${n}`, family: 'streak', section: 'Mat time', target: n, total: best,
    title: `${n}-week streak`, desc: `${n} weeks in a row at ${target}+ sessions`,
    unlockedOn: events.find(e => e.run >= n)?.date || null,
  }))
}

export function computeAchievements() {
  const out = []
  const sessions = S.session, rolls = S.roll, P = S.profile

  // Mat time
  out.push(...family('Mat time', 'sessions', count(sessions), [1, 10, 25, 50, 100, 250, 500, 1000],
    n => n === 1 ? 'First session logged' : `${big(n)} sessions`, n => `Log ${plural(n, 'training session')}`))
  out.push(...family('Mat time', 'hours', sessions.map(s => ({ date: s.date, amount: (+s.minutes || 0) / 60 })), [10, 25, 50, 100, 250, 500, 1000],
    n => `${big(n)} mat hours`, n => `Spend ${big(n)} hours on the mat`))
  out.push(...streakFamily())

  // Rolling
  out.push(...family('Rolling', 'rolls', count(rolls), [1, 10, 50, 100, 250, 500],
    n => n === 1 ? 'First roll analysed' : `${big(n)} rolls analysed`, n => `Log ${plural(n, 'roll note')}`))
  out.push(...family('Rolling', 'worked', count(rolls.filter(r => r.result === 'worked')), [10, 50, 100, 250],
    n => `${big(n)} rolls that worked`, n => `${big(n)} exchanges where your plan worked`))
  out.push(...family('Rolling', 'proven', count(rolls.filter(r => r.tryNext && r.tryStatus === 'worked')), [1, 5, 10, 25],
    n => n === 1 ? 'First experiment proven' : `${n} experiments proven`, n => `${plural(n, '“try next” idea')} that worked live`))
  out.push(...family('Rolling', 'sequences', count(S.seq, createdDate), [1, 3, 5, 10],
    n => n === 1 ? 'First sequence mapped' : `${n} sequences mapped`, n => `Build ${plural(n, 'decision tree')}`))

  // Drills and reps: every solo drill shows its next rung, plus any move you've logged reps for.
  const repEvents = {}
  sessions.forEach(s => (s.reps || []).forEach(r => (repEvents[r.techId] ||= []).push({ date: s.date, amount: +r.count || 0 })))
  const repTechs = [...new Set([...SOLO_DRILLS.map(t => t.id), ...Object.keys(repEvents)])]
  repTechs.forEach(id => {
    const tech = techById(id)
    if (tech) out.push(...family('Drills and reps', 'reps-' + id, repEvents[id] || [], [100, 500, 1000, 5000, 10000],
      n => `${big(n)} × ${tech.name}`, n => `Log ${big(n)} reps of ${tech.name.toLowerCase()}`))
  })

  // Techniques you actually use
  allTechs().forEach(t => {
    const drilled = sessions.filter(s => (s.drilled || []).includes(t.id))
    const landed = rolls.filter(r => r.result === 'worked' && rollTechId(r) === t.id)
    if (drilled.length) out.push(...family('Techniques', 'drill-' + t.id, count(drilled), [5, 25, 50, 100],
      n => `${t.name}: drilled ${n}×`, n => `Drill it in ${n} sessions`))
    if (landed.length) out.push(...family('Techniques', 'land-' + t.id, count(landed), [1, 10, 25, 50],
      n => n === 1 ? `${t.name}: first live success` : `${t.name}: landed ${n}×`, n => `Make it work in ${plural(n, 'live roll')}`))
  })

  // Competition and rank
  out.push(...family('Competition and rank', 'tournaments', count(P.tournaments), [1, 5, 10, 25],
    n => n === 1 ? 'First tournament' : `${n} tournaments`, n => `Compete ${n === 1 ? 'once' : n + ' times'}`))
  out.push(...family('Competition and rank', 'medals', count(P.tournaments.filter(t => t.place !== 'No medal')), [1, 5, 10],
    n => n === 1 ? 'First medal' : `${n} medals`, n => `Reach the podium ${n === 1 ? 'once' : n + ' times'}`))
  out.push(...family('Competition and rank', 'golds', count(P.tournaments.filter(t => t.place === 'Gold')), [1, 3, 10],
    n => n === 1 ? 'Gold medal' : `${n} golds`, n => `Win your division ${n === 1 ? 'once' : n + ' times'}`))
  out.push(...family('Competition and rank', 'wins', P.tournaments.map(t => ({ date: t.date, amount: +t.wins || 0 })), [1, 10, 25, 50],
    n => n === 1 ? 'First match win' : `${n} match wins`, n => `Win ${plural(n, 'competition match', 'competition matches')}`))
  RANKS.slice(1).forEach(belt => {
    const first = [...P.promotions].sort(byDateAsc).find(p => RANKS.indexOf(p.belt) >= RANKS.indexOf(belt))
    out.push({ id: 'belt:' + belt, family: 'belt', section: 'Competition and rank', target: belt, total: first ? 1 : 0,
      title: `${belt} belt`, desc: `Earn your ${belt.toLowerCase()} belt`, unlockedOn: first?.date || null })
  })

  // Journal habits
  out.push(...family('Journal habits', 'reflections', count(sessions.filter(s => s.reflectA)), [1, 10, 50, 100],
    n => n === 1 ? 'First reflection' : `${n} reflections`, n => `Answer the reflection question ${n === 1 ? 'once' : n + ' times'}`))
  out.push(...family('Journal habits', 'plans', count(sessions.filter(s => s.planHit === 'Stuck to it')), [5, 25, 50],
    n => `Stuck to the plan ${n}×`, n => `Follow your plan in ${n} sessions`))
  out.push(...family('Journal habits', 'photos', count(sessions.filter(s => (s.photos || []).length)), [1, 10, 50],
    n => n === 1 ? 'First photo' : `${n} days in photos`, n => `Add photos to ${plural(n, 'session')}`))

  return out
}

// Show what you've unlocked in each family, plus the next rung to chase.
export function visibleAchievements(all = computeAchievements()) {
  const nextShown = new Set()
  return all.filter(a => {
    if (a.unlockedOn) return true
    if (a.family === 'belt') return !nextShown.has('belt') && nextShown.add('belt')
    if (nextShown.has(a.family)) return false
    nextShown.add(a.family)
    return true
  })
}

export const progressOf = a => a.unlockedOn ? 1 : typeof a.target === 'number' ? Math.min(1, a.total / a.target) : 0

// ---------- Challenges: targets you set yourself ----------

export const METRICS = {
  reps: 'Reps of a move',
  sessions: 'Sessions trained',
  hours: 'Mat hours',
  rollsWorked: 'Rolls that worked',
  drilled: 'Sessions drilling a move',
  manual: 'Count it yourself',
}

// Older goals were monthly; they keep working as a challenge for that month.
export function goalWindow(g) {
  if (g.month && !g.from) return monthRange(g.month)
  return [g.from || createdDate(g), g.until || '']
}

export function goalValue(g) {
  const [from, until] = goalWindow(g)
  const inWindow = x => x.date >= from && (!until || x.date <= until)
  const sessions = S.session.filter(inWindow)
  switch (g.metric) {
    case 'reps': return sum(sessions.flatMap(s => (s.reps || []).filter(r => r.techId === g.techId)), 'count')
    case 'sessions': return sessions.length
    case 'hours': return Math.round(sum(sessions, 'minutes') / 6) / 10
    case 'rollsWorked': return S.roll.filter(r => inWindow(r) && r.result === 'worked' && (!g.position || r.position === g.position) && (!g.role || r.role === g.role) && (!g.techId || rollTechId(r) === g.techId)).length
    case 'drilled': return sessions.filter(s => (s.drilled || []).includes(g.techId)).length
    default: return +g.manual || 0
  }
}

export function goalStatus(g) {
  const value = goalValue(g), target = +g.target || 1
  const [from, until] = goalWindow(g), now = today()
  if (value >= target) return { value, state: 'done', label: 'Unlocked' }
  if (until && until < now) return { value, state: 'missed', label: 'Missed' }
  if (from > now) return { value, state: 'future', label: 'Not started' }
  if (!until) return { value, state: 'on', label: 'In progress' }
  const total = (parseD(until) - parseD(from)) / 864e5 + 1, elapsed = (parseD(now) - parseD(from)) / 864e5 + 1
  const expected = target * Math.min(1, elapsed / total)
  return value + 0.001 >= expected * 0.85 ? { value, state: 'on', label: 'On pace' } : { value, state: 'behind', label: 'Behind pace' }
}

export function goalDesc(g) {
  const t = techById(g.techId)
  if (g.metric === 'reps') return `Reps of ${t ? t.name.toLowerCase() : 'a move'}`
  if (g.metric === 'rollsWorked') return 'Rolls that worked' + (g.position ? ` from ${g.position.toLowerCase()}${g.role && g.role !== 'Neutral' ? ' ' + g.role.toLowerCase() : ''}` : '') + (t ? ` with ${t.name}` : '')
  if (g.metric === 'drilled') return `Sessions drilling ${t ? t.name : 'a move'}`
  if (g.metric === 'manual') return 'You update this one yourself'
  return METRICS[g.metric]
}

// Ids of everything unlocked, for spotting new unlocks after a save.
export function unlockedIds() {
  return new Set([
    ...computeAchievements().filter(a => a.unlockedOn).map(a => a.id),
    ...S.goal.filter(g => goalStatus(g).state === 'done').map(g => 'goal:' + g.id),
  ])
}

export function titleOf(id) {
  if (id.startsWith('goal:')) return S.goal.find(g => 'goal:' + g.id === id)?.title || 'Challenge'
  return computeAchievements().find(a => a.id === id)?.title || 'Achievement'
}
