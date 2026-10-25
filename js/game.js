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

const NONE = { sessions: [], rolls: [], acts: [], study: [], sim: [], reviews: 0 }
const RECOVERY = ['Yoga', 'Mobility / stretching', 'Recovery']
const STRENGTH = ['Strength training', 'Conditioning']
const OFFENSE = MOVE_GROUPS.Offensive

const days = () => cached('gameDays', () => {
  const map = {}
  const day = d => map[d] ||= { sessions: [], rolls: [], acts: [], study: [], sim: [], reviews: 0 }
  S.session.forEach(s => day(s.date).sessions.push(s))
  S.roll.forEach(r => day(r.date).rolls.push(r))
  S.activity.forEach(a => day(a.date).acts.push(a))
  S.study.forEach(v => day(v.date).study.push(v))
  ;(S.settings.simLog || []).forEach(r => day(r.date).sim.push(r))
  ;(S.settings.reviewLog || []).forEach(d => day(d).reviews++)
  Object.keys(game().self).forEach(day)
  return map
})
const on = date => days()[date] || NONE

const offenseLanded = d => d.rolls.reduce((n, r) => n + landedIds(r).filter(id => OFFENSE.includes(techById(id)?.type)).length, 0)
const kmOn = d => sum(d.acts.filter(isRun), a => distIn(a, 'km'))

// The first day you did each kind of thing. A quest is only offered once you've done its kind before.
const firsts = () => cached('gameFirsts', () => {
  const first = {}, dates = Object.keys(days()).sort()
  const mark = (k, test) => { first[k] = dates.find(d => test(on(d))) || '' }
  mark('roll', d => d.rolls.length)
  mark('landed', d => d.rolls.some(r => landedIds(r).length))
  mark('run', d => d.acts.some(isRun))
  mark('strength', d => d.acts.some(a => STRENGTH.includes(a.type)))
  mark('sim', d => d.sim.length)
  mark('plan', d => d.sessions.some(s => s.plan))
  mark('review', d => d.reviews)
  first.start = dates[0] || ''
  return first
})
const before = date => { const f = firsts(); return Object.fromEntries(Object.entries(f).map(([k, d]) => [k, !!d && d < date])) }

// ---------- Daily quests ----------

// Three a day: one for the mat, one for the mind, one for the body. On a day with a moderate or
// severe injury only "safe" and "hurt" quests are offered; "hurt" ones only then. "self" quests are
// checked off by you.
const runGoal = () => distUnit() === 'km' ? '2 km' : '1.25 mi'
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
  cards: { slot: 'mind', safe: true, text: 'Review 5 cards', xp: 10, tokens: 6, when: f => f.review, done: d => d.reviews >= 5 },
  study: { slot: 'mind', safe: true, text: 'Study a video or add a study note', xp: 10, tokens: 6, done: d => d.study.length > 0 },
  sim: { slot: 'mind', safe: true, text: 'Play a Live roll', xp: 8, tokens: 5, done: d => d.sim.length > 0 },
  win: { slot: 'mind', safe: true, text: 'Win a Live roll', xp: 12, tokens: 8, when: f => f.sim, done: d => d.sim.some(r => r.result === 'win') },
  reflect: { slot: 'mind', text: 'Answer the reflection prompt when you log', xp: 10, tokens: 6, done: d => d.sessions.some(s => s.reflectA) },
  visualize: { slot: 'mind', safe: true, self: true, text: 'Visualize your A-game for 5 minutes', xp: 8, tokens: 5 },
  run: { slot: 'body', text: () => `Run ${runGoal()}`, xp: 15, tokens: 10, when: f => f.run, done: d => kmOn(d) >= 1.99 },
  move: { slot: 'body', text: 'Get 20 minutes of other training', xp: 12, tokens: 8, done: d => sum(d.acts, 'minutes') >= 20 },
  strength: { slot: 'body', text: 'Strength or conditioning, 20 minutes', xp: 15, tokens: 10, when: f => f.strength, done: d => sum(d.acts.filter(a => STRENGTH.includes(a.type)), 'minutes') >= 20 },
  mobility: { slot: 'body', safe: true, text: 'Mobility, yoga or recovery, 10 minutes', xp: 10, tokens: 6, done: d => sum(d.acts.filter(a => RECOVERY.includes(a.type)), 'minutes') >= 10 },
  rehab: { slot: 'body', hurt: true, self: true, text: 'Do your rehab or recovery routine', xp: 10, tokens: 6 },
}
export const SLOTS = ['mat', 'mind', 'body']

const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
export const hurtOn = date => activeOn(date).some(i => (i.severity || 1) >= 2)

// The same day always gets the same three quests.
export function questsOn(date) {
  const f = before(date), hurt = hurtOn(date), self = game().self[date] || []
  return SLOTS.map(slot => {
    const pool = Object.entries(QUESTS).filter(([, q]) => q.slot === slot && (hurt ? q.safe || q.hurt : !q.hurt) && (!q.when || q.when(f, date)))
    const [id, q] = pool[hash(date + slot) % pool.length]
    return { id, ...q, text: typeof q.text === 'function' ? q.text() : q.text, done: q.self ? self.includes(id) : !!q.done(on(date)) }
  })
}

