// The character: an avatar that levels up as you train, with daily quests, a weekly boss and a shop.
// XP, levels, quests and tokens earned are all read from the journal, so they can't drift and they
// come back with a backup. Only your choices are saved, in settings.game: name and look, what you
// bought and wear, story chapters you started, self-report quests and streak freezes used.
import { S, cached, save } from './store.js'
import { MOVE_GROUPS } from './catalog.js'
import { allTechs, landedIds, masteryOf, techById } from './model.js'
import { activeOn } from './body.js'
import { computeAchievements } from './achievements.js'
import { liveRollSeqs } from './loop.js'
import { distIn, distUnit, isRun } from './load.js'
import { isoDate, parseD, sum, today, weekStart } from './util.js'

export const game = () => ({ name: '', skin: 0, hair: 0, owned: {}, equipped: {}, spent: 0, frozen: [], self: {}, story: {}, ...S.settings.game })
export const saveGame = patch => save({ ...S.settings, game: { ...game(), ...patch } })

// ---------- What happened each day ----------

const NONE = { sessions: [], rolls: [], acts: [], study: [], sim: [], scenarios: 0 }
const RECOVERY = ['Yoga', 'Mobility / stretching', 'Recovery']
const STRETCH = ['Yoga', 'Mobility / stretching']
const STRENGTH = ['Strength training', 'Conditioning']
const CARDIO = ['Running', 'Conditioning', 'Cycling', 'Swimming']
const OFFENSE = MOVE_GROUPS.Offensive
// Running is swapped out while any of these is injured.
const LEGS = ['Knee', 'Ankle / foot', 'Hip', 'Lower back']

const days = () => cached('gameDays', () => {
  const map = {}
  const day = d => map[d] ||= { sessions: [], rolls: [], acts: [], study: [], sim: [], scenarios: 0 }
  S.session.forEach(s => day(s.date).sessions.push(s))
  S.roll.forEach(r => day(r.date).rolls.push(r))
  S.activity.forEach(a => day(a.date).acts.push(a))
  S.study.forEach(v => day(v.date).study.push(v))
  ;(S.settings.simLog || []).forEach(r => day(r.date).sim.push(r))
  ;(S.settings.scenarioLog || []).forEach(a => day(a.date).scenarios++)
  Object.keys(game().self).forEach(day)
  return map
})
const on = date => days()[date] || NONE

const offenseLanded = d => d.rolls.reduce((n, r) => n + landedIds(r).filter(id => OFFENSE.includes(techById(id)?.type)).length, 0)
const runDist = d => sum(d.acts.filter(isRun), a => distIn(a, distUnit()))
const minutesOf = (d, types) => sum(d.acts.filter(a => types.includes(a.type)), 'minutes')
// A day off the mat that you still moved: a run, a ride, yoga or mobility. Rest days never count against you.
const activeRest = d => !d.sessions.length && d.acts.length > 0

// The first day you did each kind of thing. A quest is only offered once you've done its kind before.
const firsts = () => cached('gameFirsts', () => {
  const first = {}, dates = Object.keys(days()).sort()
  const mark = (k, test) => { first[k] = dates.find(d => test(on(d))) || '' }
  mark('roll', d => d.rolls.length)
  mark('landed', d => d.rolls.some(r => landedIds(r).length))
  mark('run', d => d.acts.some(isRun))
  mark('strength', d => d.acts.some(a => STRENGTH.includes(a.type)))
  mark('other', d => d.acts.some(a => !isRun(a)))
  mark('sim', d => d.sim.length)
  mark('plan', d => d.sessions.some(s => s.plan))
  mark('scenario', d => d.scenarios)
  first.start = dates[0] || ''
  return first
})
export const legsHurt = date => activeOn(date).some(i => LEGS.includes(i.bodyPart))
const before = date => ({ ...Object.fromEntries(Object.entries(firsts()).map(([k, d]) => [k, !!d && d < date])), legs: legsHurt(date) })

// ---------- Daily quests ----------

