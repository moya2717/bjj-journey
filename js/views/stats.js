import { S } from '../store.js'
import { ACTIVITY_TYPES, FEELS, POSITIONS } from '../vocab.js'
import { dayPart, daysAgo, esc, hrs, monthLabel, pct, plural, rate, sum, ym } from '../util.js'
import { areaCounts, bodyInsights, monthlySeries, moveTrends, problemTrends, weeklyStreak } from '../analysis.js'
import { butterfly, heatmap, lineChart, spark, sparkBars, stackedBars } from '../charts.js'
import { subHead, subOf, tile } from './hub.js'

// A hero with this month's numbers and the calendar heatmap, then a tile per panel.
// Each tile shows one number and opens the full panel as a sub-screen.
export function view() {
  const month = ym(new Date()), thisMonth = S.session.filter(s => s.date.startsWith(month))
  const sub = SUBS[subOf('stats')]
  if (sub) return `<h1 class="sr">Stats</h1>${subHead(sub[0], 'Stats')}<div class="stat-grid">${sub[1]()}</div>`
  return `<h1 class="sr">Stats</h1>
    <section class="panel stats-hero"><h2>Consistency</h2>
      <div class="figures tight">
        <div class="figure"><div class="big">${thisMonth.length}</div><div class="lbl">sessions this month</div></div>
        <div class="figure"><div class="big">${hrs(sum(thisMonth, 'minutes'))}</div><div class="lbl">mat hours this month</div></div>
        <div class="figure"><div class="big">${weeklyStreak()}</div><div class="lbl">week streak at ${S.settings.weeklyTarget || 3}+</div></div>
        <div class="figure"><div class="big">${hrs(sum(S.session, 'minutes'))}</div><div class="lbl">mat hours in total</div></div>
      </div>
      ${heatmap(26)}
    </section>
    <div class="dojo-tiles">${Object.keys(TILES).map(k => statTile(k)).join('')}</div>`
}

// [label, () => [big number, short line, sparkline values]]
export const TILES = {
  success: ['Roll success', () => { const s = monthlySeries(6), cur = s.at(-1).rate ?? s.filter(x => x.rate != null).at(-1)?.rate; return [pct(cur), 'by month', s.map(x => x.rate)] }],
  attention: ['Attention', () => { const p = attention(); return [p.length, p[0] ? esc(p[0].p) + ' most' : 'positions, 90 days'] }],
  areas: ['Problem areas', () => { const bad = areaCounts('trouble', daysAgo(59)); return [bad.length, bad[0] ? esc(bad[0][0]) + ' most' : 'nothing flagged'] }],
  moves: ['Moves in rolls', () => { const t = moveTrends(6); return [sum(t.months.at(-1).counts, x => x), t.topLanded[0] ? 'landed · ' + esc(t.topLanded[0].tech.name) : 'landed this month', t.months.map(m => sum(m.counts, x => x))] }],
  body: ['Energy & sleep', () => { const f = bodyInsights().findings; return [f.length, f[0] ? esc(f[0].text) : 'no pattern yet'] }],
  time: ['Time of day', () => { const t = S.session.filter(s => s.time), best = ['Morning', 'Afternoon', 'Evening'].map(p => [p, t.filter(s => dayPart(s.time) === p).length]).sort((a, b) => b[1] - a[1])[0]; return [t.length, t.length ? `timed · mostly ${best[0].toLowerCase()}` : 'add class times'] }],
  other: ['Other training', () => { const r = S.activity.filter(a => a.date >= daysAgo(29)); return [hrs(sum(r, 'minutes')) + '<small>h</small>', 'outside BJJ, 30 days'] }],
  problems: ['Problems over time', () => { const c = problemTrends().causes, g = c.filter(t => t.state === 'growing' || t.state === 'new'); return [g.length, g[0] ? 'growing · ' + esc(g[0].label) : c.length ? 'none growing' : 'tick causes', c[0]?.months.map(m => m.v)] }],
  months: ['Month by month', () => { const s = monthlySeries(6); return [s.at(-1).sessions, 'sessions this month', s.map(x => x.sessions)] }],
}
export function statTile(k, view = '') {
  const [label, f] = TILES[k], [big, small, values] = f()
  return tile(k, label, big, small, { view, spark: values?.some(v => v) ? sparkBars(values) : '' })
}

