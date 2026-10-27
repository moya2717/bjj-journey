import { S, save } from '../store.js'
import { POSITIONS, RESULTS } from '../vocab.js'
import { byDateAsc, byDateDesc, cap, daysAgo, isoDate, parseD, esc, fmtDate, hrs, plural, pct, posRole, rate, span, sum, toast, today, topKeys, trunc, weekStart } from '../util.js'
import { MOVE_OUTCOMES, allTechs, currentRank, nodePath, rankName, rollTechId, seqById, techById } from '../model.js'
import { areaCounts, badSpots, bodyInsights, hardestMatchup, monthlySeries, moveTrends, problemTrends, techStats, unpromoted, weakestStep } from '../analysis.js'
import { lineChart, sparkBars } from '../charts.js'
import { fold, moreButton, subHead, subOf, tile } from './hub.js'
import { UI } from '../ui.js'
import { questsOn } from '../game.js'
import { thisWeek as scenarioWeek } from '../scenarios.js'
import { computeAchievements, goalStatus, progressOf } from '../achievements.js'
import { activeInjuries, duration, injuriesOf, injuryName } from '../body.js'
import { fmtDist, loadTrend, runStats } from '../load.js'
import { WIDGETS, homeWidgets } from './athlete.js'
import { TAG_LABELS, nextPlan, readiness, recentNotes, reviewDue, todaysFocus } from '../loop.js'

// Above the fold: this week, quick actions and today's focus. Everything else is a compact
// tile or a swipe row; the three questions open as sub-screens.
export function view() {
  const fresh = !S.session.length && !S.roll.length, sub = QUESTIONS[subOf('overview')]
  if (sub && !fresh) return `<h1 class="sr">Home</h1>${subHead(sub[0], 'Home')}<article class="q q-${subOf('overview')}">${sub[1]()}${sub[2]}</article>`
  const quests = questsOn(today()), done = quests.filter(q => q.done).length
  return `<h1 class="sr">Home</h1>
    ${thisWeek()}
    <div class="quick">
      <button class="btn quick-main" data-act="new-session">Log training</button>
      <button class="btn ghost" data-act="new-run">Log a run</button>
      <button class="btn ghost" data-act="new-roll">Log a roll</button>
      <button class="btn ghost" data-act="tab" data-view="sim">Live roll</button>
    </div>
    ${fresh ? `<div class="empty-state">
      <h2>Start with one session</h2>
      <p>Log what you trained and how your rolls went. After a few weeks, Home answers three questions: what keeps going wrong, what to work on next, and whether your game is improving.</p>
      <div class="head-actions"><button class="btn ghost" data-act="load-examples">Load example entries</button></div>
    </div>` : `${focusCard()}
    ${nudges()}
    ${readinessCard()}
    <button class="dojo-row" data-act="tab" data-view="quests"><span><b>Today’s quests</b><span class="small muted">${done} of ${quests.length} done</span></span><span aria-hidden="true">›</span></button>
    ${widgets()}
    <h2 class="section-title">Your game, last 60 days</h2>
    <div class="dojo-tiles">${gameTiles()}</div>
    ${insights()}
    <button class="dojo-row" data-act="review"><span><b>Coaching review with Claude</b><span class="small muted">Copy your last 60 days with a coaching prompt</span></span><span aria-hidden="true">›</span></button>`}`
}

// [title, body, link to the screen with more]
const QUESTIONS = {
  wrong: ['What keeps going wrong?', () => whatGoesWrong(), '<button class="card-link" data-act="tab" data-view="rolls">All your rolls</button>'],
  next: ['What should I work on next?', () => whatNext(), '<button class="card-link" data-act="tab" data-view="sequences">Your sequences</button>'],
  improve: ['Is my game actually improving?', () => isImproving(), '<button class="card-link" data-act="tab" data-view="stats">All your stats</button>'],
}

function gameTiles() {
  const { bad, groups } = badSpots(daysAgo(59)), n = nextLists(), todo = n.experiments.length + n.proven.length + n.unanswered.length + n.coachQs.length
  const v = verdictOf(), cur = rate(S.roll.filter(r => r.date >= daysAgo(29)))
  return tile('wrong', 'Going wrong', bad.length, groups[0] ? posRole(groups[0].position, groups[0].role) : 'breakdowns')
    + tile('next', 'Work on next', todo, todo ? 'to test or answer' : 'nothing open')
    + tile('improve', 'Improving?', pct(cur), esc(v[1]), { spark: sparkBars(monthlySeries(6).map(s => s.rate)) })
}