// Three a day: one for the mat, one for the mind, one for the body. On a day with a moderate or
// severe injury only "safe" and "hurt" quests are offered; "hurt" ones only then. "legs" quests
// sit out while a knee, ankle, hip or lower back is injured. "self" quests are checked off by you.
export const runGoal = () => distUnit() === 'km' ? 2 : 1.5
export const QUESTS = {
  class: { slot: 'mat', text: 'Log today’s class', xp: 20, tokens: 10, done: d => d.sessions.length > 0 },
  roll: { slot: 'mat', text: 'Log a roll from today', xp: 15, tokens: 8, when: f => f.roll, done: d => d.rolls.length > 0 },
  land: { slot: 'mat', text: 'Land a move in a roll', xp: 15, tokens: 10, when: f => f.roll, done: d => d.rolls.some(r => landedIds(r).length) },
  offense: { slot: 'mat', text: 'Land a sweep, pass, takedown or submission', xp: 20, tokens: 12, when: f => f.landed, done: d => offenseLanded(d) > 0 },
  focus: { slot: 'mat', text: () => `Land your focus move: ${techById(S.settings.weekFocus.techId).name}`, xp: 25, tokens: 15,
    when: (f, date) => { const w = S.settings.weekFocus; return w?.techId && techById(w.techId) && date >= w.set && date <= isoDate(new Date(parseD(w.set).getTime() + 13 * 864e5)) },
    done: d => d.rolls.some(r => landedIds(r).includes(S.settings.weekFocus?.techId)) },
  drill: { slot: 'mat', text: 'Drill a move or log reps', xp: 15, tokens: 8, done: d => d.sessions.some(s => s.drilled?.length || s.reps?.length) },
  seqdrill: { slot: 'mat', text: 'Drill a move from one of your sequences', xp: 15, tokens: 10, when: () => S.seq.length,
    done: d => { const ids = new Set(S.seq.flatMap(s => s.nodes.map(n => n.techId))); return d.sessions.some(s => [...(s.drilled || []), ...(s.reps || []).map(r => r.techId)].some(id => ids.has(id))) } },
  coach: { slot: 'mat', text: 'Write a question for your coach', xp: 10, tokens: 6, done: d => d.sessions.some(s => s.coachQ) },
  plan: { slot: 'mat', text: 'Stick to your session plan', xp: 15, tokens: 10, when: f => f.plan, done: d => d.sessions.some(s => s.planHit === 'Stuck to it') },
  show: { slot: 'mat', hurt: true, text: 'Show up: log any session, even drilling or watching', xp: 15, tokens: 10, done: d => d.sessions.length > 0 },
  watch: { slot: 'mat', hurt: true, self: true, text: 'Watch a class or a match and note one detail', xp: 10, tokens: 6 },
  scenario: { slot: 'mind', safe: true, text: 'Think through a scenario in Study', xp: 15, tokens: 8, when: f => f.roll, done: d => d.scenarios > 0 },
  study: { slot: 'mind', safe: true, text: 'Study a video or add a study note', xp: 10, tokens: 6, done: d => d.study.length > 0 },
  sim: { slot: 'mind', safe: true, text: 'Play a Live roll', xp: 8, tokens: 5, done: d => d.sim.length > 0 },
  win: { slot: 'mind', safe: true, text: 'Win a Live roll', xp: 12, tokens: 8, when: f => f.sim, done: d => d.sim.some(r => r.result === 'win') },
  reflect: { slot: 'mind', text: 'Answer the reflection prompt when you log', xp: 10, tokens: 6, done: d => d.sessions.some(s => s.reflectA) },
  visualize: { slot: 'mind', safe: true, self: true, text: 'Visualize your A-game for 5 minutes', xp: 8, tokens: 5 },
  run: { slot: 'body', legs: true, text: () => `Run ${runGoal()} ${distUnit()}`, xp: 15, tokens: 10, when: f => f.run, done: d => runDist(d) >= runGoal() - 0.01 },
  double: { slot: 'body', legs: true, text: 'Run and train on the same day', xp: 30, tokens: 18, when: f => f.run, done: d => d.sessions.length && d.acts.some(isRun) },
  move: { slot: 'body', text: 'Get 20 minutes of other training', xp: 12, tokens: 8, done: d => sum(d.acts, 'minutes') >= 20 },
  strength: { slot: 'body', text: 'Log a strength session', xp: 15, tokens: 10, when: f => f.strength, done: d => d.acts.some(a => STRENGTH.includes(a.type)) },
  upper: { slot: 'body', safe: true, text: 'Upper-body or core strength, 15 minutes', xp: 15, tokens: 10, when: f => f.legs, done: d => minutesOf(d, STRENGTH) >= 15 },
  mobility: { slot: 'body', safe: true, text: 'Mobility, yoga or recovery, 15 minutes', xp: 10, tokens: 6, done: d => minutesOf(d, RECOVERY) >= 15 },
  restday: { slot: 'body', safe: true, text: 'Recovery day: log stretching or yoga', xp: 12, tokens: 8, when: f => f.other, done: d => d.acts.some(a => STRETCH.includes(a.type)) },
  rehab: { slot: 'body', hurt: true, self: true, text: 'Do your rehab or recovery routine', xp: 10, tokens: 6 },
}
export const SLOTS = ['mat', 'mind', 'body']

const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
export const hurtOn = date => activeOn(date).some(i => (i.severity || 1) >= 2)

// The same day always gets the same three quests.
export function questsOn(date) {
  const f = before(date), hurt = hurtOn(date), self = game().self[date] || []
  return SLOTS.map(slot => {
    const pool = Object.entries(QUESTS).filter(([, q]) => q.slot === slot && (hurt ? q.safe || q.hurt : !q.hurt) && !(q.legs && f.legs) && (!q.when || q.when(f, date)))
    const [id, q] = pool[hash(date + slot) % pool.length]
    return { id, ...q, text: typeof q.text === 'function' ? q.text() : q.text, done: q.self ? self.includes(id) : !!q.done(on(date)) }
  })
}

