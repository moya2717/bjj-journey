// Athlete profile: who you are, how much you're training, your running, and what Home shows.
// The first screen under You: the fighter card, then tiles that open each part as a sub-screen.
import { S, allRecords, eraseEverything, removeMany, save, saveMany } from '../store.js'
import { UI } from '../ui.js'
import { BELT_LOOK, RANKS } from '../vocab.js'
import { $, $$, byDateAsc, esc, fmtDate, fmtMonthY, hrs, newId, pct, plural, span, sum, toast, today, trunc, ym } from '../util.js'
import { field, selectEl, armDelete, openSheet, radioChips } from '../sheet.js'
import { ageDivision, currentRank, isSimple, logMode, rankName } from '../model.js'
import { bodyInsights, gameMap, moveTrends, weeklyStreak } from '../analysis.js'
import { radar, stackedBars, trendLine } from '../charts.js'
import { advancedRow, fold, modeLink, subHead, subOf, tile } from './hub.js'
import { statTile } from './stats.js'
import { exportBackup, importBackup } from '../backup.js'
import { exampleRecords } from '../examples.js'
import { previewImport } from './importing.js'
import { addPhotos, hydratePhotos, photoURL, removePhotos } from '../photos.js'
import { activeInjuries, injuryName } from '../body.js'
import { goalsPanel } from './goals.js'
import { goalStatus } from '../goals.js'
import { LOAD_TYPES, distIn, loadAll, distUnit, fmtClock, fmtDist, loadMonths, loadTrend, loadWeeks, paceOf, runStats, runs } from '../load.js'

// The fighter card, then a tile per part of your profile. Each tile opens its panel as a
// sub-screen; the stats tiles open the same sub-screens under Stats. Simple mode keeps the card,
// your game map and the parts you fill in yourself.
export function view() {
  const sub = SUBS[subOf('athlete')]
  if (sub) return `<h1 class="sr">Athlete profile</h1>${subHead(sub[0], 'Profile')}<div class="stat-grid">${sub[1]()}</div>`
  const rank = currentRank(), P = S.profile, rec = [sum(P.tournaments, 'wins'), sum(P.tournaments, 'losses')], last = S.settings.lastBackup
  return `<h1 class="sr">Athlete profile</h1>
  ${profilePanel()}
  <div class="dojo-tiles">
    ${isSimple() ? statTile('radar', 'stats') : statTile('load') + statTile('runs') + ['radar', 'moves', 'body', 'problems', 'time'].map(k => statTile(k, 'stats')).join('')}
    ${tile('belts', 'Belt history', P.promotions.length ? `${esc(rank.belt)}` : '—', P.promotions.length ? `${plural(rank.stripes, 'stripe')} · ${rank.since ? span(rank.since) : ''}` : 'add your belt')}
    ${tile('goals', 'Challenges', S.goal.length ? `${S.goal.filter(g => goalStatus(g).state === 'done').length}/${S.goal.length}` : '—', S.goal.length ? 'done' : 'set a target')}
    ${tile('comp', 'Competition', P.tournaments.length ? `${rec[0]}–${rec[1]}` : '—', P.tournaments.length ? plural(P.tournaments.length, 'event') : 'add a tournament')}
    ${tile('settings', 'Settings', isSimple() ? 'Simple' : 'Advanced', last ? `backed up ${fmtDate(last)}` : 'no backup yet', { cls: last ? '' : 'warn' })}
  </div>
  ${advancedRow()}
  ${modeLink()}`
}

const SUBS = {
  load: ['Training load', () => loadPanel()],
  runs: ['Running', () => runsPanel()],
  belts: ['Belt history', () => rankPanel(S.profile)],
  goals: ['Challenges', () => goalsPanel()],
  comp: ['Competition', () => tournamentPanel(S.profile)],
  settings: ['Settings and backups', () => widgetPanel() + dataPanel()],
}

