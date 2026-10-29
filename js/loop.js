// The learning loop: plan before class, review after the week, and know when to push or go light.
// Everything here is read from the journal you already keep; only your picks are saved, in settings.
import { S, cached } from './store.js'
import { ENERGY, SLEEP } from './vocab.js'
import { byDateDesc, daysAgo, fmtDate, isoDate, sum, today, topKeys, trunc, weekStart } from './util.js'
import { masteryOf, myTechs, rollMoves, seqById, techById } from './model.js'
import { badSpots, weakestStep } from './analysis.js'
import { activeInjuries, injuryName } from './body.js'
import { distIn, loadOf, loadWeeks, runs, runStats } from './load.js'
import { suggestedGame } from './rounds.js'

// ---------- Today's focus ----------

const LIVE_NOTE = /^From live roll on (\d{4}-\d\d-\d\d)/
const NEXT_STEP = ['Drill', 'Drill', 'Land', 'Land'], NEXT_WHERE = ['', '', ' in a live roll', ' in a live roll', ' on a higher belt']
const firstMove = seq => seq.nodes.find(n => n.who === 'me' && n.techId)?.techId || ''

// Sequences saved from Live roll carry a note with the date, on the sequence or on the steps added.
export const liveRollSeqs = () => S.seq.map(s => {
  const date = [s.notes, ...s.nodes.map(n => n.note)].map(x => LIVE_NOTE.exec(x || '')?.[1]).filter(Boolean).sort().pop()
  return date && { seq: s, date }
}).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date))

// What your log suggests working on, most specific first.
export const focusIdeas = () => cached('focusIdeas', () => {
  const list = []
  // A gap you picked on the Game plan, for two weeks.
  const gap = S.settings.gameFocus
  if (gap?.text && gap.set >= daysAgo(13)) list.push({ text: gap.text, techId: gap.techId || '', seqId: '', why: 'A gap in your game plan' })
  const live = liveRollSeqs()[0]
  if (live) list.push({ text: `Drill ${live.seq.name}`, techId: firstMove(live.seq), seqId: live.seq.id, why: 'Saved from Live roll' })
  // A positional round for your weakest spot: the cleanest way to get reps where you lose.
  const game = suggestedGame()
  if (game) list.push({ text: game.text, techId: '', seqId: '', why: game.why, game })
  const weak = weakestStep(daysAgo(59))
  if (weak) list.push({ text: `Fix ${weak.label} (${weak.seq})`, techId: seqById(weak.seqId)?.nodes.find(n => n.id === weak.nodeId)?.techId || '', seqId: weak.seqId, why: `Went wrong in ${weak.broke + weak.partial} of ${weak.n} rolls` })
  const spot = badSpots(daysAgo(59)).groups[0]
  if (spot) {
    const where = spot.position + (spot.role && spot.role !== 'Neutral' ? ', ' + spot.role.toLowerCase() : ''), cause = topKeys(spot.reasons, 1)[0]
    list.push({ text: `Work on ${where}${cause ? `: ${cause.toLowerCase()}` : ''}`, techId: '', seqId: '', why: `Your top problem spot, ${spot.n} breakdowns in 60 days` })
  }
  // A move you use that's one step from its next mastery level, the most used first. Solo drills don't count.
  const move = myTechs().filter(t => t.type !== 'Movement').map(t => ({ t, level: masteryOf(t).level })).find(x => x.level >= 1 && x.level < 4)
  if (move) list.push({ text: `${NEXT_STEP[move.level]} ${move.t.name}${NEXT_WHERE[move.level + 1]}`, techId: move.t.id, seqId: '', why: `Next mastery level for a move you use` })
  // The newest "Something to fix" from the last two weeks, so even a simple log gets a focus.
  const fix = recentNotes('struggled', 13)[0]
  if (fix) list.push({ text: `Work on: ${trunc(fix.struggled, 70)}`, techId: '', seqId: '', why: `Something to fix, from ${fmtDate(fix.date)}` })
  return list
})

// Sessions with a short "Something that worked" or "Something to fix" note, newest first.
export const recentNotes = (key, days) => S.session.filter(s => s.date >= daysAgo(days) && s[key] && s[key].length <= 140).sort(byDateDesc)

// Up to 3 things worth taking into your next class: this week's focus first, then the ideas above.
export const todaysFocus = () => cached('todaysFocus', () => {
  const wf = weekFocus(), seen = new Set()
  return [...(wf ? [{ ...wf, why: 'Your focus this week' }] : []), ...focusIdeas()].filter(f => !seen.has(f.text.toLowerCase()) && seen.add(f.text.toLowerCase())).slice(0, 3)
})

// The plan waiting for your next session log, if you picked one.
export const nextPlan = () => S.settings.nextPlan?.text ? S.settings.nextPlan : null

// ---------- Weekly review ----------

// Monday reviews the week that just ended; any other day, the week so far.
export function reviewWeek() {
  const back = new Date().getDay() === 1 ? 1 : 0, start = weekStart(new Date())
  start.setDate(start.getDate() - 7 * back)
  const end = new Date(start); end.setDate(end.getDate() + 6)
  return { from: isoDate(start), to: isoDate(end), back }
}

// Sunday and Monday, until that week's review is done.
export const reviewDue = () => [0, 1].includes(new Date().getDay()) && S.settings.reviewedWeek !== reviewWeek().from && (S.session.length + S.roll.length + S.round.length + S.activity.length > 0)