// ---------- Weekly boss ----------

// target is your weekly session target. Parts are [label, have, need].
export const ironGoal = () => distUnit() === 'km' ? 10 : 6
const BOSSES = [
  { name: 'The Gatekeeper', when: f => f.landed, parts: (w, t) => [['Sessions', w.sessions, t], ['Offensive moves landed', w.offense, 5]] },
  { name: 'The Long Grind', parts: w => [['Hours of training', Math.floor(w.minutes / 6) / 10, 4]] },
  { name: 'The Tactician', when: f => f.scenario, parts: (w, t) => [['Scenarios thought through', w.scenarios, 3], ['Sessions', w.sessions, Math.max(1, t - 1)]] },
  { name: 'The Collector', when: f => f.landed, parts: (w, t) => [['Different moves landed', w.distinct, 3], ['Sessions', w.sessions, Math.max(1, t - 1)]] },
  { name: 'Iron Lungs', legs: true, when: f => f.run, parts: w => [[`${distUnit()} run`, Math.floor(w.dist * 10) / 10, ironGoal()], ['Classes', w.sessions, 2]] },
  { name: 'Cardio Week', legs: true, when: f => f.run, parts: w => [['Days with a run, class or cardio', w.cardioDays, 5]] },
  { name: 'The Cross-Trainer', when: f => f.other, parts: (w, t) => [['Other training sessions', w.other, 2], ['Classes', w.sessions, Math.max(1, t - 1)]] },
]
const RECOVERY_BOSS = { name: 'The Long Recovery', parts: w => [['Recovery days: mobility, scenarios or study', w.recoveryDays, 3]] }
export const BOSS_REWARD = { xp: 100, tokens: 40 }

function bossOf(from, dates, hurt, legs) {
  const ds = dates.map(on), rolls = ds.flatMap(d => d.rolls)
  const w = {
    sessions: sum(ds, d => d.sessions.length), offense: sum(ds, offenseLanded), scenarios: sum(ds, 'scenarios'),
    minutes: sum(ds, d => sum(d.sessions, 'minutes') + sum(d.acts, 'minutes')),
    distinct: new Set(rolls.flatMap(landedIds)).size, dist: sum(ds, runDist),
    other: sum(ds, d => d.acts.filter(a => !isRun(a)).length),
    cardioDays: ds.filter(d => d.sessions.length || d.acts.some(a => CARDIO.includes(a.type))).length,
    recoveryDays: ds.filter(d => d.scenarios || d.study.length || d.acts.some(a => RECOVERY.includes(a.type))).length,
  }
  const f = before(from), pool = BOSSES.filter(b => (!b.when || b.when(f)) && !(b.legs && legs))
  const b = hurt ? RECOVERY_BOSS : pool[hash(from + 'boss') % pool.length]
  const parts = b.parts(w, S.settings.weeklyTarget || 3)
  return { name: b.name, parts, done: parts.every(([, have, need]) => have >= need), hurt }
}

// ---------- The whole run: every week since your first entry ----------

// A week keeps your streak when you finish 4 daily quests or beat the boss. Weeks with a moderate
// or severe injury, and weeks you spend a streak freeze on, never break it. Neither does a rest week
// you haven't finished yet. Each week in the streak adds 10% to tokens, up to +50%, and 2 or more
// active rest days in a week (moving on a day off the mat) add another 10%.
export const KEEP_QUESTS = 4
export const ACTIVE_REST_DAYS = 2
const weekKey = d => isoDate(weekStart(d))

export const run = () => cached('gameRun', () => {
  const now = today(), start = firsts().start || now, G = game(), weeks = []
  let xp = 0, tokens = 0, streak = 0
  for (let w = weekStart(parseD(start)); isoDate(w) <= now; w.setDate(w.getDate() + 7)) {
    const from = isoDate(w), dates = Array.from({ length: 7 }, (_, i) => isoDate(new Date(w.getFullYear(), w.getMonth(), w.getDate() + i))).filter(d => d >= start && d <= now)
    const daily = dates.map(questsOn), done = daily.flat().filter(q => q.done)
    const hurt = dates.some(hurtOn), boss = bossOf(from, dates, hurt, dates.some(legsHurt))
    const rest = dates.filter(d => activeRest(on(d))).length, mult = (1 + 0.1 * Math.min(streak, 5)) * (rest >= ACTIVE_REST_DAYS ? 1.1 : 1)
    const allThree = daily.filter(q => q.every(x => x.done)).length
    const earned = Math.round((sum(done, 'tokens') + 5 * allThree + (boss.done ? BOSS_REWARD.tokens : 0)) * mult)
    xp += sum(done, 'xp') + (boss.done ? BOSS_REWARD.xp : 0)
    tokens += earned
    const kept = done.length >= KEEP_QUESTS || boss.done, current = from === weekKey(new Date())
    const frozen = G.frozen.includes(from)
    if (kept) streak++
    else if (!hurt && !frozen && !current) streak = 0
    weeks.push({ from, done: done.length, boss, kept, hurt, frozen, rest, mult, earned })
  }
  return { weeks, xp, tokens, streak }
})

