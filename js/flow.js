// Where each move starts and where it can lead, for the move pages. Read from the Live roll's table
// (sim.js), so the game, the chain picker, the roll parser and these pages tell the same story.
// Positions are 'Position|Role' keys in the mover's terms; in a leg entanglement, Bottom attacks the legs.

import { S } from './store.js'
import { ALSO, AFTER, DEFENSES, MENU, OFF, UNSURE, flip, key } from './sim.js'
import { rollMoves, techById } from './model.js'
import { slug } from './util.js'

const idOf = name => 'c:' + slug(name)
const norm = (pos, role) => pos === 'Standing' ? 'Standing|Neutral' : key(pos, role || '')

export const theirSide = k => { const [pos, role] = k.split('|'); return norm(pos, flip(role)) }
export const posLabel = k => {
  const [pos, role] = k.split('|')
  if (pos === 'Standing' || !role) return pos
  return pos + ' · ' + (pos === 'Leg entanglement' ? (role === 'Bottom' ? 'attacking' : 'defending') : role.toLowerCase())
}

// Each move's starts: id → [{ from, lands, stays }]. lands lists landings, the usual one first; a move
// that stays (a grip, a finish) lists only where it sometimes ends up. lands is null when not mapped.
export const FLOW = (() => {
  const out = {}, add = (name, from, lands, stays = false) => (out[idOf(name)] ||= []).push({ from, lands, stays })
  const also = (name, from) => (ALSO[name] || []).map(([p, r]) => key(p, r)).filter(k => k !== from)
  Object.entries(MENU).forEach(([k, moves]) => moves.forEach(([name, pos, role]) =>
    add(name, k, UNSURE.has(name) ? null : pos ? [key(pos, role), ...also(name, k)] : also(name, k), !pos)))
  Object.entries(OFF).forEach(([name, [from, to]]) => add(name, from, to === null ? null : to ? [to, ...also(name, from)] : [], to === ''))
  // A defense starts wherever the submissions it answers are done to you, and keeps you there.
  DEFENSES.forEach(([re, name]) => {
    const seen = new Set((out[idOf(name)] || []).map(r => r.from))
    Object.entries(MENU).forEach(([k, moves]) => moves.forEach(([n, pos]) => {
      const from = key(k.split('|')[0], flip(k.split('|')[1]))
      if (!pos && re.test(n) && !/defense/i.test(n) && !seen.has(from)) { seen.add(from); add(name, from, [], true) }
    }))
  })
  return out
})()

// Moves done from a position: the ones that move you on first, then finishes, then grips and holds.
export const kindFrom = (id, k) => { const r = FLOW[id]?.find(r => r.from === k); return !r?.stays ? 0 : techById(id)?.type === 'Submission' ? 1 : 2 }
export const movesFrom = k => [...(MENU[k] || []).map(([name]) => idOf(name)), ...Object.entries(OFF).filter(([, [from]]) => from === k).map(([name]) => idOf(name))]
  .sort((a, b) => kindFrom(a, k) - kindFrom(b, k))

// Moves that land in a position: usual landings first, then the ones that sometimes do, then a finish
// that sometimes ends there instead.
export function movesInto(k) {
  const into = []
  Object.entries(FLOW).forEach(([id, rows]) => rows.forEach(r => {
    const i = r.lands && r.from !== k ? r.lands.indexOf(k) : -1
    if (i >= 0) into.push([id, r.stays ? 2 : i ? 1 : 0])
  }))
  return [...new Set(into.sort((a, b) => a[1] - b[1]).map(([id]) => id))]
}
// Your partner's moves that put you in a position: theirs that land them on the other side of it.
export const theirsInto = k => k.startsWith('Standing|') ? [] : movesInto(theirSide(k))

// Moves this one sets up: they only make sense after it.
export const setsUp = name => Object.keys(AFTER).filter(n => AFTER[n].includes(name)).map(idOf)
export const needs = name => (AFTER[name] || []).map(idOf)

// What you logged with a move: where you were, where the next step of the chain found you, and how
// it went, in your own terms. A roll with no chain only knows where it started.
export function fromRolls(id) {
  const rows = {}
  const bump = (from, to, outcome) => {
    const r = rows[[from, to, outcome === 'caughtBy'].join('>')] ||= { from, to, theirs: outcome === 'caughtBy', landed: 0, tried: 0, caughtBy: 0 }
    r[outcome]++
  }
  S.roll.forEach(r => {
    if (r.chain?.length) r.chain.forEach((m, i) => {
      const next = r.chain[i + 1]
      if (m.techId === id && m.position) bump(norm(m.position, m.role), m.outcome !== 'tried' && next?.position ? norm(next.position, next.role) : '', m.outcome)
    })
    else if (r.position) rollMoves(r).filter(m => m.techId === id).forEach(m => bump(norm(r.position, r.role), '', m.outcome))
  })
  const n = r => r.landed + r.tried + r.caughtBy
  return Object.values(rows).sort((a, b) => n(b) - n(a) || !!b.to - !!a.to)
}

// A logged row in the mover's terms, for comparing with the table and for mapping a move yourself.
export const moverTerms = r => r.theirs ? { from: theirSide(r.from), to: r.to && theirSide(r.to) } : { from: r.from, to: r.to }
