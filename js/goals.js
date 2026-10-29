// Challenges: targets you set yourself, counted from what you log.
import { S } from './store.js'
import { isoDate, monthRange, parseD, sum, today } from './util.js'
import { landedIds, techById } from './model.js'

export const METRICS = {
  reps: 'Reps of a move',
  sessions: 'Sessions trained',
  hours: 'Mat hours',
  rollsWorked: 'Rolls that worked',
  drilled: 'Sessions drilling a move',
  manual: 'Count it yourself',
}

const createdDate = rec => rec.createdAt ? isoDate(new Date(rec.createdAt)) : today()

// Older goals were monthly; they keep working as a challenge for that month.
export function goalWindow(g) {
  if (g.month && !g.from) return monthRange(g.month)
  return [g.from || createdDate(g), g.until || '']
}

function goalValue(g) {
  const [from, until] = goalWindow(g)
  const inWindow = x => x.date >= from && (!until || x.date <= until)
  const sessions = S.session.filter(inWindow)
  switch (g.metric) {
    case 'reps': return sum(sessions.flatMap(s => (s.reps || []).filter(r => r.techId === g.techId)), 'count')
    case 'sessions': return sessions.length
    case 'hours': return Math.round(sum(sessions, 'minutes') / 6) / 10
    case 'rollsWorked': return S.roll.filter(r => inWindow(r) && r.result === 'worked' && (!g.position || r.position === g.position) && (!g.role || r.role === g.role) && (!g.techId || landedIds(r).includes(g.techId))).length
    case 'drilled': return sessions.filter(s => (s.drilled || []).includes(g.techId)).length
    default: return +g.manual || 0
  }
}

export function goalStatus(g) {
  const value = goalValue(g), target = +g.target || 1
  const [from, until] = goalWindow(g), now = today()
  if (value >= target) return { value, state: 'done', label: 'Done' }
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
