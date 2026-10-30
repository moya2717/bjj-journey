// Your opponents: everyone you've named on a roll or a positional round, plus the partners you made
// a profile for. One place does the counting for all of it: their record, their story told roll by
// roll (turning points like a first win, streaks, the move that keeps catching you, the day you paid
// it back), and the pre-roll scouting brief. The brief only counts what you logged: each line keeps
// the ids of the rolls behind it, so a tap shows where every number came from.
// An opponent with a profile is keyed by its id, so its story, record and nemesis follow a rename.
// The nemesis is the one you pick, or else the partner you've rolled with 3+ times and beat least.
import { S, cached } from './store.js'
import { byDateAsc, byDateDesc, cap, fmtDate, fmtMonthY, plural } from './util.js'
import { partnerProfile, profileOf, rollMoves, techById } from './model.js'
import { gameName } from './rounds.js'

const nameKey = name => (name || '').trim().toLowerCase()
const outcomeOf = x => x.isRound ? (x.wins > x.losses ? 'worked' : x.wins < x.losses ? 'broke' : 'partial') : x.result
const MILESTONES = [5, 10, 25, 50, 100]

export const opponents = () => cached('opponents', () => {
  const by = {}
  S.partner.forEach(p => by[p.id] = { key: p.id, profile: p, entries: [] })
  const add = (x, isRound) => {
    const p = profileOf(x), k = p ? p.id : nameKey(x.partner)
    if (k) (by[k] ||= { key: k, profile: null, entries: [] }).entries.push({ ...x, isRound })
  }
  S.roll.forEach(r => add(r, false))
  S.round.forEach(g => add(g, true))
  const list = Object.values(by).map(summarize).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last) || a.name.localeCompare(b.name))
  // A nemesis pinned before profiles existed was kept by name.
  const pinned = S.settings.nemesis
  const nemesis = pinned === '-' ? null : list.find(o => o.key === pinned || nameKey(o.name) === pinned)
    || list.filter(o => o.n >= 3 && o.rate < 0.5).sort((a, b) => a.rate - b.rate || b.n - a.n)[0]
  if (nemesis) nemesis.nemesis = true
  return list
})

export const opponent = key => opponents().find(o => o.key === key) || null

// Each key and the entries it shows up in, once per entry, most entries first.
function tally(list, keysOf) {
  const c = {}
  list.forEach(x => new Set(keysOf(x)).forEach(k => { if (k) (c[k] ||= []).push(x.id) }))
  return Object.entries(c).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
}

// A positional round's moves are kept the same way a roll's are.
const movesOf = x => x.isRound ? (x.moves || []) : rollMoves(x)
const techsOf = (x, outcome) => movesOf(x).filter(m => m.outcome === outcome).map(m => techById(m.techId)).filter(Boolean)
const top = (entries, outcome) => {
  const [hit] = tally(entries, x => techsOf(x, outcome).map(t => t.id))
  return hit ? { tech: techById(hit[0]), times: hit[1].length } : null
}

function summarize({ key, profile, entries }) {
  entries.sort(byDateAsc)
  const last = entries[entries.length - 1], name = profile?.name || spelling(entries)
  const p = partnerProfile(name) || last || {}
  const count = o => entries.filter(x => outcomeOf(x) === o).length
  const score = list => list.length ? list.reduce((t, x) => t + ({ worked: 1, partial: 0.5 }[outcomeOf(x)] || 0), 0) / list.length : null
  const recent = entries.slice(-5), before = entries.slice(0, -5)
  return {
    key, profile, name, level: profile?.belt || p.level, size: profile?.size || p.size, styles: profile?.styles?.length ? profile.styles : p.styles || [],
    entries, n: entries.length, rolls: entries.filter(x => !x.isRound).length,
    won: count('worked'), even: count('partial'), lost: count('broke'), rate: score(entries), lately: before.length >= 2 ? score(recent) - score(before) : null,
    first: entries[0]?.date || '', last: last?.date || '', weapon: top(entries, 'caughtBy'),
  }
}

