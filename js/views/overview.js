import { S } from '../store.js'
import { POSITIONS, RESULTS } from '../vocab.js'
import { byDateAsc, byDateDesc, daysAgo, parseD, esc, fmtDate, hrs, plural, pct, posRole, rate, span, sum, toast, today, topKeys, trunc } from '../util.js'
import { allTechs, currentRank, nodePath, rankName, rollTechId, seqById, techById } from '../model.js'
import { badSpots, hardestMatchup, monthlySeries, problemTrends, techStats, unpromoted, weakestStep } from '../analysis.js'
import { lineChart } from '../charts.js'
import { dueCards } from '../srs.js'
import { computeAchievements, goalStatus, progressOf } from '../achievements.js'

export function view() {
  if (!S.session.length && !S.roll.length) return `
    <div class="empty-state">
      <h2>Start with one session</h2>
      <p>Log what you trained and how your rolls went. After a few weeks, this page answers three questions: what keeps going wrong, what to work on next, and whether your game is improving.</p>
      <div class="head-actions"><button class="btn" data-act="new-session">Log training</button><button class="btn ghost" data-act="load-examples">Load example entries</button></div>
    </div>`
  return `
    ${nudges()}
    <div class="overview-bar"><p class="muted">From your last 60 days of training</p>
      <div class="head-actions"><button class="btn" data-act="new-session">Log training</button><button class="btn ghost" data-act="new-roll">Log a roll</button></div></div>
    <div class="questions">
      <article class="q q-wrong"><h2>What keeps going wrong?</h2>${whatGoesWrong()}</article>
      <article class="q q-next"><h2>What should I work on next?</h2>${whatNext()}</article>
      <article class="q q-improve"><h2>Is my game actually improving?</h2>${isImproving()}</article>
    </div>
    <section class="review" aria-labelledby="rv-h"><div class="review-head">
      <div><h2 id="rv-h">Coaching review with Claude</h2><p class="lede">Packs your last 60 days of notes with a coaching prompt. Paste it into the Claude app for patterns, blind spots and questions to test on the mat.</p></div>
      <div class="head-actions"><button class="btn" data-act="review">Copy for Claude</button></div></div></section>`
}

function nudges() {
  const due = dueCards().length
  const next = [...S.profile.tournaments].sort(byDateAsc).find(t => t.date >= today())
  const days = next && Math.round((parseD(next.date) - parseD(today())) / 864e5)
  const items = [
    due && `<button class="nudge" data-act="tab" data-view="study"><strong>${due}</strong> ${due === 1 ? 'card' : 'cards'} to review today</button>`,
    next && days <= 90 && `<button class="nudge" data-act="tab" data-view="compete"><strong>${days === 0 ? 'Today' : days + (days === 1 ? ' day' : ' days')}</strong> until ${esc(next.name)}</button>`,
  ].filter(Boolean)
  return items.length ? `<div class="nudges">${items.join('')}</div>` : ''
}

const arrow = (now, before, lowerIsBetter) => {
  if (now == null || before == null || now === before) return ''
  const better = lowerIsBetter ? now < before : now > before
  return `<span class="${better ? 'delta-up' : 'delta-down'}" aria-hidden="true">${now > before ? '▲' : '▼'}</span>`
}