// Up is good unless lower is better (pace).
const delta = (now, before, lowerIsBetter) => now == null || before == null || now === before ? ''
  : `<span class="${(lowerIsBetter ? now < before : now > before) ? 'delta-up' : 'delta-down'}" aria-hidden="true">${now > before ? '▲' : '▼'}</span>`
const figure = (big, lbl) => `<div class="figure"><div class="big">${big}</div><div class="lbl">${lbl}</div></div>`
const signedPct = x => x == null ? '—' : (x > 0 ? '+' : '') + Math.round(x * 100) + '%'

// ---------- Training load ----------

function loadPanel() {
  if (!S.session.length && !S.activity.length) return `<section class="panel wide" id="load"><h2>Training load</h2><p class="muted">Log BJJ sessions. Your weekly and monthly load, and how this week compares with your usual, show up here.</p></section>`
  const by = UI.loadBy || 'week', all = loadAll(), t = loadTrend(), periods = by === 'week' ? loadWeeks(8) : loadMonths(6), [mat, run, other] = periods.at(-1).minutes
  const types = all ? LOAD_TYPES : LOAD_TYPES.slice(0, 1)
  return `<section class="panel wide" id="load">
    <div class="history-head"><h2>Training load</h2><div class="seg" role="group" aria-label="Show load by">${['week', 'month'].map(k => `<button data-act="load-by" data-by="${k}" aria-pressed="${by === k}">By ${k}</button>`).join('')}</div></div>
    <div class="seg load-view" role="group" aria-label="What counts as load">${[['', 'BJJ only'], ['all', 'All training (incl. runs & other)']].map(([k, l]) => `<button data-act="load-view" data-k="${k}" aria-pressed="${all === !!k}">${l}</button>`).join('')}</div>
    <div class="figures tight">
      ${figure(t.now, 'load this week')}
      ${figure(Math.round(t.avg), 'weekly average, last 4 weeks')}
      ${figure(`${signedPct(t.wow)} ${delta(t.last, t.before)}`, 'last week vs the one before')}
    </div>
    ${t.spike ? `<div class="callout warn"><p><strong>Big jump this week.</strong> You’re at ${pct(t.ratio)} of your 4-week average. Load spikes over about 40% are when niggles tend to start, so an easier day or two could pay off.</p></div>` : ''}
    ${stackedBars(periods.map(p => ({ label: p.label, counts: p.load.slice(0, types.length) })), types, { what: all ? 'Training load' : 'BJJ training load', by, classes: ['l0', 'l1', 'l2'] })}
    ${all ? `<p class="key" aria-hidden="true">${LOAD_TYPES.map((g, i) => `<span><i class="l${i}"></i>${g}</span>`).join('')}</p>` : ''}
    <p class="small muted" style="margin-top:8px">This ${by}: ${hrs(mat)} hrs on the mat, ${hrs(run)} hrs running, ${hrs(other)} hrs other${all ? '' : '. Runs and other training are tracked but not counted in this load'}.</p>
    <details class="explain"><summary>How load is counted</summary><p class="small muted">Load is minutes × effort on a 1–10 scale. BJJ classes count as 6, open mats 7, privates 5, drilling 4 and competition 9. Runs and activities use the effort you logged (easy 3, moderate 5, hard 7) and count only with “All training”. Readiness on Home always includes them.</p></details>
  </section>`
}

// ---------- Running ----------

