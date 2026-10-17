import { S, allRecords, eraseEverything, removeMany, save, saveMany } from '../store.js'
import { BELT_LOOK, PLACES, POSITIONS, RANKS } from '../vocab.js'
import { $, byDateAsc, daysAgo, esc, fmtDate, fmtMonthY, hrs, monthLabel, newId, pct, plural, rate, span, sum, toast, today, trunc, ym } from '../util.js'
import { field, selectEl, armDelete, openSheet } from '../sheet.js'
import { currentRank, rankName } from '../model.js'
import { monthlySeries, problemTrends, weeklyStreak } from '../analysis.js'
import { beltArt, heatmap, lineChart, spark } from '../charts.js'
import { exportBackup, importBackup } from '../backup.js'
import { exampleRecords } from '../examples.js'
import { readOtherApp } from '../importer.js'

export function view() {
  const month = ym(new Date()), thisMonth = S.session.filter(s => s.date.startsWith(month))
  const series = monthlySeries(6), from = daysAgo(89)
  const focus = {}, rolled = {}
  S.session.filter(s => s.date >= from).forEach(s => (s.focus || []).forEach(p => focus[p] = (focus[p] || 0) + 1))
  S.roll.filter(r => r.date >= from).forEach(r => rolled[r.position] = (rolled[r.position] || 0) + 1)
  const positions = POSITIONS.map(p => ({ p, f: focus[p] || 0, r: rolled[p] || 0, rate: rate(S.roll.filter(r => r.date >= from && r.position === p)) }))
    .filter(x => x.f || x.r).sort((a, b) => (b.f + b.r) - (a.f + a.r))
  const maxAttention = Math.max(1, ...positions.map(x => x.f + x.r))

  return `<div class="page-head"><div><h1>Stats</h1><p class="lede">Your rank and competition history, mat time, consistency, and where your attention has gone.</p></div></div>
  <div class="stat-grid">
    ${profilePanel()}
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
    ${trendsPanel()}
    <section class="panel wide"><h2>Month by month</h2><div class="table-scroll"><table>
      <thead><tr><th scope="col">Month</th><th scope="col">Sessions</th><th scope="col">Mat hours</th><th scope="col">Rolls logged</th><th scope="col">Broke down</th><th scope="col">Success</th></tr></thead>
      <tbody>${series.slice().reverse().map(s => `<tr><td>${monthLabel(s.m)}</td><td>${s.sessions}</td><td>${hrs(s.minutes)}</td><td>${s.n}</td><td>${s.broke}</td><td>${pct(s.rate)}</td></tr>`).join('')}</tbody></table></div>
    </section>
    ${dataPanel()}
  </div>`
}

export function mount() {
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
    const file = e.target.files[0]
    e.target.value = ''
    if (file) previewImport(file)
  })
}

// ---------- Importing from other apps ----------

const FIELD_LABELS = { date: 'Date', minutes: 'Mat time', type: 'Class type', rounds: 'Rounds', notes: 'Notes', techniques: 'Techniques', title: 'Title' }

async function previewImport(file) {
  let result
  try { result = await readOtherApp(file) } catch { toast('Couldn’t read that file. Export it as CSV or JSON and try again.'); return }
  const { sessions, skipped, columns, headers } = result
  const fresh = sessions.filter(s => !S.session.some(x => x.id === s.id))
  const dates = sessions.map(s => s.date).sort()
  if (!sessions.length) {
    openSheet('Nothing to import yet', `
      <p>I couldn’t find training dates in <strong>${esc(file.name)}</strong>.</p>
      ${headers.length ? `<p class="hint">Columns found: ${esc(headers.join(', '))}</p>` : '<p class="hint">The file looks empty, or it isn’t CSV or JSON.</p>'}
      <p class="hint">If the app exports a spreadsheet (.xlsx) or PDF, export or save it as CSV instead. If it still doesn’t work, the importer can be adjusted for this file’s layout.</p>`)
    return
  }
  openSheet('Import training history', `
    <p>Found <strong>${plural(sessions.length, 'session')}</strong> in ${esc(file.name)}, from ${fmtDate(dates[0])} ${dates[0].slice(0, 4)} to ${fmtDate(dates.at(-1))} ${dates.at(-1).slice(0, 4)}.
      ${fresh.length < sessions.length ? `${sessions.length - fresh.length} are already in your journal and will be skipped.` : ''}
      ${skipped.length ? `${plural(skipped.length, 'row')} had no date and will be left out.` : ''}</p>
    <dl class="refl">${Object.entries(columns).map(([k, h]) => `<dt>${FIELD_LABELS[k]}</dt><dd>from “${esc(h)}”</dd>`).join('')}</dl>
    <p class="hint">Other columns are kept in each session’s notes. Imported sessions show up on the calendar, and you can edit them like any other entry.</p>
    <div class="stack">${sessions.slice(0, 3).map(s => `<div class="roll-mini"><span><strong>${fmtDate(s.date)}</strong> · ${esc(s.type)}${s.minutes ? ` · ${s.minutes} min` : ''}${s.notes ? ` · <span class="muted">${esc(trunc(s.notes.replace(/\n/g, ' · '), 80))}</span>` : ''}</span></div>`).join('')}</div>`, {
    submitLabel: fresh.length ? `Import ${plural(fresh.length, 'session')}` : 'Nothing new to import',
    onSubmit: async () => {
      if (!fresh.length) return
      await saveMany(fresh)
      toast(`Imported ${plural(fresh.length, 'session')}`)
    },
  })
}