// The hero: this week's sessions against your target, mat hours, run distance and load.
function thisWeek() {
  const from = isoDate(weekStart(new Date())), week = S.session.filter(s => s.date >= from)
  const target = S.settings.weeklyTarget || 3, t = loadTrend(), r = runStats()
  const ring = Math.min(1, week.length / target), C = 2 * Math.PI * 26
  return `<button class="hero ${t.spike ? 'spike' : ''}" data-act="goto" data-view="athlete" data-anchor="load">
    <span class="hero-head"><span class="hero-title">This week</span><span class="hero-more">Profile →</span></span>
    <span class="hero-body">
      <svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="track" cx="32" cy="32" r="26"/>${ring ? `<circle class="fill" cx="32" cy="32" r="26" stroke-dasharray="${(ring * C).toFixed(1)} ${C.toFixed(1)}"/>` : ''}<text x="32" y="37" text-anchor="middle">${week.length}/${target}</text></svg>
      <span class="hero-stats">
        <span><b>${week.length}</b> ${week.length === 1 ? 'session' : 'sessions'}, target ${target}</span>
        <span><b>${hrs(sum(week, 'minutes'))}</b> mat hrs</span>
        <span><b>${fmtDist(r.week.dist)}</b> ${r.unit} run</span>
        <span><b>${t.ratio == null ? '—' : pct(t.ratio)}</b> of usual load</span>
      </span>
    </span>
    ${t.spike ? '<span class="hero-warn">Load is well above your 4-week average. Ease in.</span>' : ''}
  </button>`
}

function widgets() {
  const keys = homeWidgets()
  return keys.length ? `<div class="widgets">${keys.map(k => WIDGETS[k][1]()).join('')}</div>` : ''
}

// One or two things worth knowing right now, each opening the screen with the detail.
// A finding already on a Home card isn't repeated.
function insights() {
  const from = daysAgo(59), { groups } = badSpots(from), spot = groups[0], body = bodyInsights().findings[0]
  const landed = moveTrends(1).topLanded[0], shown = homeWidgets()
  const list = [
    spot && ['rolls', '', 'Keeps going wrong', `${posRole(spot.position, spot.role)}: ${plural(spot.n, 'breakdown')} in 60 days${topKeys(spot.reasons, 1)[0] ? `, mostly ${esc(topKeys(spot.reasons, 1)[0].toLowerCase())}` : ''}.`],
    body && !shown.includes('sleep') && ['stats', 'body', 'Energy, sleep and injuries', esc(body.text)],
    landed && !shown.includes('moves') && ['stats', 'moves', 'Your best move', `${esc(landed.tech.name)} is your most landed move, ${plural(landed.n, 'time')} so far.`],
  ].filter(Boolean)
  return list.length ? `<div class="insights swipe">${list.map(([view, anchor, lbl, text]) => `<button class="insight-card" data-act="goto" data-view="${view}" data-anchor="${anchor}"><span class="w-lbl">${lbl}</span><span>${text}</span></button>`).join('')}</div>` : ''
}

// ---------- Learning loop: readiness, today's focus ----------

function readinessCard() {
  const r = readiness(), t = r.tags, checked = t.from === 'check-in'
  const pick = (k, v, l) => `<button class="pill" data-act="checkin" data-k="${k}" data-v="${v}" aria-pressed="${checked && t[k] === v}">${l}</button>`
  return `<div class="ready ready-${r.level}">${fold('ready', `<span><span class="w-lbl">Readiness</span><span class="ready-verdict">${r.known ? r.label : 'Check in'}</span></span>`, `<div class="ready-body">
    ${r.known ? `<p class="small">${r.why.length ? esc(cap(r.why.join(', '))) + '.' : 'Nothing in your log says to change course.'}</p>` : '<p class="small">Tap how you feel to get a suggestion for today.</p>'}
    <div class="checkin">${Object.entries(TAG_LABELS).map(([k, opts]) => `<div class="checkin-row"><span class="small muted">${cap(k)}</span>${Object.entries(opts).map(([v, l]) => pick(k, v, l)).join('')}</div>`).join('')}</div>
    <p class="small muted">A suggestion from your log, not medical advice. Listen to your body and your coach.</p></div>`)}</div>`
}