function whatGoesWrong() {
  const from = daysAgo(59), recent = S.roll.filter(r => r.date >= from)
  if (!recent.length) return '<p class="empty">Log a few rolls with where they broke down. Your repeat problem spots show up here.</p><button class="link" data-act="new-roll">Log a roll</button>'
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
    ${weak ? `<div class="callout"><p class="small muted">Weakest step in your sequences</p><p><strong>${esc(weak.label)}</strong> (${esc(weak.seq)}) went wrong in ${weak.broke + weak.partial} of ${weak.n} rolls.</p><div><button class="link" data-act="open-seq" data-id="${weak.seqId}">Open the sequence</button></div></div>` : ''}
    ${hard ? `<div class="callout"><p class="small muted">Hardest matchup, last 90 days</p><p>Against <strong>${esc(hard.label)}</strong> partners you’re at ${pct(hard.rate)}, against everyone else ${pct(hard.others)}.</p><div><button class="link" data-act="tab" data-view="matchups">See matchups</button></div></div>` : ''}`
}

function whatNext() {
  const { groups } = badSpots(daysAgo(59))
  const frequency = Object.fromEntries(groups.map(g => [g.position + '|' + (g.role || ''), g.n]))
  const spotOf = r => frequency[r.position + '|' + (r.role || '')] || 0
  const experiments = S.roll.filter(r => r.tryNext && (r.tryStatus || 'open') === 'open').sort((a, b) => spotOf(b) - spotOf(a) || a.date.localeCompare(b.date))
  const proven = unpromoted()
  const unanswered = S.seq.flatMap(s => s.nodes.filter(n => n.who === 'them' && !s.nodes.some(c => c.parentId === n.id)).map(node => ({ seq: s, node })))
  const coachQs = S.session.filter(s => s.coachQ && !s.coachAsked).sort(byDateDesc)
  const behind = S.goal.map(g => ({ g, ...goalStatus(g) })).filter(x => x.state === 'behind')
  const almost = computeAchievements().filter(a => !a.unlockedOn && progressOf(a) >= 0.7).sort((a, b) => progressOf(b) - progressOf(a)).slice(0, 2)
  const struggling = allTechs().map(t => ({ t, ...techStats(t.id) })).filter(x => x.n >= 3 && x.rate < 0.4).sort((a, b) => a.rate - b.rate).slice(0, 2)
  if (![experiments, proven, unanswered, coachQs, behind, almost, struggling].some(l => l.length))
    return '<p class="empty">When you log a roll, add what you’ll try next time. Those experiments, plus gaps in your sequences, show up here as your to-do list.</p>'

  let html = ''
  const section = (title, items, render, more = '') => { if (items.length) html += `<p class="sub">${title}</p><ul class="list">${items.map(render).join('')}</ul>${more}` }
  section('Worked on the mat, not in a sequence yet', proven.slice(0, 3), r => `<li><p>${esc(r.tryNext)}</p><p class="small muted">${posRole(r.position, r.role)}, from ${fmtDate(r.date)}</p>
    <div class="row-actions"><button class="btn sm" data-act="promote" data-id="${r.id}">Add to sequence</button><button class="btn sm ghost" data-act="promote-skip" data-id="${r.id}">Don’t add</button></div></li>`)
  section('Things to test in your next rolls', experiments.slice(0, 4), r => `<li><p>${esc(r.tryNext)}</p><p class="small muted">${posRole(r.position, r.role)}, from ${fmtDate(r.date)}</p>
    <div class="row-actions"><button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="worked">Tried it, worked</button><button class="btn sm ghost" data-act="exp" data-id="${r.id}" data-status="failed">Tried it, didn’t work</button></div></li>`,
    experiments.length > 4 ? `<p class="small muted">${experiments.length - 4} more in Rolling analysis</p>` : '')
  section('Reactions you have no answer for', unanswered.slice(0, 3), o => `<li><p>${esc(o.node.label)}</p><p class="small muted">${esc(o.seq.name)}</p>
    <div class="row-actions"><button class="btn sm ghost" data-act="add-node" data-seq="${o.seq.id}" data-parent="${o.node.id}" data-who="me">Add your answer</button></div></li>`)
  section('Ask your coach', coachQs.slice(0, 3), s => `<li><p>${esc(s.coachQ)}</p><p class="small muted">From ${fmtDate(s.date)}</p>
    <div class="row-actions"><button class="btn sm ghost" data-act="coach-asked" data-id="${s.id}">Asked it</button></div></li>`)
  section('Challenges behind pace', behind, x => `<li><p>${esc(x.g.title)}</p><p class="small muted">${x.value} of ${x.g.target}</p></li>`)
  section('Almost unlocked', almost, a => `<li><p>${esc(a.title)}</p><p class="small muted">${Math.floor(a.total).toLocaleString()} of ${a.target.toLocaleString()}</p></li>`)
  section('Moves that aren’t landing', struggling, x => `<li><p>${esc(x.t.name)}</p><p class="small muted">${pct(x.rate)} success over ${x.n} rolls</p></li>`)
  return html
}

function isImproving() {
  const a = daysAgo(29), b = daysAgo(59)
  const cur = S.roll.filter(r => r.date >= a), prev = S.roll.filter(r => r.date >= b && r.date < a)
  const rc = rate(cur), rp = rate(prev)
  let verdict = ['na', 'Not enough rolls logged yet to tell']
  if (cur.length >= 5 && prev.length >= 5) {
    const d = Math.round((rc - rp) * 100)
    verdict = d >= 5 ? ['up', `Yes. Up ${d} points this month`] : d <= -5 ? ['down', `Not right now. Down ${-d} points`] : ['flat', 'Holding steady']
  }
  const sc = S.session.filter(s => s.date >= a), sp = S.session.filter(s => s.date >= b && s.date < a)
  const bc = cur.filter(r => r.result === 'broke').length, bp = prev.filter(r => r.result === 'broke').length
  const byPosition = POSITIONS.flatMap(p => ['Top', 'Bottom', 'Neutral'].map(role => {
    const inSpot = r => r.position === p && (r.role || 'Neutral') === role
    const c = cur.filter(inSpot), q = prev.filter(inSpot)
    return c.length >= 2 && q.length >= 2 ? { p, role, c: rate(c), q: rate(q) } : null
  })).filter(Boolean).sort((x, y) => Math.abs(y.c - y.q) - Math.abs(x.c - x.q))
  const movers = problemTrends().causes.filter(t => ['fading', 'growing', 'new'].includes(t.state)).sort((x, y) => Math.abs(y.cur - y.prev) - Math.abs(x.cur - x.prev)).slice(0, 4)
  const series = monthlySeries(6)
  return `<p class="verdict ${verdict[0]}">${verdict[1]}</p>
    ${verdict[0] === 'na' ? `<p class="small muted">The comparison needs at least 5 rolls in each of the last two 30-day windows. You have ${cur.length} and ${prev.length}.</p>` : ''}
    <dl class="compare">
      <dt>Roll success, prior 30 days → last 30</dt><dd>${pct(rp)} → ${pct(rc)} ${arrow(rc, rp)}</dd>
      <dt>Rolls that broke down</dt><dd>${bp} → ${bc} ${arrow(bc, bp, true)}</dd>
      <dt>Sessions</dt><dd>${sp.length} → ${sc.length} ${arrow(sc.length, sp.length)}</dd>
      <dt>Mat hours</dt><dd>${hrs(sum(sp, 'minutes'))} → ${hrs(sum(sc, 'minutes'))}</dd>
    </dl>
    ${byPosition.length ? `<p class="sub">By position</p><dl class="compare">${byPosition.slice(0, 4).map(x => `<dt>${posRole(x.p, x.role)}</dt><dd>${pct(x.q)} → ${pct(x.c)} ${arrow(x.c, x.q)}</dd>`).join('')}</dl>` : ''}
    ${movers.length ? `<p class="sub">Causes, share of rolls</p><dl class="compare">${movers.map(t => `<dt>${esc(t.label)}</dt><dd>${pct(t.prev)} → ${pct(t.cur)} ${arrow(t.cur, t.prev, true)}</dd>`).join('')}</dl>` : ''}
    ${series.some(s => s.rate != null) ? `<div><p class="sub">Monthly roll success</p>${lineChart(series, { w: 320, h: 110 })}</div>` : ''}
    <p class="small muted">A roll counts as 1 when it worked and ½ when it partly worked. Partners and what you attempt change the number, so read it alongside your notes.</p>`
}

// ---------- Coaching review: a prompt you paste into Claude ----------

function reviewData() {
  const from = daysAgo(59), name = id => techById(id)?.name || ''
  const rank = currentRank()
  return {
    today: today(),
    fighter: { rank: rankName(rank), timeAtRank: rank.since ? span(rank.since) : '', trainingFor: S.profile.startDate ? span(S.profile.startDate) : '', tournamentsLastYear: S.profile.tournaments.filter(t => t.date >= daysAgo(365)).map(t => ({ date: t.date, division: t.division, place: t.place, wins: t.wins, losses: t.losses, notes: trunc(t.notes, 200) })) },
    sessions: S.session.filter(s => s.date >= from).sort(byDateDesc).map(s => ({ date: s.date, time: s.time || '', type: s.type, minutes: s.minutes, plan: s.plan || '', stuckToPlan: s.planHit || '', felt: s.feel || '', drilled: (s.drilled || []).map(name).filter(Boolean), reps: (s.reps || []).map(r => `${r.count} ${name(r.techId)}`), worked: trunc(s.worked, 300), wentWrong: trunc(s.struggled, 300), lesson: trunc(s.lesson, 200), reflection: s.reflectA ? `${s.reflectQ} ${trunc(s.reflectA, 300)}` : '', coachQuestion: s.coachQ || '', notes: trunc(s.notes, 300) })),
    rolls: S.roll.filter(r => r.date >= from).sort(byDateDesc).map(r => { const seq = seqById(r.seqId); return { date: r.date, partnerBelt: r.level, partnerSize: r.size || '', partnerStyle: r.styles || [], position: r.position, role: r.role, move: name(rollTechId(r)), sequence: seq ? seq.name + ': ' + nodePath(seq, r.nodeId).join(' > ') : '', result: RESULTS[r.result]?.label || r.result, causes: r.reasons || [], whatHappened: trunc(r.what, 300), tryNext: r.tryNext || '', tryNextStatus: r.tryNext ? (r.tryStatus || 'open') : '' } }),
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