function runsPanel() {
  const r = runStats(), u = r.unit
  const head = `<div class="history-head"><h2>Running</h2><button class="btn sm" data-act="new-run">Log a run</button></div>`
  if (!r.n) return `<section class="panel wide" id="runs">${head}<p class="muted">Log runs with distance and time. Your weekly and monthly distance, pace trend and longest run show up here.</p></section>`
  const paces = r.weeks.map(w => ({ label: w.label, v: w.pace }))
  const recent = runs().slice(-4).reverse()
  return `<section class="panel wide" id="runs">${head}
    <div class="figures tight">
      ${figure(`${fmtDist(r.week.dist)}<small> ${u}</small>`, `this week, ${hrs(r.week.minutes)} hrs`)}
      ${figure(`${fmtDist(r.month.dist)}<small> ${u}</small>`, `this month, ${plural(r.month.n, 'run')}`)}
      ${figure(`${fmtClock(r.pace30)} ${delta(r.pace30, r.pacePrev, true)}`, `average pace per ${u}, last 30 days`)}
      ${r.longest ? figure(`${fmtDist(distIn(r.longest, u))}<small> ${u}</small>`, `longest run, ${fmtDate(r.longest.date)}`) : ''}
    </div>
    <div class="trend-grid" style="margin-top:12px">
      <div><h3>Distance per week</h3>${stackedBars(r.weeks, [u], { what: `Run distance in ${u}`, by: 'week', classes: ['l1'] })}</div>
      <div><h3>Average pace per week</h3>${paces.filter(p => p.v != null).length > 1 ? trendLine(paces, { fmt: fmtClock, what: `Average pace per ${u}` }) + '<p class="small muted">Lower is faster.</p>' : '<p class="muted small">Log runs in two or more weeks to see a trend.</p>'}</div>
    </div>
    <h3 style="margin-top:14px">Recent runs</h3>
    <ul class="list run-list">${recent.map(a => `<li><button class="run-row" data-act="edit-activity" data-id="${a.id}" aria-label="Edit run on ${esc(fmtDate(a.date))}">
      <span class="run-date">${fmtDate(a.date)}</span>
      <span>${a.distance ? `${fmtDist(+a.distance)} ${esc(a.unit || 'mi')}` : '—'}</span><span>${+a.minutes ? fmtClock(+a.minutes) : '—'}</span>
      <span class="muted">${paceOf(+a.minutes, +a.distance) ? fmtClock(paceOf(+a.minutes, +a.distance)) + '/' + esc(a.unit || 'mi') : ''}</span></button></li>`).join('')}</ul>
  </section>`
}

// ---------- Cards you can also put on Home ----------

const card = (view, anchor, label, num, sub, cls = '') => `<button class="widget ${cls}" data-act="goto" data-view="${view}" data-anchor="${anchor}">
  <span class="w-lbl">${label}</span>${num === '' ? '' : `<span class="w-num">${num}</span>`}<span class="w-sub">${sub}</span></button>`

export const WIDGETS = {
  load: ['Weekly load', () => { const t = loadTrend(); return card('athlete', 'load', loadAll() ? 'Training load' : 'BJJ load', t.now, t.ratio == null ? 'this week so far' : `${pct(t.ratio)} of your 4-week average`, t.spike ? 'warn' : '') }],
  runs: ['Run distance', () => { const r = runStats(); return card('athlete', 'runs', 'Running', `${fmtDist(r.week.dist)}<small> ${r.unit}</small>`, `this week, ${fmtDist(r.month.dist)} ${r.unit} this month`) }],
  streak: ['Streak', () => card('athlete', '', 'Streak', plural(weeklyStreak(), 'week'), `in a row at ${S.settings.weeklyTarget || 3}+ sessions`)],
  mat: ['Mat hours', () => { const m = S.session.filter(s => s.date.startsWith(ym(new Date()))); return card('journal', '', 'Mat hours', hrs(sum(m, 'minutes')), `this month, ${plural(m.length, 'session')}`) }],
  injuries: ['Active injuries', () => { const hurt = activeInjuries(); return card('injuries', '', 'Injuries', hurt.length || 'None', hurt.length ? esc(trunc(hurt.map(injuryName).join(', '), 40)) : 'nothing active right now', hurt.length ? 'hurt' : '') }],
  moves: ['Moves landed', () => { const t = moveTrends(12), n = sum(t.months.at(-1)?.counts || [], x => x); return card('stats', 'moves', 'Moves landed', n, t.topLanded[0] ? `this month. Most landed: ${esc(trunc(t.topLanded[0].tech.name, 24))}` : 'this month') }],
  radar: ['Game map', () => { const g = gameMap(), best = [...g.axes].sort((a, b) => b.v - a.v)[0]
    return `<button class="widget radar-widget" data-act="goto" data-view="stats" data-anchor="radar">${radar(g.axes, { mini: true })}<span><span class="w-lbl">Game map</span><span class="w-sub">${g.empty ? 'Log moves to grow it' : `Strongest: ${esc(best.label.toLowerCase())}`}</span></span></button>` }],
  sleep: ['Sleep and energy', () => { const f = bodyInsights().findings[0]; return card('stats', 'body', 'Sleep and energy', '', f ? esc(f.text) : 'No clear pattern yet. Tag energy and sleep when you log.', 'text') }],
}
// Until you pick, Simple mode shows your streak and game map on Home.
export const homeWidgets = () => (S.settings.homeWidgets || (isSimple() ? ['streak', 'radar'] : ['load', 'runs', 'streak', 'injuries'])).filter(k => WIDGETS[k])
const ESSENTIAL = ['streak', 'mat', 'radar', 'moves']

