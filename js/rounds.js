// Positional rounds: constraints-led sparring games. Both start in one spot, each side has a goal,
// and you reset when either gets theirs. A round is logged as a count: goes, yours, theirs.
// Per position they give cleaner numbers than whole rolls, so Stats and Today's focus read them.
import { S, cached } from './store.js'
import { daysAgo, topKeys, ym } from './util.js'
import { badSpots } from './analysis.js'

// Each game's goal for the top (or attacking) side and the bottom (or defending) side.
export const GAMES = {
  half: { name: 'Half guard: pass vs sweep', position: 'Half guard', goals: { Top: 'Pass', Bottom: 'Sweep or come up' } },
  back: { name: 'Back escape in 60s', position: 'Back', goals: { Top: 'Hold or finish for 60s', Bottom: 'Escape inside 60s' } },
  guard: { name: 'Guard retention', position: 'Open guard', goals: { Top: 'Pass', Bottom: 'Keep guard or sweep' } },
  mount: { name: 'Mount: escape vs submit', position: 'Mount', goals: { Top: 'Submit', Bottom: 'Escape' } },
  standing: { name: 'Standing: takedown vs defend', position: 'Standing', goals: { Top: 'Take them down', Bottom: 'Stop the takedown' } },
}
export const SIDES = ['Top', 'Bottom']

// Standing has no top or bottom: the sides are attacking and defending, and the role is Neutral.
export const sideName = (position, side) => position === 'Standing' ? (side === 'Bottom' ? 'defending' : 'attacking') : side.toLowerCase()
export const roleOf = (position, side) => position === 'Standing' ? 'Neutral' : side
export const spotName = (position, side) => position + ', ' + sideName(position, side)
export const gameName = g => GAMES[g.game]?.name || g.name || 'Custom game'

const rateOf = x => x.tries ? x.wins / x.tries : null
export const rounds = (from = '', to = '9') => S.round.filter(g => g.date >= from && g.date <= to)

// Rounds grouped by where they start and your side, most played first.
export function roundSpots(from = '', to = '9') {
  const spots = {}
  rounds(from, to).forEach(g => {
    const s = spots[g.position + '|' + g.side] ||= { k: g.position + '|' + g.side, position: g.position, side: g.side, n: 0, tries: 0, wins: 0, losses: 0 }
    s.n++
    s.tries += +g.tries || 0
    s.wins += +g.wins || 0
    s.losses += +g.losses || 0
  })
  return Object.values(spots).map(s => ({ ...s, rate: rateOf(s) })).sort((a, b) => b.tries - a.tries)
}

// Your success rate in each of the last n months, overall or from one spot: null in a month with no goes.
export function roundMonths(n, k = '') {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const first = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1), m = ym(first)
    const list = S.round.filter(g => g.date.startsWith(m) && (!k || g.position + '|' + g.side === k))
    const x = { tries: list.reduce((t, g) => t + (+g.tries || 0), 0), wins: list.reduce((t, g) => t + (+g.wins || 0), 0) }
    return { m, label: first.toLocaleDateString(undefined, { month: 'short' }), v: rateOf(x), tries: x.tries }
  })
}

// The last 30 days against the 30 before, per spot, for the trend arrow.
export const spotTrend = () => cached('spotTrend', () => {
  const now = Object.fromEntries(roundSpots(daysAgo(29)).map(s => [s.k, s])), before = Object.fromEntries(roundSpots(daysAgo(59), daysAgo(30)).map(s => [s.k, s]))
  return k => ({ now: now[k]?.tries >= 3 ? now[k].rate : null, before: before[k]?.tries >= 3 ? before[k].rate : null })
})

// A game worth playing next: your weakest spot in positional rounds (4+ goes in 60 days), else your
// top problem spot in rolls. The preset for that position when there is one.
export const suggestedGame = () => cached('suggestedGame', () => {
  const weak = roundSpots(daysAgo(59)).filter(s => s.tries >= 4 && s.rate < 0.5).sort((a, b) => a.rate - b.rate || b.tries - a.tries)[0]
  const spot = weak || badSpots(daysAgo(59)).groups.find(g => g.position)
  if (!spot) return null
  const side = weak ? weak.side : spot.role === 'Bottom' ? 'Bottom' : 'Top'
  const key = Object.keys(GAMES).find(k => GAMES[k].position === spot.position)
  const cause = weak ? '' : topKeys(spot.reasons, 1)[0]
  return {
    game: key || '', position: spot.position, side,
    text: key ? `Play “${GAMES[key].name}”, ${sideName(spot.position, side)}` : `Play a positional round from ${spotName(spot.position, side).toLowerCase()}`,
    why: weak ? `Your weakest game: you scored ${weak.wins} of ${weak.tries} goes in 60 days` : `Your top problem spot in rolls${cause ? `, mostly ${cause.toLowerCase()}` : ''}`,
  }
})