// ---------- Weekly boss ----------

// target is your weekly session target. Parts are [label, have, need].
const BOSSES = [
  { name: 'The Gatekeeper', when: f => f.landed, parts: (w, t) => [['Sessions', w.sessions, t], ['Offensive moves landed', w.offense, 5]] },
  { name: 'The Long Grind', parts: w => [['Hours of training', Math.floor(w.minutes / 6) / 10, 4]] },
  { name: 'The Librarian', when: f => f.review, parts: (w, t) => [['Cards reviewed', w.reviews, 25], ['Sessions', w.sessions, Math.max(1, t - 1)]] },
  { name: 'The Collector', when: f => f.landed, parts: (w, t) => [['Different moves landed', w.distinct, 3], ['Sessions', w.sessions, Math.max(1, t - 1)]] },
]
const RECOVERY_BOSS = { name: 'The Long Recovery', parts: w => [['Recovery days: mobility, cards or study', w.recoveryDays, 3]] }
export const BOSS_REWARD = { xp: 100, tokens: 40 }

function bossOf(from, dates, hurt) {
  const ds = dates.map(on), rolls = ds.flatMap(d => d.rolls)
  const w = {
    sessions: sum(ds, d => d.sessions.length), offense: sum(ds, offenseLanded), reviews: sum(ds, 'reviews'),
    minutes: sum(ds, d => sum(d.sessions, 'minutes') + sum(d.acts, 'minutes')),
    distinct: new Set(rolls.flatMap(landedIds)).size,
    recoveryDays: ds.filter(d => d.reviews || d.study.length || d.acts.some(a => RECOVERY.includes(a.type))).length,
  }
  const f = before(from), pool = BOSSES.filter(b => !b.when || b.when(f))
  const b = hurt ? RECOVERY_BOSS : pool[hash(from + 'boss') % pool.length]
  const parts = b.parts(w, S.settings.weeklyTarget || 3)
  return { name: b.name, parts, done: parts.every(([, have, need]) => have >= need), hurt }
}

// ---------- The whole run: every week since your first entry ----------

// A week keeps your streak when you finish 4 daily quests or beat the boss. Weeks with a moderate
// or severe injury, and weeks you spend a streak freeze on, never break it. Neither does a rest week
// you haven't finished yet. Each week in the streak adds 10% to tokens, up to +50%.
export const KEEP_QUESTS = 4
const weekKey = d => isoDate(weekStart(d))