function focusCard() {
  const list = todaysFocus(), plan = nextPlan(), items = list.filter(f => f.text !== plan?.text)
  return `<section class="focus" aria-labelledby="focus-h">
    <div class="history-head"><h2 id="focus-h">Today’s focus</h2><button class="card-link" data-act="tab" data-view="review">Week in review</button></div>
    ${plan ? `<div class="callout"><p class="small muted">Planned for your next session</p><p><strong>${esc(plan.text)}</strong></p>
      <div class="row-actions"><button class="btn sm" data-act="new-session">Log it</button><button class="btn sm ghost" data-act="clear-plan">Clear</button></div></div>` : ''}
    ${list.length ? '' : '<p class="small muted">After class, write down something to fix. It shows up here as one thing to bring to your next class. Rolls, sequences and drills add more ideas.</p>'}
    <ul class="list">${items.slice(0, UI.more.focus || 2).map(f => `<li class="focus-item"><span><b>${esc(f.text)}</b><span class="small muted">${esc(f.why)}</span></span>
      <span class="row-actions">${f.seqId ? `<button class="btn sm ghost" data-act="open-seq" data-id="${esc(f.seqId)}">Open</button>` : ''}<button class="btn sm" data-act="plan-focus" data-i="${list.indexOf(f)}">Plan it</button></span></li>`).join('')}</ul>${moreButton('focus', items.length, 2)}
  </section>`
}

// Back up every 30 days. "Not now" hides the reminder for a week.
const backupDue = () => (S.session.length + S.roll.length + S.activity.length + S.seq.length > 0)
  && (!S.settings.lastBackup || S.settings.lastBackup < daysAgo(30)) && !(S.settings.backupSnooze >= daysAgo(6))

function nudges() {
  const due = scenarioWeek().left.length
  const next = [...S.profile.tournaments].sort(byDateAsc).find(t => t.date >= today())
  const days = next && Math.round((parseD(next.date) - parseD(today())) / 864e5)
  const hurt = activeInjuries()
  const items = [
    reviewDue() && `<button class="nudge review-due" data-act="tab" data-view="review"><strong>Weekly review</strong> Look back at your week and pick one focus</button>`,
    backupDue() && `<div class="nudge backup"><span><strong>Back up your journal.</strong> ${S.settings.lastBackup ? `Last backup ${fmtDate(S.settings.lastBackup)}.` : 'It only lives on this phone.'}</span>
      <span class="row-actions"><button class="btn sm" data-act="export">Back up now</button><button class="btn sm ghost" data-act="backup-snooze">Not now</button></span></div>`,
    hurt.length && `<button class="nudge hurt" data-act="tab" data-view="injuries"><strong>${hurt.length === 1 ? 'Active injury' : hurt.length + ' active injuries'}</strong> ${esc(hurt.slice(0, 2).map(i => `${injuryName(i)}, ${duration(i).toLowerCase()}`).join('; '))}${hurt.length > 2 ? '…' : ''}</button>`,
    due && `<button class="nudge" data-act="tab" data-view="study"><strong>${due}</strong> ${due === 1 ? 'scenario' : 'scenarios'} to think through this week</button>`,
    next && days <= 90 && `<button class="nudge" data-act="tab" data-view="compete"><strong>${days === 0 ? 'Today' : days + (days === 1 ? ' day' : ' days')}</strong> until ${esc(next.name)}</button>`,
  ].filter(Boolean)
  return items.length ? `<div class="nudges">${items.join('')}</div>` : ''
}

const arrow = (now, before, lowerIsBetter) => {
  if (now == null || before == null || now === before) return ''
  const better = lowerIsBetter ? now < before : now > before
  return `<span class="${better ? 'delta-up' : 'delta-down'}" aria-hidden="true">${now > before ? '▲' : '▼'}</span>`
}