// ---------- Fighter profile ----------

function profilePanel() {
  const P = S.profile, rank = currentRank()
  const promotions = [...P.promotions].sort(byDateAsc).reverse(), tournaments = [...P.tournaments].sort(byDateAsc).reverse()
  const sinceRank = S.session.filter(s => !rank.since || s.date >= rank.since)
  const wins = sum(P.tournaments, 'wins'), losses = sum(P.tournaments, 'losses')
  const medals = place => P.tournaments.filter(t => t.place === place).length
  const medalCount = medals('Gold') + medals('Silver') + medals('Bronze')
  return `<section class="panel wide" aria-labelledby="fp-h">
    <div class="history-head"><h2 id="fp-h" style="margin:0">Fighter profile</h2><button class="btn sm ghost" data-act="edit-profile">${P.createdAt ? 'Edit profile' : 'Set up profile'}</button></div>
    <div class="profile" style="margin-top:12px">
      <div class="who-card">
        ${beltArt(rank)}
        <div><p class="fighter-name">${esc(P.name || 'Your name')}</p><p class="muted">${esc(rankName(rank))}${P.gym ? ` · ${esc(P.gym)}` : ''}</p></div>
        <div class="time-line">
          ${P.startDate ? `<span>Training for <strong>${span(P.startDate)}</strong>, since ${fmtMonthY(P.startDate)}</span>` : ''}
          ${rank.since ? `<span>At this rank for <strong>${span(rank.since)}</strong></span>` : ''}
          ${sinceRank.length ? `<span class="muted">${plural(sinceRank.length, 'session')} and ${hrs(sum(sinceRank, 'minutes'))} mat hours logged ${rank.since ? 'since your last promotion' : 'so far'}</span>` : ''}
        </div>
        <div class="figures">
          <div class="figure"><div class="big">${P.tournaments.length}</div><div class="lbl">tournaments</div></div>
          <div class="figure"><div class="big">${wins}–${losses}</div><div class="lbl">match record</div></div>
          <div class="figure"><div class="big">${medalCount}</div><div class="lbl">${medalCount ? `medals (${[['Gold', 'gold'], ['Silver', 'silver'], ['Bronze', 'bronze']].filter(([k]) => medals(k)).map(([k, l]) => medals(k) + ' ' + l).join(', ')})` : 'medals'}</div></div>
        </div>
      </div>
      <div class="history">
        <div><div class="history-head"><h3>Promotions</h3><button class="btn sm ghost" data-act="new-promo">Add promotion</button></div>
          ${promotions.length ? promotions.map((p, i) => `<div class="hist-row"><span class="when">${fmtMonthY(p.date)}</span>
            <div class="what"><span class="swatch" style="background:${(BELT_LOOK[p.belt] || BELT_LOOK.White).belt}"></span><strong>${esc(rankName(p))}</strong>${promotions[i + 1] ? ` <span class="small muted">after ${span(promotions[i + 1].date, p.date)}</span>` : ''}${p.note ? `<p class="small muted">${esc(p.note)}</p>` : ''}</div>
            <button class="mini" data-act="edit-promo" data-id="${p.id}">Edit</button></div>`).join('')
          : '<p class="muted small">Add each belt and stripe with its date. The header turns your belt color, and time at each rank shows here.</p>'}
        </div>
        <div><div class="history-head"><h3>Tournaments</h3><button class="btn sm ghost" data-act="new-comp">Add tournament</button></div>
          ${tournaments.length ? tournaments.map(t => `<div class="hist-row"><span class="when">${fmtMonthY(t.date)}</span>
            <div class="what"><strong>${esc(t.name)}</strong>${t.division ? ` <span class="small muted">${esc(t.division)}</span>` : ''}
              <p class="small">${+t.wins || 0}–${+t.losses || 0}${+t.subs ? `, ${plural(+t.subs, 'win')} by submission` : ''}${t.notes ? ` · <span class="muted">${esc(trunc(t.notes, 140))}</span>` : ''}</p></div>
            <span class="row-actions" style="margin:0;align-items:center"><span class="medal ${t.place === 'No medal' ? '' : esc((t.place || '').toLowerCase())}">${esc(t.place || 'No medal')}</span><button class="mini" data-act="edit-comp" data-id="${t.id}">Edit</button></span></div>`).join('')
          : '<p class="muted small">Log each event with your division, your record and the main lesson.</p>'}
        </div>
      </div>
    </div></section>`
}