export const run = () => cached('gameRun', () => {
  const now = today(), start = firsts().start || now, G = game(), weeks = []
  let xp = 0, tokens = 0, streak = 0
  for (let w = weekStart(parseD(start)); isoDate(w) <= now; w.setDate(w.getDate() + 7)) {
    const from = isoDate(w), dates = Array.from({ length: 7 }, (_, i) => isoDate(new Date(w.getFullYear(), w.getMonth(), w.getDate() + i))).filter(d => d >= start && d <= now)
    const daily = dates.map(questsOn), done = daily.flat().filter(q => q.done)
    const hurt = dates.some(hurtOn), boss = bossOf(from, dates, hurt), mult = 1 + 0.1 * Math.min(streak, 5)
    const allThree = daily.filter(q => q.every(x => x.done)).length
    const earned = Math.round((sum(done, 'tokens') + 5 * allThree + (boss.done ? BOSS_REWARD.tokens : 0)) * mult)
    xp += sum(done, 'xp') + (boss.done ? BOSS_REWARD.xp : 0)
    tokens += earned
    const kept = done.length >= KEEP_QUESTS || boss.done, current = from === weekKey(new Date())
    const frozen = G.frozen.includes(from)
    if (kept) streak++
    else if (!hurt && !frozen && !current) streak = 0
    weeks.push({ from, done: done.length, boss, kept, hurt, frozen, mult, earned })
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
    ['Review deck cards', 2, (S.settings.reviewLog || []).length],
    ['Moves drilled', 3, sum(S.session, s => (s.drilled || []).length)],
    ['Reps, per 10', 1, reps],
    ['Runs', 10, runs.length],
    ['Run distance, per km', 3, Math.round(sum(runs, r => distIn(r, 'km')))],
    ['Other training', 8, other.length],
    ['Other training, per 10 minutes', 1, Math.floor(sum(other, 'minutes') / 10)],
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
    Technique: sum(allTechs().filter(t => t.type !== 'Movement'), t => masteryOf(t).level) + (S.settings.reviewLog || []).length / 10 + sum(S.session, s => (s.drilled || []).length) / 2,
    Cardio: sum(acts.filter(isRun), r => distIn(r, 'km')) + hours(S.session) + hours(acts.filter(a => ['Conditioning', 'Cycling', 'Swimming'].includes(a.type))),
    Strength: 2 * acts.filter(a => STRENGTH.includes(a.type)).length + sum(acts.filter(a => STRENGTH.includes(a.type)), 'minutes') / 30,
    Strategy: sum(S.seq, s => s.nodes.length) + 3 * liveRollSeqs().length + 2 * sim.filter(r => r.result === 'win').length + 3 * sum(S.profile.tournaments, 'wins'),
    Resilience: 2 * S.session.filter(s => s.injuryIds?.length).length + 5 * healed.length + 5 * returned + acts.filter(a => RECOVERY.includes(a.type)).length,
  }
  return Object.entries(points).map(([name, p]) => ({ name, value: statOf(p) }))
})
export const STAT_HINTS = {
  Technique: 'Mastery levels, review cards and drilling',
  Cardio: 'Run distance, mat hours and conditioning',
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
  { id: 'c4', level: 7, title: 'Hidden Scrolls', tokens: 40, need: 15, what: 'Review 15 cards',
    text: 'Ana hands you a notebook full of crossed-out sequences. “Everyone forgets. The good ones review.” Some pages are blank, waiting for yours.',
    have: from => (S.settings.reviewLog || []).filter(d => d >= from).length },
  { id: 'c5', level: 10, title: 'The Long Road', tokens: 50, need: 3, what: 'Run or do other training 3 times',
    text: 'Round six, and your arms are concrete. The old-timers say gas tanks aren’t built on the mat alone. You lace up your shoes.',
    have: from => since(from, S.activity).length },
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

// Cosmetics are worn in a slot. Abilities are perks in Live roll and for your streak; none of them
// changes your journal. A consumable can be bought more than once, up to max held at a time.
export const SHOP = {
  'gi-white': { slot: 'kit', name: 'White gi', price: 0, color: '#F3F2EC' },
  'gi-blue': { slot: 'kit', name: 'Blue gi', price: 60, color: '#2B5DAE' },
  'gi-black': { slot: 'kit', name: 'Black gi', price: 90, color: '#202328' },
  'rash-plain': { slot: 'kit', name: 'Ranked rash guard', price: 0, nogi: true, color: '#2A2F36' },
  'rash-neon': { slot: 'kit', name: 'Neon rash guard', price: 70, nogi: true, color: '#0E7490', trim: '#22D3EE' },
  'rash-magenta': { slot: 'kit', name: 'Magenta rash guard', price: 70, nogi: true, color: '#3B0F45', trim: '#E879F9' },
  'patch-star': { slot: 'patch', name: 'Star patch', price: 30 },
  'patch-bolt': { slot: 'patch', name: 'Lightning patch', price: 40 },
  'patch-wave': { slot: 'patch', name: 'Wave patch', price: 40 },
  'band-red': { slot: 'band', name: 'Red headband', price: 35, color: '#C9333A' },
  'band-neon': { slot: 'band', name: 'Neon headband', price: 50, color: '#22D3EE' },
  'mat-tatami': { slot: 'mat', name: 'Tatami mat', price: 50 },
  'mat-night': { slot: 'mat', name: 'Night dojo', price: 80, level: 5 },
  'mat-neon': { slot: 'mat', name: 'Neon arena', price: 120, level: 8 },
  'aura-calm': { slot: 'aura', name: 'Calm aura', price: 150, level: 10, color: '#22D3EE' },
  'aura-fire': { slot: 'aura', name: 'Fire aura', price: 250, level: 20, color: '#F97316' },
  reshuffle: { ability: true, name: 'Reshuffle', price: 80, level: 3, desc: 'Once per Live roll, swap your four options for a fresh set.' },
  scout: { ability: true, name: 'Scout', price: 120, level: 6, desc: 'Once per Live roll, see which options belong to your partner and which of yours is likeliest to land.' },
  freeze: { ability: true, name: 'Streak freeze', price: 50, max: 2, desc: 'Covers one missed week so your quest streak carries on. Hold up to 2.' },
}
export const SLOT_NAMES = { kit: 'Kit', patch: 'Patch', band: 'Headband', mat: 'Mat', aura: 'Aura' }

export const owns = id => !SHOP[id]?.price || (game().owned[id] || 0) > 0
export const hasAbility = id => (game().owned[id] || 0) > 0
export function equipped() {
  const e = game().equipped, kit = e.kit && owns(e.kit) ? e.kit : S.profile.game === 'No-gi' ? 'rash-plain' : 'gi-white'
  return { ...Object.fromEntries(Object.entries(e).filter(([, id]) => id && owns(id))), kit }
}

// Why an item can't be bought right now, or '' when it can.
export function cantBuy(id) {
  const item = SHOP[id], have = game().owned[id] || 0
  if (!item.ability && have) return 'Owned'
  if (item.ability && !item.max && have) return 'Owned'
  if (item.max && have - (id === 'freeze' ? game().frozen.length : 0) >= item.max) return `Holding ${item.max}`
  if (item.level && levelOf().level < item.level) return `Level ${item.level}`
  if (balance() < item.price) return `${item.price - balance()} more tokens`
  return ''
}