// Last week missed the mark with no injury: a freeze can save the streak, if you have one.
export function freezeOffer() {
  const weeks = run().weeks, last = weeks.at(-2)
  if (!last || last.kept || last.hurt || last.frozen || freezesLeft() < 1) return null
  const prev = weeks.slice(0, -2).reverse().find(w => !w.hurt)
  return prev?.kept || prev?.frozen ? last.from : null
}
export const freezesLeft = () => (game().owned.freeze || 0) - game().frozen.length

// ---------- XP ----------

// Every row is [what, XP each, how many]. Change the numbers here to tune the game.
export const xpBreakdown = () => cached('xpBreakdown', () => {
  const runs = S.activity.filter(isRun), other = S.activity.filter(a => !isRun(a))
  const reps = sum(S.session.flatMap(s => s.reps || []), r => Math.min(10, Math.floor((+r.count || 0) / 10)))
  const sim = S.settings.simLog || [], planned = S.session.filter(s => s.planHit)
  const reviewed = new Set([...(S.settings.reviewedWeeks || []), S.settings.reviewedWeek].filter(Boolean))
  const mastery = sum(allTechs().filter(t => t.type !== 'Movement'), t => masteryOf(t).level)
  const rows = [
    ['Sessions logged', 20, S.session.length],
    ['Mat time, per 10 minutes', 1, Math.floor(sum(S.session, 'minutes') / 10)],
    ['Rolls logged', 5, S.roll.length],
    ['Moves landed in rolls', 4, sum(S.roll, r => landedIds(r).length)],
    ['Mastery levels gained', 15, mastery],
    ['Scenarios thought through', 5, (S.settings.scenarioLog || []).length],
    ['Moves drilled', 3, sum(S.session, s => (s.drilled || []).length)],
    ['Reps, per 10', 1, reps],
    ['Runs', 10, runs.length],
    ['Run distance, per km', 3, Math.round(sum(runs, r => distIn(r, 'km')))],
    ['Other training', 8, other.length],
    ['Other training, per 10 minutes', 1, Math.floor(sum(other, 'minutes') / 10)],
    ['Active rest days: moving on a day off the mat', 5, Object.values(days()).filter(activeRest).length],
    ['Study notes and videos', 8, S.study.length],
    ['Sequences', 10, S.seq.length],
    ['Sequence steps', 2, sum(S.seq, s => s.nodes.length)],
    ['Live rolls played', 2, sim.length],
    ['Live rolls won', 6, sim.filter(r => r.result === 'win').length],
    ['Weekly reviews done', 30, reviewed.size],
    ['Plans stuck to', 15, planned.filter(s => s.planHit === 'Stuck to it').length],
    ['Plans partly kept', 8, planned.filter(s => s.planHit === 'Partly').length],
    ['Achievements unlocked', 25, computeAchievements().filter(a => a.unlockedOn).length],
    ['Tournaments entered', 50, S.profile.tournaments.length],
    ['Competition wins', 10, sum(S.profile.tournaments, 'wins')],
    ['Promotions', 100, S.profile.promotions.length],
  ]
  return [...rows.map(([what, each, n]) => ({ what, each, n, xp: each * n })), { what: 'Quests and bosses', each: null, n: null, xp: run().xp }]
})
export const totalXp = () => sum(xpBreakdown(), 'xp')

// Level 2 at 60 XP, 5 at 550, 10 at about 2,000, 20 at 6,700, 30 at 13,000.
// Early levels come in a session or two; later ones take weeks.
export const xpFor = level => Math.round(60 * Math.pow(level - 1, 1.6))
export function levelOf(xp = totalXp()) {
  let level = 1
  while (level < 99 && xp >= xpFor(level + 1)) level++
  const from = xpFor(level), to = xpFor(level + 1)
  return { level, xp, into: xp - from, need: to - from, pct: level >= 99 ? 1 : (xp - from) / (to - from) }
}

// ---------- Stats and archetype ----------