const saveProfile = patch => save({ ...S.profile, ...patch, id: 'profile_main', kind: 'profile', example: false })

function profileForm() {
  const P = S.profile
  openSheet(P.createdAt ? 'Edit profile' : 'Set up your profile', `
    ${field('Name', `<input type="text" name="name" id="pf-name" value="${esc(P.name)}" placeholder="What your training partners call you">`)}
    <div class="grid2">${field('Academy', `<input type="text" name="gym" id="pf-gym" value="${esc(P.gym)}" placeholder="Where you train">`)}${field('Started training', `<input type="date" name="startDate" id="pf-start" value="${esc(P.startDate)}">`)}</div>
    <p class="hint">Your current belt comes from your latest promotion.</p>`, {
    submitLabel: 'Save profile',
    onSubmit: fd => { saveProfile({ name: fd.get('name').trim(), gym: fd.get('gym').trim(), startDate: fd.get('startDate') }); toast('Profile saved') },
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

function tournamentForm(id) {
  const t = id ? S.profile.tournaments.find(x => x.id === id) : { date: today(), name: '', division: '', place: 'No medal', wins: 0, losses: 0, subs: 0, notes: '' }
  if (!t) return
  openSheet(id ? 'Edit tournament' : 'Add a tournament', `
    <div class="grid2">${field('Date', `<input type="date" name="date" id="tc-date" value="${esc(t.date)}" required>`)}${field('Event', `<input type="text" name="name" id="tc-name" value="${esc(t.name)}" placeholder="Fall Open" required>`)}</div>
    ${field('Division', `<input type="text" name="division" id="tc-div" value="${esc(t.division)}" placeholder="Adult ${esc(currentRank().belt)} Gi, middleweight">`)}
    <fieldset><legend>Result</legend><div class="chips">${PLACES.map(k => `<label class="chip"><input type="radio" name="place" value="${k}" ${t.place === k ? 'checked' : ''}><span>${k}</span></label>`).join('')}</div></fieldset>
    <div class="grid3">
      ${field('Matches won', `<input type="number" name="wins" id="tc-w" min="0" max="20" inputmode="numeric" value="${esc(t.wins)}">`)}
      ${field('Matches lost', `<input type="number" name="losses" id="tc-l" min="0" max="20" inputmode="numeric" value="${esc(t.losses)}">`)}
      ${field('Wins by submission', `<input type="number" name="subs" id="tc-s" min="0" max="20" inputmode="numeric" value="${esc(t.subs)}">`)}
    </div>
    ${field('What you learned', `<textarea name="notes" id="tc-notes" rows="3" placeholder="How each match was won or lost, nerves, what to drill before the next one">${esc(t.notes)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save changes' : 'Add tournament',
    onDelete: id ? () => saveProfile({ tournaments: S.profile.tournaments.filter(x => x.id !== id) }) : null,
    onSubmit: fd => {
      const name = fd.get('name').trim()
      if (!name || !fd.get('date')) { $('#form-error').textContent = 'Add the event name and date.'; return false }
      const rec = { ...t, id: id || newId('comp'), date: fd.get('date'), name, division: fd.get('division').trim(), place: fd.get('place') || 'No medal', wins: +fd.get('wins') || 0, losses: +fd.get('losses') || 0, subs: +fd.get('subs') || 0, notes: fd.get('notes').trim() }
      saveProfile({ tournaments: id ? S.profile.tournaments.map(x => x.id === id ? rec : x) : [...S.profile.tournaments, rec] })
      toast(id ? 'Tournament saved' : 'Tournament added')
    },
  })
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
      <label class="btn ghost sm file-btn">Restore from a backup<input type="file" id="import-file" accept="application/json,.json"></label>
      <label class="btn ghost sm file-btn">Import from another app<input type="file" id="other-app-file" accept=".csv,.tsv,.txt,.json,text/csv,application/json"></label>
      ${hasExamples ? '<button class="btn ghost sm" data-act="remove-examples">Remove example entries</button>' : '<button class="btn ghost sm" data-act="load-examples">Load example entries</button>'}
      <button class="btn danger sm" data-act="clear-all">Delete everything</button>
    </div>
  </section>`
}

export const actions = {
  'edit-profile': () => profileForm(),
  'new-promo': () => promotionForm(),
  'edit-promo': el => promotionForm(el.dataset.id),
  'new-comp': () => tournamentForm(),
  'edit-comp': el => tournamentForm(el.dataset.id),
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