function flaggedTrouble() {
  const top = areaCounts('trouble', daysAgo(59)).slice(0, 3)
  return top.length ? `<div class="callout"><p class="small muted">Trouble you flagged after class, last 60 days</p>
    <div class="tags">${top.map(([a, n]) => `<span class="tag bad">${esc(a)} · ${n}</span>`).join('')}</div></div>` : ''
}

function whatGoesWrong() {
  const from = daysAgo(59), recent = S.roll.filter(r => r.date >= from)
  if (!recent.length && areaCounts('trouble', from).length) return flaggedTrouble() + '<p class="small muted">Log a few rolls too, to see exactly where things break down.</p>'
  if (!recent.length && recentNotes('struggled', 59).length) return noteList('struggled', 'Things you wanted to fix') + '<p class="small muted">See the same thing twice? That’s a good focus for next class.</p>'
  if (!recent.length) return '<p class="empty">After class, write down one thing to fix. Over a few weeks, the things that keep coming up show up here.</p><button class="link" data-act="new-session">Log training</button>'
  const { bad, groups } = badSpots(from)
  if (!bad.length) return `<p>No breakdowns in ${plural(recent.length, 'logged roll')}. Either it’s going well, or the hard rounds aren’t making it into the log.</p>`
  const top = groups.slice(0, 3), max = top[0].weight || 1
  const causes = {}
  bad.forEach(r => (r.reasons || []).forEach(x => causes[x] = (causes[x] || 0) + 1))
  const topCauses = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const weak = weakestStep(from), hard = hardestMatchup(S.roll.filter(r => r.date >= daysAgo(89)))
  return `<ul class="spots">${top.map(g => {
      const why = topKeys(g.reasons, 2)
      return `<li>
        <div class="spot-head"><span class="spot-name">${posRole(g.position, g.role)}</span><span class="count">${plural(g.n, 'breakdown')}</span></div>
        <div class="meter"><span style="width:${Math.max(8, g.weight / max * 100)}%"></span></div>
        ${why.length ? `<p class="small">Mostly ${why.map(x => esc(x.toLowerCase())).join(' and ')}</p>` : ''}
        ${g.last.what ? `<p class="quote">“${esc(trunc(g.last.what, 110))}”</p>` : ''}
      </li>`
    }).join('')}</ul>
    ${topCauses.length ? `<p class="small muted">Most common causes overall: ${topCauses.map(([k, v]) => `${esc(k.toLowerCase())} (${v})`).join(', ')}</p>` : ''}
    ${flaggedTrouble()}
    ${weak ? `<div class="callout"><p class="small muted">Weakest step in your sequences</p><p><strong>${esc(weak.label)}</strong> (${esc(weak.seq)}) went wrong in ${weak.broke + weak.partial} of ${weak.n} rolls.</p><div><button class="link" data-act="open-seq" data-id="${weak.seqId}">Open the sequence</button></div></div>` : ''}
    ${hard ? `<div class="callout"><p class="small muted">Hardest matchup, last 90 days</p><p>Against <strong>${esc(hard.label)}</strong> partners you’re at ${pct(hard.rate)}, against everyone else ${pct(hard.others)}.</p><div><button class="link" data-act="tab" data-view="matchups">See matchups</button></div></div>` : ''}`
}

// Your own words from recent logs, for a journal that doesn't track rolls in detail.
const noteList = (key, title) => `<p class="sub">${title}</p><ul class="list">${recentNotes(key, 59).slice(0, 3).map(s => `<li><p>${esc(s[key])}</p><p class="small muted">${fmtDate(s.date)}</p></li>`).join('')}</ul>`

function nextLists() {
  const { groups } = badSpots(daysAgo(59))
  const frequency = Object.fromEntries(groups.map(g => [g.position + '|' + (g.role || ''), g.n]))
  const spotOf = r => frequency[r.position + '|' + (r.role || '')] || 0
  return {
    experiments: S.roll.filter(r => r.tryNext && (r.tryStatus || 'open') === 'open').sort((a, b) => spotOf(b) - spotOf(a) || a.date.localeCompare(b.date)),
    proven: unpromoted(),
    unanswered: S.seq.flatMap(s => s.nodes.filter(n => n.who === 'them' && !s.nodes.some(c => c.parentId === n.id)).map(node => ({ seq: s, node }))),
    coachQs: S.session.filter(s => s.coachQ && !s.coachAsked).sort(byDateDesc),
  }
}