// The way you write their name most often; the latest one breaks a tie.
function spelling(entries) {
  const n = {}
  entries.forEach(x => { const s = x.partner.trim(); n[s] = (n[s] || 0) + 1 })
  return Object.keys(n).reverse().sort((a, b) => n[b] - n[a])[0]
}

const names = ids => ids.map(id => techById(id)?.name).filter(Boolean).map(n => n.toLowerCase())
const and = list => list.length < 2 ? list[0] || '' : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]

// "The story so far", in a line or two. Their moves and yours are in the brief.
export function summaryOf(o) {
  const rounds = o.n - o.rolls
  const lines = [`${plural(o.rolls, 'roll')}${rounds ? ` and ${plural(rounds, 'positional round')}` : ''} since ${fmtMonthY(o.first)}. You’ve won ${o.won}, ${o.name} has won ${o.lost}${o.even ? `, ${o.even} even` : ''}.`]
  if (o.lately != null) lines.push(o.lately > 0.15 ? 'Lately you’re getting the better of it.' : o.lately < -0.15 ? `Lately ${o.name} has had the edge.` : 'Lately it’s been close.')
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

// ---------- The scouting brief ----------

// What a partner's move did to you, by move type. Other types read as "caught you".
const DID = { Pass: 'passed your guard', Sweep: 'swept you', Submission: 'caught you in a submission', Takedown: 'took you down', Escape: 'escaped from you', Retention: 'held their guard against you' }
const lower = s => s.charAt(0).toLowerCase() + s.slice(1)
export const spotOf = x => x.position ? x.position + (x.role && x.role !== 'Neutral' ? ', ' + x.role.toLowerCase() : '') : ''
const withs = (total, list) => list.map(([id, ids]) => `${ids.length === total ? total === 1 ? '' : total === 2 ? 'both ' : 'all ' : ids.length + ' '}with the ${lower(techById(id).name)}`).join(', ')
const counted = list => list.map(([k, ids]) => `${k} (${ids.length})`)
const union = list => [...new Set(list.flatMap(c => c[1]))]

// The brief for one opponent. Each line: { k, text, ids }; ids are rolls, or rounds for the rounds line.
export function scout(o) {
  const rolls = o.entries.filter(x => !x.isRound).sort(byDateDesc), rounds = o.entries.filter(x => x.isRound), n = rolls.length, name = o.name
  const by = res => rolls.filter(r => r.result === res).length
  const lines = { head: [], them: [], mine: [] }
  const add = (part, k, text, ids) => ids.length && lines[part].push({ k, text, ids })

  if (n) add('head', 'all', `You’ve rolled with ${name} ${n === 1 ? 'once' : n + ' times'} (last: ${fmtDate(rolls[0].date)}). Results: ${by('worked')} worked, ${by('partial')} partly, ${by('broke')} broke.`, rolls.map(r => r.id))
  if (rounds.length) {
    const sum = k => rounds.reduce((t, g) => t + (+g[k] || 0), 0)
    add('head', 'rounds', `Positional rounds: ${rounds.length}. You scored on ${sum('wins')} of ${plural(sum('tries'), 'go', 'goes')}, ${name} on ${sum('losses')}.`, rounds.map(g => g.id))
  }

  // What they do to you: their moves by type, then the causes and spots you noted when it broke.
  const typeOf = t => DID[t.type] ? t.type : 'Other'
  tally(rolls, r => techsOf(r, 'caughtBy').map(typeOf)).slice(0, 3).forEach(([type, ids]) => {
    const theirs = tally(rolls.filter(r => ids.includes(r.id)), r => techsOf(r, 'caughtBy').filter(t => typeOf(t) === type).map(t => t.id)).slice(0, 3)
    add('them', 'caught-' + type, `${name} ${DID[type] || 'caught you'} in ${ids.length} of ${plural(n, 'roll')}: ${withs(ids.length, theirs)}.`, ids)
  })
  const bad = rolls.filter(r => r.result !== 'worked')
  const causes = tally(bad, r => r.reasons || []).slice(0, 3), spots = tally(bad, r => [spotOf(r)]).slice(0, 3)
  add('them', 'causes', `When it went wrong you noted: ${counted(causes).join(', ').toLowerCase()}.`, union(causes))
  add('them', 'spots', `It went wrong from: ${counted(spots).join('; ').toLowerCase()}.`, union(spots))

  // What works for you, and where your rolls with them start.
  const landed = tally(rolls, r => techsOf(r, 'landed').map(t => t.id)).slice(0, 4)
  add('mine', 'landed', `You landed: ${landed.map(([id, ids]) => `${lower(techById(id).name)} in ${plural(ids.length, 'roll')}`).join(', ')}.`, union(landed))
  const starts = tally(rolls, r => [spotOf(r)])
  add('mine', 'starts', `Where it starts: ${starts.slice(0, 3).map(([spot, ids]) => `${lower(spot)} (${ids.length}, ${rolls.filter(r => ids.includes(r.id) && r.result === 'worked').length} worked)`).join('; ')}.`, union(starts.slice(0, 3)))

  const notes = o.profile?.notes || []
  const latest = [...notes].filter(x => !x.pinned).sort(byDateDesc)[0]
  const usual = starts[0] && rolls.find(r => r.id === starts[0][1][0])
  return { n, rolls, rounds, lines, plan: planFor(rolls), usual, notes: [...notes.filter(x => x.pinned), ...(latest ? [latest] : [])], thin: n < 3 }
}

// One suggestion, from the data only: the start where your rolls with them work best (2+ rolls,
// half or more worked), else a chain of yours that worked on them, else their most common weapon.
function planFor(rolls) {
  const best = tally(rolls, r => [spotOf(r)]).map(([spot, ids]) => {
    const there = rolls.filter(r => ids.includes(r.id)), won = there.filter(r => r.result === 'worked')
    return { spot, ids, won, n: there.length, start: there[0] }
  }).filter(s => s.n >= 2 && s.won.length * 2 >= s.n).sort((a, b) => b.won.length / b.n - a.won.length / a.n || b.n - a.n)[0]
  if (best) {
    const [hit] = tally(best.won, r => techsOf(r, 'landed').map(t => t.id))
    return { text: `Start from ${lower(best.spot)}: ${best.won.length} of ${best.n} rolls there worked${hit ? `, and you landed the ${lower(techById(hit[0]).name)} in ${hit[1].length === best.won.length && hit[1].length > 1 ? 'each' : plural(hit[1].length, 'roll')}` : ''}.`, ids: best.ids, from: best.start }
  }
  const chain = rolls.find(r => r.result === 'worked' && (r.chain || []).filter(m => m.outcome === 'landed').length >= 2)
  if (chain) return { text: `Run what worked on ${fmtDate(chain.date)}: ${chain.chain.filter(m => m.outcome === 'landed').map(m => lower(techById(m.techId)?.name || '')).filter(Boolean).join(' › ')}.`, ids: [chain.id], from: chain }
  const [weapon] = tally(rolls, r => techsOf(r, 'caughtBy').map(t => t.id))
  if (weapon && weapon[1].length >= 2) return { text: `Have an answer ready for the ${lower(techById(weapon[0]).name)}: it got you in ${weapon[1].length} of ${plural(rolls.length, 'roll')}.`, ids: weapon[1], from: rolls.find(r => r.id === weapon[1][0]) }
  return null
}

// The brief line a drilldown asked for: k is a line key, or 'plan'.
export function briefLine(o, k) {
  const b = scout(o)
  return k === 'plan' ? b.plan : Object.values(b.lines).flat().find(l => l.k === k) || null
}
