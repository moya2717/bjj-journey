import { S, allRecords, eraseEverything, removeMany, save, saveMany } from '../store.js'
import { ACTIVITY_TYPES, BELT_LOOK, FEELS, PLACES, POSITIONS, RANKS } from '../vocab.js'
import { $, byDateAsc, dayPart, daysAgo, esc, fmtDate, fmtMonthY, hrs, monthLabel, newId, pct, plural, rate, span, sum, toast, today, trunc, ym } from '../util.js'
import { field, selectEl, armDelete, openSheet, radioChips } from '../sheet.js'
import { ageDivision, currentRank, rankName } from '../model.js'
import { areaCounts, monthlySeries, moveTrends, problemTrends, weeklyStreak } from '../analysis.js'
import { butterfly, heatmap, lineChart, spark, stackedBars } from '../charts.js'
import { exportBackup, importBackup } from '../backup.js'
import { exampleRecords } from '../examples.js'
import { previewImport } from './importing.js'
import { addPhotos, hydratePhotos, photoURL, removePhotos } from '../photos.js'

export function view() {
  const month = ym(new Date()), thisMonth = S.session.filter(s => s.date.startsWith(month))
  const series = monthlySeries(6), from = daysAgo(89)
  const focus = {}, rolled = {}
  S.session.filter(s => s.date >= from).forEach(s => (s.focus || []).forEach(p => focus[p] = (focus[p] || 0) + 1))
  S.roll.filter(r => r.date >= from).forEach(r => rolled[r.position] = (rolled[r.position] || 0) + 1)
  const positions = POSITIONS.map(p => ({ p, f: focus[p] || 0, r: rolled[p] || 0, rate: rate(S.roll.filter(r => r.date >= from && r.position === p)) }))
    .filter(x => x.f || x.r).sort((a, b) => (b.f + b.r) - (a.f + a.r))
  const maxAttention = Math.max(1, ...positions.map(x => x.f + x.r))

  return `<h1 class="sr">Profile and stats</h1>
  <div class="stat-grid">
    ${profilePanel()}
    <h2 class="section-title wide">Training</h2>
    <section class="panel wide"><h2>Consistency</h2>
      <div class="figures">
        <div class="figure"><div class="big">${thisMonth.length}</div><div class="lbl">sessions this month</div></div>
        <div class="figure"><div class="big">${hrs(sum(thisMonth, 'minutes'))}</div><div class="lbl">mat hours this month</div></div>
        <div class="figure"><div class="big">${weeklyStreak()}</div><div class="lbl">week streak at ${S.settings.weeklyTarget || 3}+ sessions</div></div>
        <div class="figure"><div class="big">${hrs(sum(S.session, 'minutes'))}</div><div class="lbl">mat hours logged in total</div></div>
      </div>
      ${heatmap(26)}
    </section>
    <section class="panel"><h2>Roll success by month</h2>${series.some(s => s.rate != null) ? lineChart(series, { w: 420, h: 170 }) : '<p class="muted">Log rolls to see this trend.</p>'}</section>
    <section class="panel"><h2>Where your attention went, last 90 days</h2>
      ${positions.length ? `<div class="bars">${positions.slice(0, 8).map(x => `<div class="bar-row"><span>${esc(x.p)}</span><div class="meter mat"><span style="width:${(x.f + x.r) / maxAttention * 100}%"></span></div><span class="n">${x.f + x.r}</span></div>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">Counts session focus plus roll notes from each position.</p>` : '<p class="muted">Nothing logged in the last 90 days.</p>'}
    </section>
    <h2 class="section-title wide">Your game</h2>
    ${areasPanel()}
    ${movesPanel()}
    ${timeOfDayPanel()}
    ${otherTrainingPanel()}
    ${trendsPanel()}
    <section class="panel wide"><h2>Month by month</h2><div class="table-scroll"><table>
      <thead><tr><th scope="col">Month</th><th scope="col">Sessions</th><th scope="col">Mat hours</th><th scope="col">Rolls logged</th><th scope="col">Broke down</th><th scope="col">Success</th></tr></thead>
      <tbody>${series.slice().reverse().map(s => `<tr><td>${monthLabel(s.m)}</td><td>${s.sessions}</td><td>${hrs(s.minutes)}</td><td>${s.n}</td><td>${s.broke}</td><td>${pct(s.rate)}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <h2 class="section-title wide">Settings</h2>
    ${dataPanel()}
  </div>`
}

export function mount(root) {
  hydratePhotos(root)
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
  const wins = sum(P.tournaments, 'wins'), losses = sum(P.tournaments, 'losses')
  const medals = place => P.tournaments.filter(t => t.place === place).length
  const sinceRank = S.session.filter(s => !rank.since || s.date >= rank.since)
  const initials = (P.name || 'You').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const tiles = [
    [P.startDate ? span(P.startDate) : '—', 'training'],
    [S.session.length, plural(S.session.length, 'session').replace(/^\d+ /, '')],
    [hrs(sum(S.session, 'minutes')), 'mat hours'],
    [`${wins}–${losses}`, 'match record'],
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
    <div class="fc-body">
      ${taleOfTheTape(P, rank, sinceRank)}
      ${P.goal ? `<p class="profile-goal">“${esc(P.goal)}”</p>` : ''}
      ${medals('Gold') + medals('Silver') + medals('Bronze') ? `<div class="fc-medals">${[['Gold', 'gold'], ['Silver', 'silver'], ['Bronze', 'bronze']].filter(([k]) => medals(k)).map(([k, c]) => `<span class="medal ${c}">${medals(k)} × ${k}</span>`).join('')}</div>` : ''}
    </div>
  </section>
  ${rankPanel(P)}
  ${tournamentPanel(P)}`
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
  return `<section class="panel"><div class="history-head"><h2 style="margin:0">Competition</h2><button class="btn sm ghost" data-act="new-comp">Add tournament</button></div>
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
  return `<section class="panel wide"><h2>Moves in your rolls</h2>
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

// ---------- Settings and data ----------

function dataPanel() {
  const last = S.settings.lastBackup, hasExamples = allRecords().some(r => r.example)
  return `<section class="panel wide"><h2>Settings and backups</h2>
    <label class="setting"><span>Weekly session target</span><input type="number" id="weekly-target" min="1" max="14" inputmode="numeric" value="${esc(S.settings.weeklyTarget || 3)}"></label>
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