// Simple mode lists the essential cards first and folds the rest under More.
function widgetPanel() {
  const on = homeWidgets(), chip = k => `<label class="chip"><input type="checkbox" value="${k}" ${on.includes(k) ? 'checked' : ''}><span>${WIDGETS[k][0]}</span></label>`
  const rest = Object.keys(WIDGETS).filter(k => !ESSENTIAL.includes(k))
  return `<section class="panel wide" id="widgets"><h2>Show on Home</h2>
    <p class="small muted" style="margin:-6px 0 10px">Pick the cards that appear on Home under “This week”.</p>
    <div id="home-widgets">${isSimple()
      ? `<div class="chips">${ESSENTIAL.map(chip).join('')}</div>${fold('widgets-more', `<span>More <span class="small muted">${rest.filter(k => on.includes(k)).length} on</span></span>`, `<div class="chips">${rest.map(chip).join('')}</div>`)}`
      : `<div class="chips">${Object.keys(WIDGETS).map(chip).join('')}</div>`}</div>
  </section>`
}

export function mount(root) {
  hydratePhotos(root)
  $('#home-widgets')?.addEventListener('change', () => save({ ...S.settings, homeWidgets: $$('#home-widgets input:checked').map(i => i.value) }))
  $('#dist-unit')?.addEventListener('change', e => save({ ...S.settings, distUnit: e.target.value }))
  $('#theme')?.addEventListener('change', e => save({ ...S.settings, theme: e.target.value }))
  $('#app-mode')?.addEventListener('change', e => save({ ...S.settings, mode: e.target.value }))
  $('#log-mode')?.addEventListener('change', e => save({ ...S.settings, logMode: e.target.value }))
  $('#weekly-target')?.addEventListener('change', e => save({ ...S.settings, weeklyTarget: Math.max(1, Math.min(14, parseInt(e.target.value, 10) || 3)) }))
  $('#import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const n = await importBackup(file)
      toast(n.records ? `Restored ${plural(n.records, 'entry', 'entries')}${n.photos ? ` and ${plural(n.photos, 'photo')}` : ''}` : 'That file has no journal entries.')
    } catch { toast('That file isn’t a journal backup.') }
  })
  $('#other-app-file')?.addEventListener('change', async e => {
    const files = [...e.target.files]
    e.target.value = ''
    if (files.length) previewImport(files)
  })
}

// ---------- Fighter profile ----------