// The focus you picked in your last review, for two weeks after you picked it.
export const weekFocus = () => { const f = S.settings.weekFocus; return f?.text && f.set >= daysAgo(13) ? f : null }

export const weekReview = () => cached('weekReview', () => {
  const { from, to, back } = reviewWeek(), inWeek = x => x.date >= from && x.date <= to
  const weeks = loadWeeks(6), wk = weeks[5 - back], prior = weeks.slice(1 - back, 5 - back)
  const avg = sum(prior, 'total') / 4, unit = runStats().unit
  const sessions = S.session.filter(inWeek), rolls = S.roll.filter(inWeek), weekRuns = runs().filter(inWeek), games = S.round.filter(inWeek)
  const causes = {}
  rolls.filter(r => r.result !== 'worked').forEach(r => (r.reasons || []).forEach(x => causes[x] = (causes[x] || 0) + 1))
  const moves = rolls.flatMap(rollMoves).filter(m => techById(m.techId))
  const top = outcome => { const c = {}; moves.filter(m => m.outcome === outcome).forEach(m => c[m.techId] = (c[m.techId] || 0) + 1); return topKeys(c, 4).map(id => ({ tech: techById(id), n: c[id] })) }
  const planned = sessions.filter(s => s.plan && s.planHit)
  return {
    from, to, back,
    load: wk.total, avg, ratio: avg ? wk.total / avg : null, minutes: wk.minutes,
    sessions: sessions.length, target: S.settings.weeklyTarget || 3,
    runs: { n: weekRuns.length, dist: sum(weekRuns, r => distIn(r, unit)), unit },
    rounds: { n: games.length, tries: sum(games, 'tries'), wins: sum(games, 'wins'), losses: sum(games, 'losses') },
    rolls: { n: rolls.length, worked: rolls.filter(r => r.result === 'worked').length, partial: rolls.filter(r => r.result === 'partial').length, broke: rolls.filter(r => r.result === 'broke').length },
    causes: Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 3),
    landed: top('landed'), caught: top('caughtBy'),
    notes: sessions.filter(s => s.worked || s.struggled).sort(byDateDesc),
    plan: { n: planned.length, hit: sum(planned, s => s.planHit === 'Stuck to it' ? 1 : s.planHit === 'Partly' ? 0.5 : 0), unrated: sessions.filter(s => s.plan && !s.planHit).length },
  }
})

// Every coach question not yet answered, newest first. Asked ones stay until you note the answer.
export const openCoachQs = () => S.session.filter(s => s.coachQ && !s.coachAnswered).sort(byDateDesc)

// ---------- Readiness ----------

// Today's check-in if you did one, else the tags on your latest session from the last 3 days.
export function latestTags() {
  const c = S.settings.checkin
  if (c?.date === today()) return { sleep: c.sleep || '', energy: c.energy || '', from: 'check-in' }
  const s = [...S.session].filter(x => x.date >= daysAgo(2) && (x.sleep || x.energy)).sort(byDateDesc)[0]
  return s ? { sleep: s.sleep || '', energy: s.energy || '', from: 'last session' } : { sleep: '', energy: '', from: '' }
}

// A simple tally: good sleep, high energy and a lighter week push it up; poor sleep, low energy,
// injuries, a load spike and a big run yesterday pull it down. A severe injury always means go light.
// Fatigue doesn't care what kind of training it was, so load here always includes runs and other training.
export function readiness() {
  const tags = latestTags(), hurt = activeInjuries(), worst = Math.max(0, ...hurt.map(i => i.severity || 1))
  const w = loadWeeks(5), avg = sum(w.slice(0, 4), 'all') / 4, ratio = avg ? w[4].all / avg : null
  const runShare = w[4].all ? w[4].load[1] / w[4].all : 0, bigRun = runs().filter(r => r.date >= daysAgo(1) && loadOf(r) >= 300).at(-1)
  const why = []
  let score = 0
  const add = (n, text) => { score += n; why.push(text) }
  if (tags.sleep === 'poor') add(-1, 'poor sleep'); else if (tags.sleep === 'good') add(1, 'good sleep')
  if (tags.energy === 'low') add(-1, 'low energy'); else if (tags.energy === 'high') add(1, 'high energy')
  if (worst) add(-worst, `${hurt.length > 1 ? 'injuries' : injuryName(hurt[0]).toLowerCase()} active`)
  if (bigRun) add(-1, `big run ${bigRun.date === today() ? 'today' : 'yesterday'}`)
  const withRuns = runShare >= 0.25 ? ', runs included' : ''
  if (ratio != null && ratio > 1.4) add(-2, `load ${Math.round(ratio * 100)}% of your 4-week average${withRuns}`)
  else if (ratio != null && ratio > 1.15) add(-1, `load above your usual${withRuns}`)
  else if (ratio != null && ratio < 0.7 && avg > 0) add(1, `a light week so far`)
  const level = worst >= 3 || score <= -2 ? 'light' : score >= 2 ? 'push' : 'normal'
  return { level, label: { push: 'Push today', normal: 'Normal', light: 'Go light / drill day' }[level], why, tags, known: !!(tags.from || hurt.length || avg) }
}

export const TAG_LABELS = { sleep: SLEEP, energy: ENERGY }