function whatNext() {
  const { experiments, proven, unanswered, coachQs } = nextLists()
  const behind = S.goal.map(g => ({ g, ...goalStatus(g) })).filter(x => x.state === 'behind')
  const almost = computeAchievements().filter(a => !a.unlockedOn && progressOf(a) >= 0.7).sort((a, b) => progressOf(b) - progressOf(a)).slice(0, 2)
  const struggling = allTechs().map(t => ({ t, ...techStats(t.id) })).filter(x => x.n >= 3 && x.rate < 0.4).sort((a, b) => a.rate - b.rate).slice(0, 2)
  if (![experiments, proven, unanswered, coachQs, behind, almost, struggling].some(l => l.length))
    return recentNotes('worked', 59).length ? noteList('worked', 'What’s working, keep doing it')
      : '<p class="empty">Write down something that worked after each class. Your wins collect here, and as you add more detail your to-do list grows too.</p>'

  let html = ''
  const section = (title, items, render, more = '') => { if (items.length) html += `<p class="sub">${title}</p><ul class="list">${items.map(render).join('')}</ul>${more}` }
  section('Worked on the mat, not in a sequence yet', proven.slice(0, 3), r => `<li><p>${esc(r.tryNext)}</p><p class="small muted">${posRole(r.position, r.role)}, from ${fmtDate(r.date)}</p>
    <div class="row-actions"><button class="btn sm" data-act="promote" data-id="${r.id}">Add to sequence</button><button class="btn sm ghost" data-act="promote-skip" data-id="${r.id}">Don’t add</button></div></li>`)
  section('Things to test in your next rolls', experiments.slice(0, 4), r => `<li><p>${esc(r.tryNext)}</p><p class="small muted">${posRole(r.position, r.role)}, from ${fmtDate(r.date)}</p>
    <div class="row-actions"><button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="worked">Tried it, worked</button><button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="failed">Tried it, didn’t work</button></div></li>`,
    experiments.length > 4 ? `<p class="small muted">${experiments.length - 4} more under Journal → Rolls</p>` : '')
  section('Reactions you have no answer for', unanswered.slice(0, 3), o => `<li><p>${esc(o.node.label)}</p><p class="small muted">${esc(o.seq.name)}</p>
    <div class="row-actions"><button class="btn sm ghost" data-act="add-node" data-seq="${o.seq.id}" data-parent="${o.node.id}" data-who="me">Add your answer</button></div></li>`)
  section('Ask your coach', coachQs.slice(0, 3), s => `<li><p>${esc(s.coachQ)}</p><p class="small muted">From ${fmtDate(s.date)}</p>
    <div class="row-actions"><button class="btn sm ghost" data-act="coach-asked" data-id="${s.id}">Asked it</button></div></li>`)
  section('Challenges behind pace', behind, x => `<li><p>${esc(x.g.title)}</p><p class="small muted">${x.value} of ${x.g.target}</p></li>`)
  section('Almost unlocked', almost, a => `<li><p>${esc(a.title)}</p><p class="small muted">${Math.floor(a.total).toLocaleString()} of ${a.target.toLocaleString()}</p></li>`)
  section('Moves that aren’t landing', struggling, x => `<li><p>${esc(x.t.name)}</p><p class="small muted">${pct(x.rate)} success over ${x.n} rolls</p></li>`)
  return html
}

// The headline answer: comparing the last 30 days of rolls with the 30 before.
function verdictOf() {
  const a = daysAgo(29), b = daysAgo(59)
  const cur = S.roll.filter(r => r.date >= a), prev = S.roll.filter(r => r.date >= b && r.date < a)
  if (cur.length < 5 || prev.length < 5) return ['na', 'Not enough rolls logged yet to tell']
  const d = Math.round((rate(cur) - rate(prev)) * 100)
  return d >= 5 ? ['up', `Yes. Up ${d} points this month`] : d <= -5 ? ['down', `Not right now. Down ${-d} points`] : ['flat', 'Holding steady']
}