// Each stat is 1 + √(2 × points), so the first points count most. Capped at 99.
const statOf = points => Math.min(99, 1 + Math.floor(Math.sqrt(2 * Math.max(0, points))))
export const stats = () => cached('gameStats', () => {
  const acts = S.activity, sim = S.settings.simLog || []
  const hours = list => sum(list, 'minutes') / 60
  const healed = S.injury.filter(i => i.endDate)
  const returned = healed.filter(i => S.session.some(s => s.date > i.endDate && s.date <= isoDate(new Date(parseD(i.endDate).getTime() + 30 * 864e5)))).length
  const points = {
    Technique: sum(allTechs().filter(t => t.type !== 'Movement'), t => masteryOf(t).level) + (S.settings.scenarioLog || []).length / 2 + sum(S.session, s => (s.drilled || []).length) / 2,
    Cardio: sum(acts.filter(isRun), r => distIn(r, 'km')) + 2 * acts.filter(a => isRun(a) && activeRest(on(a.date))).length + hours(S.session) + hours(acts.filter(a => ['Conditioning', 'Cycling', 'Swimming'].includes(a.type))),
    Strength: 2 * acts.filter(a => STRENGTH.includes(a.type)).length + sum(acts.filter(a => STRENGTH.includes(a.type)), 'minutes') / 30,
    Strategy: sum(S.seq, s => s.nodes.length) + 3 * liveRollSeqs().length + 2 * sim.filter(r => r.result === 'win').length + 3 * sum(S.profile.tournaments, 'wins'),
    Resilience: 2 * S.session.filter(s => s.injuryIds?.length).length + 5 * healed.length + 5 * returned + acts.filter(a => RECOVERY.includes(a.type)).length,
  }
  return Object.entries(points).map(([name, p]) => ({ name, value: statOf(p) }))
})
export const STAT_HINTS = {
  Technique: 'Mastery levels, scenario reviews and drilling',
  Cardio: 'Run distance, mat hours and conditioning. Runs on days off the mat count extra',
  Strength: 'Strength and conditioning sessions',
  Strategy: 'Sequence steps, Live roll wins, saved chains and competition wins',
  Resilience: 'Training around injuries, healing them and coming back',
}

// Your style follows the moves you actually land, by type.
const ARCHETYPES = [
  ['Guard player', ['Sweep', 'Retention'], 'Sweeps and guard retention'],
  ['Passer', ['Pass'], 'Guard passes'],
  ['Wrestler', ['Takedown'], 'Takedowns'],
  ['Submission hunter', ['Submission'], 'Submissions'],
  ['Escape artist', ['Escape'], 'Escapes'],
  ['Pressure rider', ['Control', 'Transition'], 'Top control and transitions'],
]
export const archetype = () => cached('archetype', () => {
  const counts = {}
  S.roll.forEach(r => landedIds(r).forEach(id => { const t = techById(id); if (t) counts[t.type] = (counts[t.type] || 0) + 1 }))
  const total = sum(Object.values(counts), x => x)
  if (total < 5) return { name: 'Fresh recruit', why: `Land ${5 - total} more ${total === 4 ? 'move' : 'moves'} in your rolls to find your style.` }
  const ranked = ARCHETYPES.map(([name, types, what]) => ({ name, what, share: sum(types, t => counts[t] || 0) / total })).sort((a, b) => b.share - a.share)
  if (ranked[0].share < 0.3) return { name: 'All-rounder', why: 'No one kind of move is more than 30% of what you land.' }
  return { name: ranked[0].name, why: `${ranked[0].what}: ${Math.round(ranked[0].share * 100)}% of the ${total} moves you’ve landed.` }
})

// ---------- Story: The Open Mat Chronicles ----------

// A chapter opens at its level once the one before is done. Its objective counts from the day you start it.
const since = (from, list) => list.filter(x => x.date >= from)
const outbreakGoal = () => distUnit() === 'km' ? 3 : 2
export const CHAPTERS = [
  { id: 'c1', level: 1, title: 'The Empty Mat', tokens: 20, need: 1, what: 'Log a training session',
    text: 'The gym is quiet. A worn white belt hangs on a hook by the door, and a coach you haven’t met yet nods at the mat. Step on.',
    have: from => since(from, S.session).length },
  { id: 'c2', level: 3, title: 'Rumors of the Open Mat', tokens: 30, need: 2, what: 'Log 2 rolls',
    text: 'Word is there’s a Saturday open mat where the real rounds happen. Nobody gets an invite. You earn it by showing you can roll and learn from it.',
    have: from => since(from, S.roll).length },
  { id: 'c3', level: 5, title: 'The Gatekeeper', tokens: 40, need: 1, what: 'Land a sweep or a pass in a roll',
    text: 'A purple belt named Ana guards the open mat. She doesn’t care how hard you go. She wants to see you change position on purpose.',
    have: from => sum(since(from, S.roll), r => landedIds(r).filter(id => ['Sweep', 'Pass'].includes(techById(id)?.type)).length) },
  { id: 'c4', level: 7, title: 'Hidden Scrolls', tokens: 40, need: 3, what: 'Think through 3 scenarios in Study',
    text: 'Ana hands you a notebook of rounds that went wrong, each with a question in the margin. “Everyone gets stuck. The good ones think it through.”',
    have: from => (S.settings.scenarioLog || []).filter(a => a.date >= from).length },
  { id: 'c5', level: 10, title: 'The Long Road', tokens: 50, need: 3, what: 'Run or do other training 3 times',
    text: 'Round six, and your arms are concrete. The old-timers say gas tanks aren’t built on the mat alone. You lace up your shoes.',
    have: from => since(from, S.activity).length },
  { id: 'c10', level: 11, title: 'The Outbreak', tokens: 60, need: 1, get what() { return `Escape run: ${outbreakGoal()} ${distUnit()} in one go, or 30 minutes of any cardio` },
    text: 'Sirens across town. Something is shambling down the alley behind the gym, and it is not a late white belt. Coach throws you the keys: get to the old mill and back.',
    have: from => since(from, S.activity).filter(a => isRun(a) && distIn(a, distUnit()) >= outbreakGoal() - 0.01 || ['Running', 'Conditioning', 'Cycling', 'Swimming'].includes(a.type) && +a.minutes >= 30).length },
  { id: 'c6', level: 13, title: 'The Mirror Match', tokens: 50, need: 2, what: 'Win 2 Live rolls',
    text: 'Late at night you replay rounds in your head, choosing differently each time. The shadow across from you knows all your habits.',
    have: from => (S.settings.simLog || []).filter(r => r.date >= from && r.result === 'win').length },
  { id: 'c7', level: 16, title: 'Chains of the Old Masters', tokens: 60, need: 3, what: 'Land 3 different submissions',
    text: 'A visiting black belt never fights for one finish. Each defense opens the next attack. You start to see the links.',
    have: from => new Set(since(from, S.roll).flatMap(r => landedIds(r).filter(id => techById(id)?.type === 'Submission'))).size },
  { id: 'c8', level: 20, title: 'The Open Mat', tokens: 80, need: 6, what: 'Train 6 sessions',
    text: 'Saturday. The door’s open and Ana nods you in. Nobody announces anything. You just keep showing up, and the rounds get better.',
    have: from => since(from, S.session).length },
  { id: 'c9', level: 25, title: 'Coloured Cloth', tokens: 100, need: 1, what: 'Earn your next stripe or belt',
    text: 'Your coach stops you after class with a roll of tape. It isn’t about the tape. It’s about every round that came before it.',
    have: from => S.profile.promotions.filter(p => p.date >= from).length },
]

