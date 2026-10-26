// Scenario review: a handful of situations a week, built from your own rolls, to think through
// before your next class. Each one reveals your own notes, the matching fix and what to try next.
// Only your answers are saved, in settings.scenarioLog: [{ date, id, answer }].
import { S, cached } from './store.js'
import { FIXES } from './fixes.js'
import { byDateDesc, daysAgo, fmtDate, isoDate, parseD, today, topKeys, weekStart } from './util.js'
import { masteryOf, rollMoves, rollTechId, seqById, techById } from './model.js'
import { weakestStep } from './analysis.js'
import { defensesFor, menuFor } from './sim.js'

export const PER_WEEK = 5
export const ANSWERS = { got: 'Got it', drill: 'Need to drill', coach: 'Ask coach' }
export const scenarioLog = () => S.settings.scenarioLog || []

const where = (pos, role) => pos + (role && role !== 'Neutral' ? ' ' + role.toLowerCase() : '')
const when = date => date >= daysAgo(6) ? (date === today() ? 'today' : 'last ' + parseD(date).toLocaleDateString(undefined, { weekday: 'long' })) : fmtDate(date)
const lower = s => s.charAt(0).toLowerCase() + s.slice(1)

// Your answers from a sequence come first; otherwise the moves the Live roll map has from here, best known first.
function nextMoves(pos, role, seqId, nodeId) {
  const seq = seqById(seqId), node = seq?.nodes.find(n => n.id === nodeId)
  if (node) {
    const kids = seq.nodes.filter(n => n.parentId === node.id)
    const lines = kids.flatMap(k => k.who === 'them' ? [`They ${lower(k.label)} → ${seq.nodes.filter(a => a.parentId === k.id).map(a => a.label).join(' or ') || 'no answer mapped yet'}`] : [`Then: ${k.label}`])
    if (lines.length) return { from: `Your sequence: ${seq.name}`, lines }
  }
  const ids = [...new Set(menuFor({ pos, role, setups: [] }).map(m => m.id))].map(techById).filter(Boolean)
    .sort((a, b) => masteryOf(b).level - masteryOf(a).level).slice(0, 3)
  return ids.length ? { from: 'The Live roll map from here', lines: ids.map(t => `${t.name} (${lower(t.type)})`) } : null
}

const fixFor = reason => FIXES[reason] ? { reason, cues: FIXES[reason].cues.slice(0, 2), drill: FIXES[reason].drill } : null

