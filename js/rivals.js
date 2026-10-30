// Your opponents: everyone you've named on a roll or a positional round, their record against you,
// and their story told roll by roll, oldest first. Turning points (a first win, streaks, the move
// that keeps catching you, the day you paid it back) are called out as the count goes up.
// The nemesis is the one you pick, or else the partner you've rolled with 3+ times and beat least.
import { S, cached } from './store.js'
import { byDateAsc, cap, fmtDate, fmtMonthY } from './util.js'
import { partnerProfile, profileOf, rollMoves, techById } from './model.js'
import { gameName } from './rounds.js'

const keyOf = name => (name || '').trim().toLowerCase()
const outcomeOf = x => x.isRound ? (x.wins > x.losses ? 'worked' : x.wins < x.losses ? 'broke' : 'partial') : x.result
const MILESTONES = [5, 10, 25, 50, 100]

export const opponents = () => cached('opponents', () => {
  const by = {}
  const add = (x, isRound) => {
    const k = keyOf(profileOf(x)?.name || x.partner)
    if (k) (by[k] ||= { key: k, entries: [] }).entries.push({ ...x, isRound })
  }
  S.roll.forEach(r => add(r, false))
  S.round.forEach(g => add(g, true))
  const list = Object.values(by).map(summarize).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last))
  const pinned = S.settings.nemesis
  const nemesis = pinned === '-' ? null : list.find(o => o.key === pinned)
    || list.filter(o => o.n >= 3 && o.rate < 0.5).sort((a, b) => a.rate - b.rate || b.n - a.n)[0]
  if (nemesis) nemesis.nemesis = true
  return list
})

export const opponent = key => opponents().find(o => o.key === key) || null

function summarize({ key, entries }) {
  entries.sort(byDateAsc)
  const last = entries[entries.length - 1], p = partnerProfile(last.partner) || last
  const count = o => entries.filter(x => outcomeOf(x) === o).length
  const won = count('worked'), even = count('partial'), lost = count('broke')
  const tally = outcome => {
    const n = {}
    entries.forEach(x => movesOf(x).filter(m => m.outcome === outcome).forEach(m => n[m.techId] = (n[m.techId] || 0) + 1))
    const [id, times] = Object.entries(n).sort((a, b) => b[1] - a[1])[0] || []
    return id && techById(id) ? { tech: techById(id), times } : null
  }
  const score = list => list.length ? list.reduce((t, x) => t + ({ worked: 1, partial: 0.5 }[outcomeOf(x)] || 0), 0) / list.length : null
  const recent = entries.slice(-5), before = entries.slice(0, -5)
  return {
    key, name: (profileOf(last)?.name || last.partner).trim(), level: p.level, size: p.size, styles: p.styles || [], entries, n: entries.length,
    won, even, lost, rate: score(entries), lately: before.length >= 2 ? score(recent) - score(before) : null,
    first: entries[0].date, last: last.date, weapon: tally('caughtBy'), answer: tally('landed'),
  }
}

// A positional round's moves are kept the same way a roll's are.
const movesOf = x => x.isRound ? (x.moves || []) : rollMoves(x)
const names = ids => ids.map(id => techById(id)?.name).filter(Boolean).map(n => n.toLowerCase())
const and = list => list.length < 2 ? list[0] || '' : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]

// "The story so far", in a few lines.
export function summaryOf(o) {
  const lines = [`${o.n} ${o.n === 1 ? 'roll' : 'rolls'} since ${fmtMonthY(o.first)}. You’ve won ${o.won}, ${o.name} has won ${o.lost}${o.even ? `, ${o.even} even` : ''}.`]
  if (o.lately != null) lines.push(o.lately > 0.15 ? 'Lately you’re getting the better of it.' : o.lately < -0.15 ? `Lately ${o.name} has had the edge.` : 'Lately it’s been close.')
  if (o.weapon) lines.push(`Their weapon: the ${o.weapon.tech.name.toLowerCase()} (caught you ${o.weapon.times}×).`)
  if (o.answer) lines.push(`Your best answer: the ${o.answer.tech.name.toLowerCase()} (landed ${o.answer.times}×).`)
  return lines
}

// Each roll as a short scene, with the turning points that roll brought.
export function storyOf(o) {
  const caughtOn = {}, caughtTimes = {}
  let streak = 0, wins = 0
  return o.entries.map((x, i) => {
    const n = i + 1, outcome = outcomeOf(x), moves = movesOf(x), beats = []
    const landed = moves.filter(m => m.outcome === 'landed').map(m => m.techId), tried = moves.filter(m => m.outcome === 'tried').map(m => m.techId)
    const caught = moves.filter(m => m.outcome === 'caughtBy').map(m => m.techId)

    if (outcome === 'worked') { wins++; streak = streak > 0 ? streak + 1 : 1 }
    else if (outcome === 'broke') streak = streak < 0 ? streak - 1 : -1
    else streak = 0
    if (outcome === 'worked' && wins === 1) beats.push(n === 1 ? 'Won the first one.' : `First win over ${o.name}, after ${n - 1} ${n === 2 ? 'roll' : 'rolls'}.`)
    if (streak === 3) beats.push('Three in a row.')
    if (streak === -3) beats.push(`${o.name} has your number: three straight.`)
    const payback = landed.find(id => caughtOn[id])
    if (payback) beats.push(`Payback: the ${techById(payback)?.name.toLowerCase()} that caught you on ${fmtDate(caughtOn[payback])}.`)
    caught.forEach(id => {
      caughtOn[id] ||= x.date
      caughtTimes[id] = (caughtTimes[id] || 0) + 1
      if (caughtTimes[id] === 3) beats.push(`The ${techById(id)?.name.toLowerCase()} again. Third time.`)
    })

    const bits = []
    if (landed.length) bits.push(`you landed the ${and(names(landed))}`)
    if (tried.length) bits.push(`${landed.length ? '' : 'you '}went for the ${and(names(tried))}`)
    if (caught.length) bits.push(`${o.name} caught you with the ${and(names(caught))}`)
    const where = x.position && (x.position + (x.role && x.role !== 'Neutral' ? `, ${x.role.toLowerCase()}` : '')).toLowerCase()
    const told = bits.length ? bits.join(', ') + '.' : ''
    let scene = cap(told)
    if (x.isRound) scene = `Positional round, ${gameName(x).toLowerCase()}: you scored ${x.wins} of ${x.tries} goes, ${o.name} scored ${x.losses}. ${scene}`.trim()
    else if (where) scene = `From ${where}: ${told || 'no moves noted.'}`
    const end = x.isRound ? '' : outcome === 'worked' ? 'You came out on top.' : outcome === 'partial' ? 'Honors even.'
      : `${o.name} got the better of it${(x.reasons || []).length ? `: ${x.reasons.join(', ').toLowerCase()}` : ''}.`
    const title = n === 1 ? 'First roll' : MILESTONES.includes(n) ? `Roll ${n}, a milestone` : `Roll ${n}`
    const next = x.tryNext ? { text: x.tryNext, status: x.tryStatus } : null
    return { id: x.id, date: x.date, n, title, outcome, beats, scene, end, words: x.isRound ? x.note : x.what, next, isRound: x.isRound }
  })
}