// The fighter card: your belt as a banner, the numbers that matter, and a tale of the tape.
function profilePanel() {
  const P = S.profile, rank = currentRank(), look = BELT_LOOK[rank.belt] || BELT_LOOK.White
  const medals = place => P.tournaments.filter(t => t.place === place).length
  const sinceRank = S.session.filter(s => !rank.since || s.date >= rank.since)
  const initials = (P.name || 'You').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const tiles = [
    [P.startDate ? span(P.startDate) : '—', 'training'],
    [weeklyStreak(), 'week streak'],
    [S.session.length, plural(S.session.length, 'session').replace(/^\d+ /, '')],
    [hrs(sum(S.session, 'minutes')), 'mat hours'],
  ]
  return `<section class="fighter-card wide" aria-labelledby="fp-h" style="--fc-belt:${look.belt};--fc-ink:${look.ink};--fc-muted:${look.muted};--fc-bar:${look.bar}">
    <div class="fc-banner">
      <div class="fc-bar" aria-hidden="true">${'<i></i>'.repeat(Math.min(4, rank.stripes))}</div>
      <button class="btn sm fc-edit" data-act="edit-profile">${P.createdAt ? 'Edit' : 'Set up profile'}</button>
      <div class="fc-id">
        ${P.photo ? `<button class="fc-avatar" data-act="view-photo" data-id="${P.photo}" aria-label="Open profile photo"><img data-photo="${P.photo}" alt=""></button>` : `<button class="fc-avatar fc-initials" data-act="edit-profile" aria-label="Add a profile photo">${esc(initials)}</button>`}
        <div class="fc-names">
          <h2 id="fp-h">${esc(P.name || 'Your name')}</h2>
          <p>${esc(rankName(rank))}</p>
          ${P.gym || P.team ? `<p class="fc-gym">${esc([P.gym, P.team].filter(Boolean).join(' · '))}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="fc-tiles">${tiles.map(([v, l]) => `<div><span class="fc-num">${esc(v)}</span><span class="fc-lbl">${esc(l)}</span></div>`).join('')}</div>
    ${fold('tape', '<b>Tale of the tape</b>' + (P.goal ? `<span class="small muted fold-peek">“${esc(P.goal)}”</span>` : ''), `<div class="fc-body">
      ${taleOfTheTape(P, rank, sinceRank)}
      ${P.goal ? `<p class="profile-goal">“${esc(P.goal)}”</p>` : ''}
      ${medals('Gold') + medals('Silver') + medals('Bronze') ? `<div class="fc-medals">${[['Gold', 'gold'], ['Silver', 'silver'], ['Bronze', 'bronze']].filter(([k]) => medals(k)).map(([k, c]) => `<span class="medal ${c}">${medals(k)} × ${k}</span>`).join('')}</div>` : ''}
    </div>`)}
  </section>`
}

// Like the stat comparison before a fight: only what you've filled in.
function taleOfTheTape(P, rank, sinceRank) {
  const age = ageDivision(P.birthday)
  const rows = [
    ['Age', age && `${age.age} · ${age.label}`],
    ['Height', P.height], ['Weight', [P.weight, P.weightClass].filter(Boolean).join(' · ')],
    ['Plays', P.game], ['Coach', P.coach],
    ['Training since', P.startDate && fmtMonthY(P.startDate)],
    ['At this rank', rank.since && `${span(rank.since)} · ${plural(sinceRank.length, 'session')}, ${hrs(sum(sinceRank, 'minutes'))} hrs`],
  ].filter(([, v]) => v)
  return `<div class="tape"><h3>Tale of the tape</h3>
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
    ${rows.length < 4 ? `<p class="small muted">Add your birthday, weight, height and coach in <button class="link" data-act="edit-profile">Edit profile</button> to fill this in.</p>` : ''}</div>`
}

function rankPanel(P) {
  const promotions = [...P.promotions].sort(byDateAsc).reverse()
  return `<section class="panel"><div class="history-head"><h2 style="margin:0">Rank history</h2><button class="btn sm ghost" data-act="new-promo">Add promotion</button></div>
    ${promotions.length ? `<ol class="rank-line">${promotions.map((p, i) => {
      const look = BELT_LOOK[p.belt] || BELT_LOOK.White
      return `<li class="${i === 0 ? 'current' : ''}">
        <span class="mini-belt" style="background:${look.belt}" aria-hidden="true"><span style="background:${look.bar}">${'<i></i>'.repeat(Math.min(4, +p.stripes || 0))}</span></span>
        <div class="what"><strong>${esc(rankName(p))}</strong><span class="small muted">${fmtMonthY(p.date)}${promotions[i + 1] ? ` · after ${span(promotions[i + 1].date, p.date)}` : ''}${i === 0 ? ' · current' : ''}</span>
          ${p.note ? `<p class="small muted">${esc(p.note)}</p>` : ''}</div>
        <button class="mini" data-act="edit-promo" data-id="${p.id}">Edit</button></li>`
    }).join('')}</ol>` : '<p class="muted small" style="margin-top:8px">Add each belt and stripe with its date. Your header and fighter card take your belt color, and time at each rank shows here.</p>'}
  </section>`
}

function tournamentPanel(P) {
  const tournaments = [...P.tournaments].sort(byDateAsc).reverse()
  return `<section class="panel"><div class="history-head"><h2 style="margin:0">Competition${P.tournaments.length ? ` <span class="muted small">${sum(P.tournaments, 'wins')}–${sum(P.tournaments, 'losses')}</span>` : ''}</h2><button class="btn sm ghost" data-act="new-comp">Add tournament</button></div>
    ${tournaments.length ? `<div class="stack" style="margin-top:10px">${tournaments.map(t => `<div class="comp-row">
      <span class="medal-dot ${t.place && t.place !== 'No medal' ? esc(t.place.toLowerCase()) : ''}" aria-hidden="true">${t.place === 'Gold' ? '1' : t.place === 'Silver' ? '2' : t.place === 'Bronze' ? '3' : '–'}</span>
      <div class="what"><strong>${esc(t.name)}</strong><span class="small muted">${fmtMonthY(t.date)}${t.division ? ` · ${esc(t.division)}` : ''} · ${+t.wins || 0}–${+t.losses || 0}</span></div>
      <button class="mini" data-act="edit-comp" data-id="${t.id}">Edit</button></div>`).join('')}</div>`
      : '<p class="muted small" style="margin-top:8px">Log each event with your division, your record and the main lesson. Plan the next one under You → Compete.</p>'}
  </section>`
}

const saveProfile = patch => save({ ...S.profile, ...patch, id: 'profile_main', kind: 'profile', example: false })

const GAMES = ['Gi', 'No-gi', 'Both']

function profileForm() {
  const P = S.profile, rank = currentRank()
  let newPhoto = null
  openSheet(P.createdAt ? 'Edit profile' : 'Set up your profile', `
    <div class="fighter-id"><span class="avatar" id="pf-avatar">${P.photo ? '<img alt="" id="pf-img">' : ''}</span>
      <label class="btn sm ghost file-btn">${P.photo ? 'Change photo' : 'Add a photo'}<input type="file" id="pf-file" accept="image/*"></label></div>
    ${field('Name', `<input type="text" name="name" id="pf-name" value="${esc(P.name)}" placeholder="What your training partners call you">`)}
    <div class="grid2">
      ${field('Academy', `<input type="text" name="gym" id="pf-gym" value="${esc(P.gym)}" placeholder="Where you train">`)}
      ${field('Team or affiliation', `<input type="text" name="team" id="pf-team" value="${esc(P.team || '')}" placeholder="Association your gym belongs to">`)}
    </div>
    <div class="grid2">
      ${field('Coach', `<input type="text" name="coach" id="pf-coach" value="${esc(P.coach || '')}" placeholder="Head instructor">`)}
      ${field('Started training', `<input type="date" name="startDate" id="pf-start" value="${esc(P.startDate)}">`)}
    </div>
    <fieldset><legend>Current rank</legend><div class="grid3">
      ${field('Belt', selectEl('belt', RANKS, rank.belt, 'id="pf-belt"'))}
      ${field('Stripes', selectEl('stripes', ['0', '1', '2', '3', '4'], String(rank.stripes), 'id="pf-stripes"'))}
      ${field('Since', `<input type="date" name="since" id="pf-since" value="${esc(rank.since || today())}">`)}
    </div><p class="hint">Changing your belt or stripes here adds a promotion to your history.</p></fieldset>
    <div class="grid3">
      ${field('Birthday', `<input type="date" name="birthday" id="pf-bday" value="${esc(P.birthday || '')}">`)}
      ${field('Body weight', `<input type="text" name="weight" id="pf-weight" value="${esc(P.weight || '')}" placeholder="170 lb">`)}
      ${field('Height', `<input type="text" name="height" id="pf-height" value="${esc(P.height || '')}" placeholder="5 ft 10">`)}
    </div>
    <div class="grid2">
      ${field('Weight class', `<input type="text" name="weightClass" id="pf-class" value="${esc(P.weightClass || '')}" placeholder="Medium heavy">`)}
      <fieldset><legend>You train</legend>${radioChips('game', GAMES, P.game || '')}</fieldset>
    </div>
    ${field('Long-term goal', `<textarea name="goal" id="pf-goal" rows="2" placeholder="Earn my purple belt and compete at Pans">${esc(P.goal || '')}</textarea>`)}`, {
    submitLabel: 'Save profile',
    onMount: async form => {
      // A new rank starts today unless you pick another date.
      const since = form.querySelector('#pf-since')
      ;['#pf-belt', '#pf-stripes'].forEach(sel => form.querySelector(sel).addEventListener('change', () => {
        const changed = form.elements.belt.value !== rank.belt || +form.elements.stripes.value !== rank.stripes
        since.value = changed ? today() : rank.since || today()
      }))
      if (P.photo) form.querySelector('#pf-img').src = await photoURL(P.photo)
      form.querySelector('#pf-file').addEventListener('change', e => {
        newPhoto = e.target.files[0] || null
        if (newPhoto) form.querySelector('#pf-avatar').innerHTML = `<img alt="" src="${URL.createObjectURL(newPhoto)}">`
      })
    },
    onSubmit: async fd => {
      const patch = {}
      ;['name', 'gym', 'team', 'coach', 'startDate', 'birthday', 'weight', 'height', 'weightClass', 'goal'].forEach(k => patch[k] = (fd.get(k) || '').trim())
      patch.game = fd.get('game') || ''
      if (newPhoto) {
        const [id] = await addPhotos([newPhoto])
        if (id) { if (P.photo) removePhotos([P.photo]); patch.photo = id }
      }
      const belt = fd.get('belt'), stripes = +fd.get('stripes') || 0
      if (belt !== rank.belt || stripes !== rank.stripes) {
        patch.promotions = [...S.profile.promotions, { id: newId('promo'), date: fd.get('since') || today(), belt, stripes, note: '' }]
      }
      saveProfile(patch)
      toast('Profile saved')
    },
  })
}

function promotionForm(id) {
  const rank = currentRank()
  const p = id ? S.profile.promotions.find(x => x.id === id) : { date: today(), belt: rank.belt, stripes: Math.min(4, rank.stripes + (S.profile.promotions.length ? 1 : 0)), note: '' }
  if (!p) return
  openSheet(id ? 'Edit promotion' : 'Add a promotion', `
    <div class="grid3">${field('Date', `<input type="date" name="date" id="pr-date" value="${esc(p.date)}" required>`)}${field('Belt', selectEl('belt', RANKS, p.belt))}${field('Stripes', selectEl('stripes', ['0', '1', '2', '3', '4'], String(p.stripes || 0)))}</div>
    ${field('Note', `<textarea name="note" id="pr-note" rows="2" placeholder="Who promoted you, what you’d been working on, how it felt">${esc(p.note)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Add promotion',
    onDelete: id ? () => saveProfile({ promotions: S.profile.promotions.filter(x => x.id !== id) }) : null,
    onSubmit: fd => {
      if (!fd.get('date')) { $('#form-error').textContent = 'Add the date of the promotion.'; return false }
      const rec = { ...p, id: id || newId('promo'), date: fd.get('date'), belt: fd.get('belt'), stripes: +fd.get('stripes') || 0, note: fd.get('note').trim() }
      saveProfile({ promotions: id ? S.profile.promotions.map(x => x.id === id ? rec : x) : [...S.profile.promotions, rec] })
      toast(id ? 'Promotion saved' : 'Congratulations. Promotion added')
    },
  })
}
// ---------- Settings and data ----------

function dataPanel() {
  const last = S.settings.lastBackup, hasExamples = allRecords().some(r => r.example)
  return `<section class="panel wide"><h2>Settings and backups</h2>
    <div class="settings-list">
      <label class="setting"><span>Mode <span class="hint">Simple shows the essentials; Advanced adds every chart and analysis. Nothing is deleted either way.</span></span>${selectEl('', [{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }], isSimple() ? 'simple' : 'advanced', 'id="app-mode"')}</label>
      <label class="setting"><span>Log form <span class="hint">Simple asks for a note; Detailed adds plans, drills and rolls move by move</span></span>${selectEl('', [{ value: 'simple', label: 'Simple' }, { value: 'detailed', label: 'Detailed' }], logMode(), 'id="log-mode"')}</label>
      <label class="setting"><span>Weekly session target</span><input type="number" id="weekly-target" min="1" max="14" inputmode="numeric" value="${esc(S.settings.weeklyTarget || 3)}"></label>
      <label class="setting"><span>Run distances in</span>${selectEl('', [{ value: 'mi', label: 'Miles' }, { value: 'km', label: 'Kilometers' }], distUnit(), 'id="dist-unit"')}</label>
      <label class="setting"><span>Look</span>${selectEl('', [{ value: '', label: 'Match my phone' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], S.settings.theme || '', 'id="theme"')}</label>
    </div>
    <p class="small muted" style="margin-top:10px;max-width:70ch">Your journal lives only on this device and works without internet. Nobody else can see it. Back it up now and then: on iPhone, choose “Save to Files” so it lands in iCloud Drive. ${last ? `Last backup: ${fmtDate(last)}.` : '<strong>No backup yet.</strong>'}</p>
    <div class="data-actions">
      <button class="btn sm" data-act="export">Back up now</button>
      <label class="btn ghost sm file-btn">Restore from a backup<input type="file" id="import-file" accept="application/json,.json,.zip,application/zip"></label>
      <label class="btn ghost sm file-btn">Import from another app<input type="file" id="other-app-file" multiple accept=".csv,.tsv,.txt,.json,text/csv,application/json"></label>
      ${hasExamples ? '<button class="btn ghost sm" data-act="remove-examples">Remove example entries</button>' : '<button class="btn ghost sm" data-act="load-examples">Load example entries</button>'}
      <button class="btn danger sm" data-act="clear-all">Delete everything</button>
    </div>
  </section>`
}
export const actions = {
  'edit-profile': () => profileForm(),
  'load-by': el => { UI.loadBy = el.dataset.by },
  'load-view': el => { save({ ...S.settings, loadView: el.dataset.k }) },
  'new-promo': () => promotionForm(),
  'edit-promo': el => promotionForm(el.dataset.id),
  'export': async () => { try { if (await exportBackup()) toast('Backup ready') } catch { toast('Couldn’t make the backup. Try again.') } },
  'load-examples': async () => { await saveMany(exampleRecords()); toast('Example entries added. Remove them here when you’re ready.') },
  // Returning false keeps the button on screen so the second tap can confirm.
  'remove-examples': async el => {
    if (!armDelete(el, () => {})) return false
    await removeMany(allRecords().filter(r => r.example))
    toast('Example entries removed')
  },
  'clear-all': async el => {
    if (!armDelete(el, () => {})) return false
    await eraseEverything()
    toast('Everything deleted')
  },
}