function isImproving() {
  const a = daysAgo(29), b = daysAgo(59)
  const cur = S.roll.filter(r => r.date >= a), prev = S.roll.filter(r => r.date >= b && r.date < a)
  const rc = rate(cur), rp = rate(prev)
  let verdict = verdictOf()
  const sc = S.session.filter(s => s.date >= a), sp = S.session.filter(s => s.date >= b && s.date < a)
  const bc = cur.filter(r => r.result === 'broke').length, bp = prev.filter(r => r.result === 'broke').length
  const byPosition = POSITIONS.flatMap(p => ['Top', 'Bottom', 'Neutral'].map(role => {
    const inSpot = r => r.position === p && (r.role || 'Neutral') === role
    const c = cur.filter(inSpot), q = prev.filter(inSpot)
    return c.length >= 2 && q.length >= 2 ? { p, role, c: rate(c), q: rate(q) } : null
  })).filter(Boolean).sort((x, y) => Math.abs(y.c - y.q) - Math.abs(x.c - x.q))
  const movers = problemTrends().causes.filter(t => ['fading', 'growing', 'new'].includes(t.state)).sort((x, y) => Math.abs(y.cur - y.prev) - Math.abs(x.cur - x.prev)).slice(0, 4)
  const series = monthlySeries(6)
  const noRolls = !cur.length && !prev.length
  if (noRolls && sc.length) verdict = ['na', `You showed up ${plural(sc.length, 'time')} in the last 30 days. That’s how you get better.`]
  return `<p class="verdict ${verdict[0]}">${verdict[1]}</p>
    ${verdict[0] === 'na' ? `<p class="small muted">${noRolls ? 'Log how your rolls go (one tap: worked, partly or fell apart) to see your success rate climb here.' : `The comparison needs at least 5 rolls in each of the last two 30-day windows. You have ${cur.length} and ${prev.length}.`}</p>` : ''}
    <dl class="compare">
      ${noRolls ? '' : `<dt>Roll success, prior 30 days → last 30</dt><dd>${pct(rp)} → ${pct(rc)} ${arrow(rc, rp)}</dd>
      <dt>Rolls that broke down</dt><dd>${bp} → ${bc} ${arrow(bc, bp, true)}</dd>`}
      <dt>Sessions</dt><dd>${sp.length} → ${sc.length} ${arrow(sc.length, sp.length)}</dd>
      <dt>Mat hours</dt><dd>${hrs(sum(sp, 'minutes'))} → ${hrs(sum(sc, 'minutes'))}</dd>
    </dl>
    ${byPosition.length ? `<p class="sub">By position</p><dl class="compare">${byPosition.slice(0, 4).map(x => `<dt>${posRole(x.p, x.role)}</dt><dd>${pct(x.q)} → ${pct(x.c)} ${arrow(x.c, x.q)}</dd>`).join('')}</dl>` : ''}
    ${movers.length ? `<p class="sub">Causes, share of rolls</p><dl class="compare">${movers.map(t => `<dt>${esc(t.label)}</dt><dd>${pct(t.prev)} → ${pct(t.cur)} ${arrow(t.cur, t.prev, true)}</dd>`).join('')}</dl>` : ''}
    ${series.some(s => s.rate != null) ? `<div><p class="sub">Monthly roll success</p>${lineChart(series, { w: 320, h: 110 })}</div>` : ''}
    ${noRolls ? '' : '<p class="small muted">A roll counts as 1 when it worked and ½ when it partly worked. Partners and what you attempt change the number, so read it alongside your notes.</p>'}`
}

// ---------- Coaching review: a prompt you paste into Claude ----------