const SUBS = {
  success: ['Roll success by month', () => { const series = monthlySeries(6); return `<section class="panel wide">${series.some(s => s.rate != null) ? lineChart(series, { w: 420, h: 170 }) : '<p class="muted">Log rolls to see this trend.</p>'}</section>` }],
  attention: ['Where your attention went', attentionPanel],
  areas: ['Strengths and trouble areas', () => areasPanel()],
  moves: ['Moves in your rolls', () => movesPanel()],
  body: ['Energy, sleep and injuries', () => bodyPanel()],
  time: ['Morning or evening?', () => timeOfDayPanel()],
  other: ['Other training', () => otherTrainingPanel()],
  problems: ['Problems over time', () => trendsPanel()],
  months: ['Month by month', () => { const series = monthlySeries(6); return `<section class="panel wide"><div class="table-scroll"><table>
      <thead><tr><th scope="col">Month</th><th scope="col">Sessions</th><th scope="col">Mat hours</th><th scope="col">Rolls logged</th><th scope="col">Broke down</th><th scope="col">Success</th></tr></thead>
      <tbody>${series.slice().reverse().map(s => `<tr><td>${monthLabel(s.m)}</td><td>${s.sessions}</td><td>${hrs(s.minutes)}</td><td>${s.n}</td><td>${s.broke}</td><td>${pct(s.rate)}</td></tr>`).join('')}</tbody></table></div>
    </section>` }],
}

function attention() {
  const from = daysAgo(89), focus = {}, rolled = {}
  S.session.filter(s => s.date >= from).forEach(s => (s.focus || []).forEach(p => focus[p] = (focus[p] || 0) + 1))
  S.roll.filter(r => r.date >= from).forEach(r => rolled[r.position] = (rolled[r.position] || 0) + 1)
  return POSITIONS.map(p => ({ p, f: focus[p] || 0, r: rolled[p] || 0 })).filter(x => x.f || x.r).sort((a, b) => (b.f + b.r) - (a.f + a.r))
}