export const story = () => cached('gameStory', () => {
  const started = game().story, level = levelOf().level
  let open = true
  return CHAPTERS.map(c => {
    const from = started[c.id], have = from ? Math.min(c.need, c.have(from)) : 0
    const state = !open || level < c.level ? 'locked' : !from ? 'ready' : have >= c.need ? 'done' : 'active'
    open = state === 'done'
    return { ...c, from, have, state }
  })
})

// ---------- Tokens and the shop ----------

export const LEVEL_TOKENS = 10
export const tokensEarned = () => run().tokens + LEVEL_TOKENS * (levelOf().level - 1) + sum(story().filter(c => c.state === 'done'), 'tokens')
export const balance = () => Math.max(0, tokensEarned() - game().spent)

// Some things can't be bought: they unlock from the story, achievements, running or your level.
const storyDone = id => story().find(c => c.id === id)?.state === 'done'
const mountainGoal = () => distUnit() === 'km' ? 25 : 15
const unlock = (text, test) => ({ text, test })

// Cosmetics are worn in a slot. Abilities are perks in Live roll and for your streak; none of them
// changes your journal. A consumable can be bought more than once, up to max held at a time.
// tier is just for show: common, rare, epic, legendary.
export const SHOP = {
  'gi-white': { slot: 'kit', name: 'White gi', price: 0, color: '#F3F2EC', desc: 'The classic. Shows every bit of mat you rolled on.' },
  'gi-blue': { slot: 'kit', name: 'Blue gi', price: 60, color: '#2B5DAE', desc: 'Calm, professional, slightly intimidating.' },
  'gi-black': { slot: 'kit', name: 'Black gi', price: 90, color: '#202328', desc: 'Hides the sweat. Not the effort.' },
  'rash-plain': { slot: 'kit', name: 'Ranked rash guard', price: 0, nogi: true, color: '#2A2F36', desc: 'Your rank, stitched across the chest.' },
  'rash-neon': { slot: 'kit', name: 'Neon rash guard', price: 70, nogi: true, color: '#0E7490', trim: '#22D3EE', desc: 'Glows a little brighter every round.' },
  'rash-magenta': { slot: 'kit', name: 'Magenta rash guard', price: 70, nogi: true, color: '#3B0F45', trim: '#E879F9', desc: 'Visible from the back of the gym.' },
  'gi-ezekiel': { slot: 'kit', name: 'Ezekiel Sleeves', tier: 'rare', price: 110, color: '#F3F2EC', sleeve: '#1F4FA0', desc: 'Sleeves so good you can choke from the bottom of mount.' },
  'gi-shinobi': { slot: 'kit', name: 'Shinobi gi', tier: 'rare', price: 140, color: '#25272D', trim: '#4B5563', desc: 'Silent sweeps. Even quieter taps.' },
  'gi-kimura': { slot: 'kit', name: 'Kimura Kimono', tier: 'rare', price: 160, color: '#8E1B1B', trim: '#E8B64C', desc: 'Wraps you up like a figure-four, in silk.' },
  'rash-hoodie': { slot: 'kit', name: 'Heel Hook Hoodie', tier: 'epic', price: 200, nogi: true, hood: true, color: '#3F4A5A', trim: '#E879F9', desc: 'Cosy until someone grabs your heel. Rip responsibly.' },
  'gi-trench': { slot: 'kit', name: 'Triangle Trench Coat', tier: 'epic', price: 220, long: true, color: '#A47B4F', trim: '#6E4F2E', desc: 'Three sides, one belt, zero escape routes.' },
  'gi-armbar': { slot: 'kit', name: 'Armbar Armor', tier: 'epic', price: 280, level: 12, plated: true, color: '#9AA3AD', trim: '#5D6670', desc: 'Hyperextension-proof. Elbows sold separately.' },
  'gi-gold': { slot: 'kit', name: 'Golden gi', tier: 'legendary', price: 0, color: '#E0B84A', trim: '#9A7A1F', unlock: unlock(() => 'Reach level 30', () => levelOf().level >= 30), desc: 'Thirty levels of showing up, woven in gold.' },

  'band-red': { slot: 'band', name: 'Red headband', price: 35, color: '#C9333A', desc: 'Adds 10% fighting spirit. Not measurable.' },
  'band-neon': { slot: 'band', name: 'Neon headband', price: 50, color: '#22D3EE', desc: 'Keeps the sweat out and the vibes in.' },
  'band-ninja': { slot: 'band', name: '“Ninja Choke” headband', tier: 'common', price: 60, color: '#1B1B1B', plate: true, desc: 'Not an official choke. Still gets taps in the locker room.' },
  'band-berimbolo': { slot: 'band', name: 'Berimbolo Bandana', tier: 'rare', price: 90, color: '#EA7A1A', bandana: true, desc: 'Spins on its own. Somehow ends up on your back.' },
  'hood-shadow': { slot: 'band', name: 'Shadow hood', tier: 'rare', price: 120, color: '#1E2026', hood: true, desc: 'For 6 a.m. classes nobody saw you sneak into.' },
  'band-gold': { slot: 'band', name: 'Champion’s headband', tier: 'epic', price: 0, color: '#E0B84A', unlock: unlock(() => 'Unlock 15 achievements', () => computeAchievements().filter(a => a.unlockedOn).length >= 15), desc: 'Earned, not bought. Fifteen achievements deep.' },
  'crown-triangle': { slot: 'band', name: 'Mounted Triangle Crown', tier: 'legendary', price: 0, crown: true, unlock: unlock(() => 'Finish chapter 8 of the story', () => storyDone('c7')), desc: 'Heavy is the head that sits on top of another head.' },

  'mask-shadow': { slot: 'face', name: 'Shadow mask', tier: 'common', price: 70, desc: 'Breathe through your nose. Ninjas never mouth-breathe.' },
  'goggles-gogo': { slot: 'face', name: 'Gogoplata Goggles', tier: 'rare', price: 120, desc: 'See the world from the wrong side of your own shin.' },
  'specs-xray': { slot: 'face', name: 'X-Guard X-ray Specs', tier: 'rare', price: 130, desc: 'See right through their base.' },

  'patch-star': { slot: 'patch', name: 'Star patch', price: 30, desc: 'Gold star for showing up. You did.' },
  'patch-bolt': { slot: 'patch', name: 'Lightning patch', price: 40, desc: 'Fast hips, faster scrambles.' },
  'patch-wave': { slot: 'patch', name: 'Wave patch', price: 40, desc: 'Flow rolling, but make it fashion.' },
  'patch-kunai': { slot: 'patch', name: 'Kunai patch', tier: 'common', price: 45, desc: 'Sharp details. No actual blades on the mat, please.' },
  'patch-omoplata': { slot: 'patch', name: 'Omoplata Plate', tier: 'rare', price: 100, desc: 'A shoulder lock deserves shoulder armor.' },

  'cape-torero': { slot: 'back', name: 'Toreando Torero Cape', tier: 'epic', price: 200, desc: 'Olé! Their legs go one way, you go the other.' },
  'held-duck': { slot: 'held', name: 'Rubber Guard Duck', tier: 'common', price: 60, desc: 'Squeaks every time you break their posture.' },
  'held-lasso': { slot: 'held', name: 'Lasso Guard lasso', tier: 'rare', price: 90, desc: 'Yee-haw-plata.' },
  'feet-tabi': { slot: 'feet', name: 'Tabi socks', tier: 'common', price: 50, desc: 'Split toes for split-second footwork. Off the mat only.' },

  'aura-calm': { slot: 'aura', name: 'Calm aura', price: 150, level: 10, color: '#22D3EE', desc: 'Breathe. Frame. Recover guard. Repeat.' },
  'aura-fire': { slot: 'aura', name: 'Fire aura', price: 250, level: 20, color: '#F97316', desc: 'For when the warm-up is not the hard part.' },
  'aura-smoke': { slot: 'aura', name: 'Smoke-bomb aura', tier: 'rare', price: 160, desc: 'Poof. Where did your guard pass go? Exactly.' },
  'aura-spider': { slot: 'aura', name: 'Spider Guard web', tier: 'epic', price: 200, level: 8, desc: 'Sleeves caught, posture tangled, everyone stuck.' },
  'aura-darce': { slot: 'aura', name: 'The D’arce Side', tier: 'epic', price: 240, level: 12, color: '#7C3AED', desc: 'Come to the D’arce side. We have arm-in chokes.' },
  'aura-lungs': { slot: 'aura', name: 'Second Wind', tier: 'legendary', price: 0, color: '#4ADE80', unlock: unlock(() => 'Beat the Iron Lungs weekly boss', () => run().weeks.some(w => w.boss.name === 'Iron Lungs' && w.boss.done)), desc: 'The gas tank you built one run at a time.' },

  'pet-turtle': { slot: 'pet', name: 'Turtle Up', tier: 'common', price: 80, desc: 'Defensive specialist. Very hard to take the back of.' },
  'pet-worm': { slot: 'pet', name: 'Worm Guard', tier: 'rare', price: 100, desc: 'Lives in your lapel. Pays no rent.' },
  'pet-sloth': { slot: 'pet', name: 'Slow Roll the sloth', tier: 'rare', price: 120, desc: 'Never rushes. Never gasses. Somehow always on top.' },
  'pet-shark': { slot: 'pet', name: 'Shark Tank', tier: 'epic', price: 220, level: 10, desc: 'A fresh partner every minute, forever.' },

  'mat-tatami': { slot: 'mat', name: 'Tatami mat', price: 50, desc: 'Old-school mats. Smells faintly of history.' },
  'mat-dusk': { slot: 'mat', name: 'Dojo at dusk', tier: 'common', price: 70, desc: 'Last class of the day, gold light through the windows.' },
  'mat-night': { slot: 'mat', name: 'Night dojo', price: 80, level: 5, desc: 'Open mat under the stars.' },
  'mat-paper': { slot: 'mat', name: 'Paper Cutter dojo', tier: 'rare', price: 100, desc: 'Clean folds, sharp angles, one very tight choke.' },
  'mat-neon': { slot: 'mat', name: 'Neon arena', price: 120, level: 8, desc: 'Main event energy, every Tuesday.' },
  'mat-arcade': { slot: 'mat', name: 'Neon arcade', tier: 'epic', price: 160, level: 10, desc: 'Insert coin to continue the round.' },
  'mat-mountain': { slot: 'mat', name: 'Mountain gym', tier: 'epic', price: 0, unlock: unlock(() => `Run ${mountainGoal()} ${distUnit()} in total`, () => sum(S.activity.filter(isRun), r => distIn(r, distUnit())) >= mountainGoal()), desc: 'Thin air, big views. Earned on foot.' },

  'emote-oss': { slot: 'emote', name: '“Oss!”', tier: 'common', price: 30, say: 'Oss!', desc: 'Means yes, thanks, hello and I have no idea.' },
  'emote-again': { slot: 'emote', name: '“One more!”', tier: 'common', price: 40, say: 'One more!', desc: 'The two most dangerous words at open mat.' },
  'emote-shrimp': { slot: 'emote', name: '“Shrimp!”', tier: 'rare', price: 60, say: 'Shrimp!', desc: 'Hip escape is a lifestyle.' },

  reshuffle: { ability: true, name: 'Reshuffle', price: 80, level: 3, desc: 'Once per Live roll, swap your four options for a fresh set.' },
  scout: { ability: true, name: 'Scout', price: 120, level: 6, desc: 'Once per Live roll, see which options belong to your partner and which of yours is likeliest to land.' },
  freeze: { ability: true, name: 'Streak freeze', price: 50, max: 2, desc: 'Covers one missed week so your quest streak carries on. Hold up to 2.' },
}
export const SLOT_NAMES = { kit: 'Kit', band: 'Headwear', face: 'Face', patch: 'Patch', back: 'Back', held: 'In hand', feet: 'Feet', pet: 'Pet', aura: 'Aura', mat: 'Mat', emote: 'Emote' }
export const tierOf = it => it.tier || (it.price >= 150 ? 'epic' : it.price >= 80 ? 'rare' : 'common')

export const owns = id => { const it = SHOP[id]; return !!it && (it.unlock ? it.unlock.test() : !it.price || (game().owned[id] || 0) > 0) }
export const hasAbility = id => (game().owned[id] || 0) > 0
export function equipped() {
  const e = game().equipped, kit = e.kit && owns(e.kit) ? e.kit : S.profile.game === 'No-gi' ? 'rash-plain' : 'gi-white'
  return { ...Object.fromEntries(Object.entries(e).filter(([, id]) => id && owns(id))), kit }
}

// Why an item can't be bought right now, or '' when it can.
export function cantBuy(id) {
  const item = SHOP[id], have = game().owned[id] || 0
  if (item.unlock) return item.unlock.test() ? 'Unlocked' : item.unlock.text()
  if (!item.ability && have) return 'Owned'
  if (item.ability && !item.max && have) return 'Owned'
  if (item.max && have - (id === 'freeze' ? game().frozen.length : 0) >= item.max) return `Holding ${item.max}`
  if (item.level && levelOf().level < item.level) return `Level ${item.level}`
  if (balance() < item.price) return `${item.price - balance()} more tokens`
  return ''
}