function reviewData() {
  const from = daysAgo(59), name = id => techById(id)?.name || ''
  const rank = currentRank()
  return {
    today: today(),
    fighter: { rank: rankName(rank), timeAtRank: rank.since ? span(rank.since) : '', trainingFor: S.profile.startDate ? span(S.profile.startDate) : '', tournamentsLastYear: S.profile.tournaments.filter(t => t.date >= daysAgo(365)).map(t => ({ date: t.date, division: t.division, place: t.place, wins: t.wins, losses: t.losses, notes: trunc(t.notes, 200) })) },
    sessions: S.session.filter(s => s.date >= from).sort(byDateDesc).map(s => ({ date: s.date, time: s.time || '', type: s.type, wentWell: s.wentWell || [], trouble: s.trouble || [], minutes: s.minutes, plan: s.plan || '', stuckToPlan: s.planHit || '', felt: s.feel || '', drilled: (s.drilled || []).map(name).filter(Boolean), reps: (s.reps || []).map(r => `${r.count} ${name(r.techId)}`), worked: trunc(s.worked, 300), wentWrong: trunc(s.struggled, 300), lesson: trunc(s.lesson, 200), reflection: s.reflectA ? `${s.reflectQ} ${trunc(s.reflectA, 300)}` : '', coachQuestion: s.coachQ || '', notes: trunc(s.notes, 300), energy: s.energy || '', sleep: s.sleep || '', trainingAroundInjury: injuriesOf(s).map(injuryName) })),
    injuries: S.injury.filter(i => !i.endDate || i.endDate >= from).map(i => ({ where: injuryName(i), severity: ['', 'mild', 'moderate', 'severe'][i.severity || 1], started: i.startDate, healed: i.endDate || 'still active', what: trunc(i.description, 200), trainingChanges: [...(i.mods || []), i.modNotes].filter(Boolean) })),
    rolls: S.roll.filter(r => r.date >= from).sort(byDateDesc).map(r => { const seq = seqById(r.seqId); return { date: r.date, partnerBelt: r.level, partnerSize: r.size || '', partnerStyle: r.styles || [], position: r.position, role: r.role, move: name(rollTechId(r)), movesUsed: (r.moves || []).filter(m => name(m.techId)).map(m => `${name(m.techId)} (${MOVE_OUTCOMES[m.outcome] || m.outcome})`), sequence: seq ? seq.name + ': ' + nodePath(seq, r.nodeId).join(' > ') : '', result: RESULTS[r.result]?.label || r.result, causes: r.reasons || [], whatHappened: trunc(r.what, 300), tryNext: r.tryNext || '', tryNextStatus: r.tryNext ? (r.tryStatus || 'open') : '' } }),
    otherTraining: S.activity.filter(a => a.date >= from).map(a => ({ date: a.date, type: a.type, minutes: a.minutes, intensity: a.intensity, notes: trunc(a.notes, 200) })),
    challenges: S.goal.map(g => ({ title: g.title, target: g.target, progress: goalStatus(g).value, status: goalStatus(g).label })),
    sequenceGaps: S.seq.flatMap(s => s.nodes.filter(n => n.who === 'them' && !s.nodes.some(c => c.parentId === n.id)).map(n => s.name + ': ' + n.label)),
  }
}

function reviewPrompt() {
  return `You are reviewing my Brazilian jiu-jitsu training journal. Speak to me directly, like a thoughtful coach who has read every entry.

My last 60 days, as JSON:
${JSON.stringify(reviewData())}

Write three short sections:
## Patterns
3 to 5 bullets on recurring patterns, grounded in specific entries (dates, positions, causes). Note where drilling and live rolling don't line up, and how my plans, energy and results relate.
## Blind spots
2 or 3 bullets on what's missing from my log or contradicts itself, including matchups (partner belt, size, style) where my results drop.
## Questions to investigate
4 to 6 concrete questions I can answer in my next rolls, each with how to test it.

Keep it under 400 words. Don't invent entries. If notes mention pain or injury, suggest checking with a coach or medical professional rather than giving medical advice.`
}

export const actions = {
  // The quick check-in: tap again to clear. Saved for today only.
  'checkin': el => {
    const c = S.settings.checkin?.date === today() ? S.settings.checkin : { date: today() }, k = el.dataset.k
    save({ ...S.settings, checkin: { ...c, [k]: c[k] === el.dataset.v ? '' : el.dataset.v } })
  },
  'backup-snooze': () => { save({ ...S.settings, backupSnooze: today() }) },
  'review': async () => {
    const text = reviewPrompt()
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); toast('Copied. Paste it into Claude.') }
    } catch (e) {
      if (e.name === 'AbortError') return
      try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into Claude.') } catch { toast('Couldn’t copy. Try again.') }
    }
  },
}