export const candidates = () => cached('scenarios', () => {
  const recent = S.roll.filter(r => r.date >= daysAgo(59)).sort(byDateDesc), out = []

  const weak = weakestStep(daysAgo(59))
  if (weak) {
    const seq = seqById(weak.seqId), node = seq?.nodes.find(n => n.id === weak.nodeId)
    const reasons = {}
    recent.filter(r => r.seqId === weak.seqId && r.nodeId === weak.nodeId).forEach(r => (r.reasons || []).forEach(x => reasons[x] = (reasons[x] || 0) + 1))
    out.push({ id: `step:${weak.seqId}|${weak.nodeId}`, tag: `${seq.name} · weakest step`,
      prompt: `In ${seq.name}, “${weak.label}” went wrong in ${weak.broke + weak.partial} of ${weak.n} rolls. What do you do the moment it happens?`,
      notes: node?.note || '', fix: fixFor(topKeys(reasons, 1)[0]), next: nextMoves(seq.position, seq.role, seq.id, node?.id),
      focus: { text: `${node?.who === 'them' ? 'Find an answer to' : 'Fix'} “${weak.label}” (${seq.name})`, techId: node?.techId || '', seqId: seq.id },
      coachQ: `In ${seq.name}, “${weak.label}” keeps going wrong. What should I be doing there?` })
  }

  const caught = {}
  recent.forEach(r => rollMoves(r).filter(m => m.outcome === 'caughtBy').forEach(m => (caught[m.techId] ||= []).push(r)))
  topKeys(Object.fromEntries(Object.entries(caught).map(([id, rs]) => [id, rs.length])), 1).filter(id => caught[id].length >= 2 && techById(id)).forEach(id => {
    const t = techById(id), r = caught[id][0], defs = defensesFor(t, { pos: r.position, role: r.role, setups: [] }).map(techById).filter(Boolean).slice(0, 3)
    out.push({ id: `caught:${id}`, tag: `${where(r.position, r.role)} · caught ${caught[id].length} times`,
      prompt: `You’ve been caught by the ${lower(t.name)} ${caught[id].length} times lately, most recently ${r.date === today() ? 'today' : 'on ' + fmtDate(r.date)}. Where does it start, and what’s your first defence?`,
      what: r.what || '', fix: fixFor(r.reasons?.[0]),
      next: defs.length ? { from: 'Defences from the Live roll map', lines: defs.map(d => d.name) } : null,
      focus: { text: `Defend the ${lower(t.name)}`, techId: defs[0]?.id || '', seqId: '' },
      coachQ: `I keep getting caught by the ${lower(t.name)} from ${where(r.position, r.role)}. What’s my first defence?` })
  })

  recent.filter(r => r.result !== 'worked').forEach(r => {
    const move = techById(rollTechId(r)), reason = r.reasons?.[0]
    out.push({ id: `roll:${r.id}`, tag: `${where(r.position, r.role)} · ${when(r.date)}`,
      prompt: `${where(r.position, r.role)}, ${when(r.date)}: ${move ? `your ${lower(move.name)}` : 'the round'} ${r.result === 'broke' ? 'broke down' : 'only partly worked'}${reason ? ` (cause: ${lower(reason)})` : ''}. What would you do now?`,
      what: r.what || '', tryNext: r.tryNext ? { text: r.tryNext, status: r.tryStatus || 'open' } : null,
      fix: fixFor(reason), next: nextMoves(r.position, r.role, r.seqId, r.nodeId),
      focus: { text: r.tryNext || `Work on ${where(r.position, r.role)}${reason ? `: ${lower(reason)}` : ''}`, techId: move?.id || '', seqId: r.seqId || '' },
      coachQ: `${move ? `In ${lower(where(r.position, r.role))}, my ${lower(move.name)}` : `In ${lower(where(r.position, r.role))}, my rounds`} keep${move ? 's' : ''} breaking down${reason ? ` on ${lower(reason)}` : ''}. What am I missing?` })
  })

  S.roll.filter(r => r.tryNext && (r.tryStatus || 'open') === 'open' && !(r.date >= daysAgo(59) && r.result !== 'worked')).sort(byDateDesc).forEach(r => {
    out.push({ id: `try:${r.id}`, tag: `${where(r.position, r.role)} · experiment`,
      prompt: `You planned to test “${r.tryNext}” in ${lower(where(r.position, r.role))}. How will you set it up in your next roll?`,
      what: r.what || '', fix: fixFor(r.reasons?.[0]), next: nextMoves(r.position, r.role, r.seqId, r.nodeId),
      focus: { text: r.tryNext, techId: rollTechId(r) || '', seqId: r.seqId || '' },
      coachQ: `I want to test “${r.tryNext}” in ${lower(where(r.position, r.role))}. Any details I should know?` })
  })

  // Anything answered in the last 3 weeks rests for a while.
  const rested = new Set(scenarioLog().filter(a => a.date >= daysAgo(20)).map(a => a.id))
  return out.filter(s => !rested.has(s.id))
})

// This week's set: up to 5, fewer as you answer them. Never a daily chore.
export function thisWeek() {
  const from = isoDate(weekStart(new Date())), done = scenarioLog().filter(a => a.date >= from).length
  return { done, left: candidates().slice(0, Math.max(0, PER_WEEK - done)) }
}