function attentionPanel() {
  const positions = attention(), maxAttention = Math.max(1, ...positions.map(x => x.f + x.r))
  return `<section class="panel wide"><h2>Last 90 days</h2>
      ${positions.length ? `<div class="bars">${positions.slice(0, 8).map(x => `<div class="bar-row"><span>${esc(x.p)}</span><div class="meter mat"><span style="width:${(x.f + x.r) / maxAttention * 100}%"></span></div><span class="n">${x.f + x.r}</span></div>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">Counts session focus plus roll notes from each position.</p>` : '<p class="muted">Nothing logged in the last 90 days.</p>'}
    </section>`
}

// ---------- Strengths and trouble areas ----------

function areasPanel() {
  const from = daysAgo(59), good = areaCounts('wentWell', from), bad = areaCounts('trouble', from)
  if (!good.length && !bad.length) return `<section class="panel wide"><h2>Strengths and trouble areas</h2><p class="muted">After each class, tick what went well and what gave you trouble. Patterns show up here.</p></section>`
  const max = Math.max(1, ...[...good, ...bad].map(([, n]) => n))
  const bars = (list, cls) => list.length ? `<div class="bars">${list.slice(0, 6).map(([a, n]) => `<div class="bar-row"><span>${esc(a)}</span><div class="meter ${cls}"><span style="width:${n / max * 100}%"></span></div><span class="n">${n}</span></div>`).join('')}</div>` : '<p class="muted small">Nothing ticked yet.</p>'
  return `<section class="panel wide"><h2>Strengths and trouble areas, last 60 days</h2>
    <div class="trend-grid">
      <div><h3 style="margin-bottom:10px">Went well</h3>${bars(good, 'good')}</div>
      <div><h3 style="margin-bottom:10px">Gave you trouble</h3>${bars(bad, '')}</div>
    </div>
    <p class="small muted" style="margin-top:10px">Counts the sessions where you ticked each area. An area on both lists is one you’re actively working through.</p>
  </section>`
}

// ---------- Moves landed and caught by, by type ----------

function movesPanel() {
  const t = moveTrends(12)
  if (!t.landed && !t.caught) return `<section class="panel wide"><h2>Moves in your rolls</h2><p class="muted">Add the moves you used when you log a roll, and mark each one landed, tried or caught by. Your offense, control and defense trends show up here.</p></section>`
  const max = Math.max(1, ...[...t.topLanded, ...t.topCaught].map(x => x.n))
  const top = (list, cls, none) => list.length ? `<div class="bars">${list.map(x => `<div class="bar-row"><span>${esc(x.tech.name)}</span><div class="meter ${cls}"><span style="width:${x.n / max * 100}%"></span></div><span class="n">${x.n}</span></div>`).join('')}</div>` : `<p class="muted small">${none}</p>`
  return `<section class="panel wide" id="moves"><h2>Moves in your rolls</h2>
    <div class="trend-grid">
      <div><h3 style="margin-bottom:10px">Moves landed by month</h3>${t.months.some(m => m.counts.some(Boolean)) ? stackedBars(t.months, t.groups) : '<p class="muted small">Nothing landed in the last 12 months.</p>'}
        <p class="key" aria-hidden="true">${t.groups.map((g, i) => `<span><i class="g${i}"></i>${g}</span>`).join('')}</p></div>
      <div><h3 style="margin-bottom:10px">Landed vs caught by, per type</h3>${t.types.length ? butterfly(t.types) : '<p class="muted small">Log moves from the built-in library to see this.</p>'}</div>
      <div><h3 style="margin-bottom:10px">Most landed</h3>${top(t.topLanded, 'good', 'Nothing landed yet.')}</div>
      <div><h3 style="margin-bottom:10px">Most caught by</h3>${top(t.topCaught, '', 'Nobody has caught you with anything yet.')}</div>
    </div>
    <p class="small muted" style="margin-top:10px">Offensive is takedowns, sweeps, passes and submissions; control is control and transitions; defensive is escapes and retention. Older roll notes count their single move as landed when the roll worked.</p>
  </section>`
}

// ---------- Time of day and other training ----------

function timeOfDayPanel() {
  const timed = S.session.filter(s => s.time)
  if (!timed.length) return `<section class="panel"><h2>Morning or evening?</h2><p class="muted">Add the class time when you log. This panel then compares how your morning, afternoon and evening sessions go.</p></section>`
  const rows = ['Morning', 'Afternoon', 'Evening'].map(part => {
    const sessions = timed.filter(s => dayPart(s.time) === part)
    const ids = new Set(sessions.map(s => s.id)), rolls = S.roll.filter(r => ids.has(r.sessionId))
    const feels = sessions.filter(s => s.feel).map(s => FEELS.indexOf(s.feel) + 1)
    return { part, n: sessions.length, minutes: sum(sessions, 'minutes'), rate: rate(rolls), rolls: rolls.length, feel: feels.length ? sum(feels, x => x) / feels.length : null }
  }).filter(r => r.n)
  return `<section class="panel"><h2>Morning or evening?</h2><div class="table-scroll"><table>
    <thead><tr><th scope="col">Class time</th><th scope="col">Sessions</th><th scope="col">Mat hours</th><th scope="col">Roll success</th><th scope="col">Felt</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r.part}</td><td>${r.n}</td><td>${hrs(r.minutes)}</td><td>${r.rolls ? pct(r.rate) : '—'}</td><td>${r.feel ? FEELS[Math.round(r.feel) - 1] : '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin-top:10px">Morning is before noon, evening from 5 PM. ${plural(S.session.length - timed.length, 'session')} without a time aren’t counted.</p></section>`
}

// ---------- Energy, sleep and injuries ----------

function bodyPanel() {
  const { dims, findings, min } = bodyInsights()
  const used = dims.filter(d => d.tagged)
  if (!used.length) return `<section class="panel"><h2>Energy, sleep and injuries</h2><p class="muted">Tap your energy and sleep when you log training, and tag sessions you train around an injury. Once there’s enough, this panel shows whether they change how your rolls go.</p></section>`
  return `<section class="panel wide" id="body"><h2>Energy, sleep and injuries</h2>
    ${findings.length ? findings.map(f => `<div class="callout"><p class="insight">${esc(f.text)}</p><p class="small muted">${esc(f.detail)}</p></div>`).join('')
      : `<p class="muted">No clear pattern yet. A finding shows once a group has ${min.sessions}+ sessions and ${min.rolls}+ rolls on each side of the comparison, and the gap is bigger than chance would explain.</p>`}
    <div class="trend-grid" style="margin-top:14px">${used.map(d => `<div><h3 style="margin-bottom:8px">${esc(d.title)}</h3><table class="fit">
      <thead><tr><th scope="col">${esc(d.title)}</th><th scope="col">Sessions</th><th scope="col">Rolls</th><th scope="col">Broke down</th><th scope="col">Success</th></tr></thead>
      <tbody>${d.rows.map(r => `<tr><td>${esc(r.label)}</td><td>${r.sessions}</td><td>${r.rolls}</td><td>${r.rolls ? pct(r.broke / r.rolls) : '—'}</td><td>${pct(r.rate)}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">Only rolls logged with a session count. Injury-free means no injury was active in your log that day. A pattern here is a lead to test, not proof: tiredness, partners and what you were working on all move these numbers.</p>
  </section>`
}

function otherTrainingPanel() {
  const recent = S.activity.filter(a => a.date >= daysAgo(29))
  if (!S.activity.length) return `<section class="panel"><h2>Other training</h2><p class="muted">Log runs, lifting, yoga and recovery from the Journal with “Log other activity”. Totals show up here.</p></section>`
  const byType = ACTIVITY_TYPES.map(type => ({ type, minutes: sum(recent.filter(a => a.type === type), 'minutes'), n: recent.filter(a => a.type === type).length })).filter(x => x.n)
  const max = Math.max(1, ...byType.map(x => x.minutes))
  const mat = sum(S.session.filter(s => s.date >= daysAgo(29)), 'minutes'), other = sum(recent, 'minutes')
  return `<section class="panel"><h2>Other training, last 30 days</h2>
    <div class="figures">
      <div class="figure"><div class="big">${hrs(other)}</div><div class="lbl">hours outside BJJ</div></div>
      <div class="figure"><div class="big">${hrs(mat)}</div><div class="lbl">mat hours</div></div>
    </div>
    ${byType.length ? `<div class="bars" style="margin-top:12px">${byType.map(x => `<div class="bar-row"><span>${esc(x.type)}</span><div class="meter mat"><span style="width:${x.minutes / max * 100}%"></span></div><span class="n">${hrs(x.minutes)}h</span></div>`).join('')}</div>` : '<p class="muted">Nothing logged in the last 30 days.</p>'}
  </section>`
}

// ---------- Problem trends ----------

const TREND_LABEL = { fading: 'Fading', growing: 'Growing', new: 'New', steady: 'Steady', thin: 'Too few' }

function trendRows(list, describe) {
  const max = Math.max(0.01, ...list.flatMap(t => t.months.map(m => m.v || 0)))
  return list.map(t => `<div class="trend-row"><div class="lbl"><div>${esc(t.label)}</div><div class="chg">${t.state === 'thin' ? 'Too few rolls in the last 60 days to compare' : describe(t)}</div></div>${spark(t.months, max)}<span class="trend ${t.state}">${TREND_LABEL[t.state]}</span></div>`).join('')
}

function trendsPanel() {
  const { causes, spots } = problemTrends()
  if (!causes.length && !spots.length) return `<section class="panel wide"><h2>Problems over time</h2><p class="muted">When rolls go wrong, tick why. This panel then shows whether each problem is fading or growing.</p></section>`
  return `<section class="panel wide"><h2>Problems over time</h2>
    <p class="small muted" style="margin:-6px 0 14px">Bars show the last 6 months; the darkest is this month. The label compares the last 30 days with the 30 before.</p>
    <div class="trend-grid">
      <div><h3>Causes</h3><p class="small muted">Share of all logged rolls that went wrong for this reason</p>${causes.length ? trendRows(causes.slice(0, 8), t => `${pct(t.prev)} → ${pct(t.cur)} of rolls`) : '<p class="muted">No causes ticked yet.</p>'}</div>
      <div><h3>Problem spots</h3><p class="small muted">Share of rolls from that spot that went wrong</p>${trendRows(spots, t => `${pct(t.prev)} → ${pct(t.cur)} went wrong`)}</div>
    </div></section>`
}
