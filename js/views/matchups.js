// Journal → Partners: your training partners and rivals, each with a scouting brief from your own
// rolls, notes and a timeline. Advanced mode adds the matchup tables (by belt, size and style).
import { S, remove, save, saveMany } from '../store.js'
import { UI } from '../ui.js'
import { BELTS, RANKS, RESULTS, SIZES, STYLES } from '../vocab.js'
import { $, byDateDesc, cap, daysAgo, esc, fmtDate, fmtDateLong, newId, pct, plural, rate, toast, today } from '../util.js'
import { chipsEl, field, openSheet, selectEl } from '../sheet.js'
import { isSimple, partnerProfile, profileByName, profileOf, sizeLabel } from '../model.js'
import { breakSummary, hardestMatchup, matchupGroups } from '../analysis.js'
import { newProfile, partnerById, rollsWith, roundsWith, scout, briefLine, spotOf, unprofiled } from '../partners.js'
import { addPhotos, hydratePhotos, removePhotos } from '../photos.js'
import { rollFlow } from '../picker.js'
import { newRoll, rollLike } from '../sim.js'
import { fold, more, subOf } from './hub.js'
import { movesUsed } from './rolls.js'
import { roundMini } from './rounds.js'

export function view() {
  const sub = subOf('matchups')
  return sub.startsWith('p:') ? profilePage(partnerById(sub.slice(2))) : listPage()
}

export const mount = root => hydratePhotos(root)

// ---------- The list ----------

const FILTERS = [['', 'All'], ['gym', 'Gym'], ['rival', 'Rivals']]
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
const avatar = (p, cls = '') => `<span class="pt-av ${cls}" aria-hidden="true">${p.photo ? `<img data-photo="${esc(p.photo)}" alt="">` : esc(initials(p.name))}</span>`
const rankOf = p => p.belt ? `${p.belt} belt${+p.stripes ? `, ${plural(+p.stripes, 'stripe')}` : ''}` : ''
const who = p => [p.nickname && `“${p.nickname}”`, rankOf(p), p.size && sizeLabel(p.size), p.weight].filter(Boolean).join(' · ')
const record = rolls => `${rolls.filter(r => r.result === 'worked').length}–${rolls.filter(r => r.result === 'partial').length}–${rolls.filter(r => r.result === 'broke').length}`

function card(p) {
  const rolls = rollsWith(p), rounds = roundsWith(p), last = [...rolls, ...rounds].sort(byDateDesc)[0]
  return `<button class="pt-card" data-act="open-sub" data-sub="p:${esc(p.id)}">
    ${avatar(p)}
    <span class="pt-card-main"><span class="pt-top"><b>${esc(p.name)}</b>${p.rival ? '<span class="pt-badge">Rival</span>' : ''}${rolls.length ? `<span class="opp-rec" aria-label="Worked, partly, broke">${record(rolls)}</span>` : ''}</span>
      <span class="small muted">${esc([who(p), rolls.length ? plural(rolls.length, 'roll') : 'No rolls yet', last && 'last ' + fmtDate(last.date)].filter(Boolean).join(' · '))}</span></span>
  </button>`
}

function listPage() {
  const head = `<div class="page-head"><div><h1>Partners</h1><p class="lede">The people you roll with most. Tap one for a scouting brief from your own rolls before you slap hands.</p></div>
    <div class="head-actions"><button class="btn" data-act="partner-edit">Add a partner</button></div></div>`
  const loose = unprofiled()
  const suggest = loose.length ? `<div class="callout pt-suggest"><p>On 2 or more of your rolls with no profile yet: <b>${esc(loose.slice(0, 5).map(x => x.name).join(', '))}</b>${loose.length > 5 ? ` and ${loose.length - 5} more` : ''}.</p>
    <div><button class="btn sm" data-act="partners-from-rolls">Create profiles from your rolls</button></div></div>` : ''
  const count = p => rollsWith(p).length + roundsWith(p).length
  const all = [...S.partner].sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name))
  const list = all.filter(p => !UI.partnerFilter || (UI.partnerFilter === 'rival') === !!p.rival)
  const people = !all.length
    ? loose.length ? '' : `<div class="empty-state"><h2>No partners yet</h2><p>You roll with the same 10 or 20 people week after week. Add them here, or type a name when you log a roll, and each one gets a scouting brief built from your rolls with them.</p><button class="btn" data-act="partner-edit">Add a partner</button></div>`
    : `${all.some(p => p.rival) ? `<div class="seg pt-filter" role="group" aria-label="Show">${FILTERS.map(([k, label]) => `<button data-act="partner-filter" data-k="${k}" aria-pressed="${(UI.partnerFilter || '') === k}">${label}</button>`).join('')}</div>` : ''}
      <div class="pt-list">${list.length ? list.map(card).join('') : '<p class="muted">No one here yet.</p>'}</div>
      <p class="small muted pt-legend">Record is worked–partly–broke, over every roll with them.</p>`
  return head + suggest + people + (isSimple() ? '' : matchupTables())
}

// ---------- One partner ----------

const line = (p, l) => `<button class="brief-line" data-act="partner-rolls" data-id="${esc(p.id)}" data-k="${esc(l.k)}"><span>${esc(l.text)}</span><span class="brief-go" aria-label="See the ${l.ids.length === 1 ? 'roll' : plural(l.ids.length, 'roll')}">${l.ids.length} ›</span></button>`
const lines = (p, list, title) => list.length ? `<p class="w-lbl brief-h">${title}</p>${list.map(l => line(p, l)).join('')}` : ''

// Live roll from the spot the plan names (or where your rolls with them usually start), against a partner as tough as they are.
function rehearsal(p, b) {
  const placed = b.rolls.filter(r => r.position), times = r => placed.filter(x => spotOf(x) === spotOf(r)).length
  const from = b.plan?.from?.position ? b.plan.from : [...placed].sort((x, y) => times(y) - times(x))[0]
  return from ? rollLike({ position: from.position, role: from.role, level: p.belt || from.level || 'Unknown', size: p.size || from.size || '' }) : null
}

function brief(p) {
  const b = scout(p), sim = b.n ? rehearsal(p, b) : null
  const notes = [...b.pinned, ...(b.latest ? [b.latest] : [])]
  return `<section class="panel brief"><div class="history-head"><h2>Before you roll</h2></div>
    ${!b.n ? `<p class="muted">No rolls logged with ${esc(p.name)} yet. Log one and the brief starts here.</p>` : b.thin ? `<p class="brief-thin">Only ${plural(b.n, 'roll')} logged with ${esc(p.name)}: log a few more for a real scouting report.</p>` : ''}
    ${b.lines.head.map(l => line(p, l)).join('')}
    ${b.plan ? `<div class="brief-plan"><p class="w-lbl">Game plan</p><button class="brief-line" data-act="partner-rolls" data-id="${esc(p.id)}" data-k="plan"><span>${esc(b.plan.text)}</span><span class="brief-go">${b.plan.ids.length} ›</span></button>
</div>` : ''}
    ${lines(p, b.lines.them, `What ${esc(p.name)} does to you`)}
    ${lines(p, [...b.lines.mine, ...b.lines.starts], 'What works for you')}
    ${sim ? `<div class="brief-sim"><button class="btn sm" data-act="partner-rehearse" data-id="${esc(p.id)}">Rehearse in Live roll</button><span class="small muted">From ${esc(sim.start.split('|').join(', ').toLowerCase().replace(', neutral', ''))}, against a${sim.partner === 'even' ? 'n even' : ' ' + (sim.partner === 'tough' ? 'tougher' : 'easier')} partner</span></div>` : ''}
    ${notes.length ? `<p class="w-lbl brief-h">Your notes</p>${notes.map(n => `<p class="brief-note">${n.pinned ? '<span class="pt-pin">Pinned</span> ' : `<span class="small muted">${esc(fmtDate(n.date))}</span> `}${esc(n.text)}</p>`).join('')}` : ''}
  </section>`
}

function headToHead(p, rolls, rounds) {
  if (!rolls.length && !rounds.length) return ''
  const by = res => rolls.filter(r => r.result === res).length
  return `<section class="panel pt-h2h"><div class="opp-score"><span><b>${by('worked')}</b>worked</span><span><b>${by('partial')}</b>partly</span><span><b>${by('broke')}</b>broke</span>${rounds.length ? `<span><b>${rounds.reduce((t, g) => t + (+g.wins || 0), 0)}–${rounds.reduce((t, g) => t + (+g.losses || 0), 0)}</b>round goes</span>` : ''}</div>
    <span class="opp-form" aria-label="Latest rolls, oldest first">${rolls.slice(0, 12).reverse().map(r => `<i class="${{ worked: 'won', broke: 'lost' }[r.result] || ''}"></i>`).join('')}</span>
    <p class="small muted">${rolls.length ? `Since ${esc(fmtDate([...rolls].pop().date))}. ` : ''}<button class="link small" data-act="goto" data-view="rolls" data-anchor="opp:${esc(p.name.toLowerCase())}">Read the story</button></p></section>`
}

// Notes, rolls and rounds together, newest first.
function timeline(p, rolls, rounds) {
  const items = [...(p.notes || []).map(n => ({ ...n, type: 'note' })), ...rolls.map(r => ({ ...r, type: 'roll' })), ...rounds.map(g => ({ ...g, type: 'round' }))].sort(byDateDesc)
  const item = x => x.type === 'round' ? roundMini(x, true)
    : x.type === 'roll' ? rollItem(x)
    : `<div class="pt-note ${x.pinned ? 'pinned' : ''}"><div class="log-roll-head"><span><b>Note</b> <span class="small muted">· ${esc(fmtDateLong(x.date))}${x.pinned ? ' · pinned' : ''}</span></span>
        <button class="mini" data-act="partner-note" data-id="${esc(p.id)}" data-note="${esc(x.id)}">Edit</button></div><p>${esc(x.text)}</p></div>`
  return `<section class="pt-timeline"><div class="history-head"><h2>Notes and rolls</h2><button class="card-link" data-act="partner-note" data-id="${esc(p.id)}">Add note</button></div>
    ${items.length ? `<div class="log-rolls">${more('pt:' + p.id, items, 5, item)}</div>` : `<p class="muted">Notes you add and rolls you log with ${esc(p.name)} show up here, newest first.</p>`}</section>`
}

const rollItem = (r, edit = true) => `<div class="log-roll ${esc(r.result)}"><div class="log-roll-head"><span><b>${esc(spotOf(r) || 'Roll')}</b> <span class="small muted">· ${esc(fmtDateLong(r.date))}</span></span>
    <span class="result ${esc(r.result)}">${esc(RESULTS[r.result]?.label || '')}</span></div>
  ${rollFlow(r) || movesUsed(r)}
  ${(r.reasons || []).length ? `<p class="small muted">Why: ${esc(r.reasons.join(', ').toLowerCase())}</p>` : ''}
  ${r.what ? `<p class="small log-what">${esc(r.what)}</p>` : ''}
  ${edit ? `<div class="row-actions"><button class="mini" data-act="edit-roll" data-id="${esc(r.id)}">Edit</button></div>` : ''}</div>`

function profilePage(p) {
  const back = `<button class="btn sm ghost" data-act="open-sub" data-sub="">‹ Partners</button>`
  if (!p) return `<div class="sub-head">${back}<h1>Partner</h1></div><p class="muted">This profile was deleted.</p>`
  const rolls = rollsWith(p), rounds = roundsWith(p)
  return `<div class="sub-head">${back}<h1>${esc(p.name)}</h1><button class="btn sm ghost" data-act="partner-edit" data-id="${esc(p.id)}">Edit</button></div>
    <section class="pt-hero">${avatar(p, 'big')}<div class="pt-id">
      <p>${p.rival ? '<span class="pt-badge">Rival</span> ' : ''}${esc(who(p) || 'Training partner')}</p>
      ${p.gym ? `<p class="small muted">${esc(p.gym)}</p>` : ''}
      ${(p.styles || []).length ? `<div class="tags">${p.styles.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : ''}
    </div></section>
    ${brief(p)}
    ${headToHead(p, rolls, rounds)}
    <div class="row-actions pt-actions"><button class="btn" data-act="new-roll" data-partner="${esc(p.name)}">Log a roll with ${esc(p.name)}</button><button class="btn ghost" data-act="new-round" data-partner="${esc(p.name)}">Positional round</button></div>
    ${timeline(p, rolls, rounds)}`
}

// ---------- Sheets ----------

// A brief line's rolls, so every number can be checked.
function drilldown(p, k) {
  const l = briefLine(p, k)
  if (!l) return
  const items = [...S.roll, ...S.round].filter(x => l.ids.includes(x.id)).sort(byDateDesc)
  openSheet(`With ${p.name}: ${plural(items.length, items.every(x => x.kind === 'round') ? 'round' : 'roll')}`, `<p class="brief-src">${esc(l.text)}</p>
    <div class="log-rolls">${items.map(x => x.kind === 'round' ? roundMini(x, true) : rollItem(x, false)).join('')}</div>`)
}

function profileForm(id) {
  const old = id && partnerById(id), p = old || newProfile()
  let photo = null, dropPhoto = false
  openSheet(id ? 'Edit partner' : 'Add a partner', `
    <div class="grid2">${field('Name', `<input type="text" name="name" value="${esc(p.name)}" required placeholder="Dave">`)}${field('Nickname (optional)', `<input type="text" name="nickname" value="${esc(p.nickname)}" placeholder="Big Dave">`)}</div>
    <div class="grid2">${field('Belt', selectEl('belt', [{ value: '', label: 'Not noted' }, ...RANKS], p.belt))}${field('Stripes', selectEl('stripes', [0, 1, 2, 3, 4], +p.stripes || 0))}</div>
    <div class="grid2">${field('Size', selectEl('size', [{ value: '', label: 'Not noted' }, ...SIZES.map(s => ({ value: s, label: { Lighter: 'Lighter than you', Similar: 'About your size', Heavier: 'Heavier than you' }[s] }))], p.size))}${field('Weight or class (optional)', `<input type="text" name="weight" value="${esc(p.weight)}" placeholder="85 kg, medium heavy">`)}</div>
    <fieldset><legend>Their style</legend>${chipsEl('styles', STYLES, p.styles || [])}</fieldset>
    <label class="new-partner"><input type="checkbox" name="rival" value="1" ${p.rival ? 'checked' : ''}> <span>Tournament rival, not from my gym</span></label>
    ${field('Gym or team (optional)', `<input type="text" name="gym" value="${esc(p.gym)}">`)}
    <div class="pt-photo">${avatar(p, 'big')}<label class="btn sm ghost file-btn">${p.photo ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" data-pt-file></label>${p.photo ? '<button type="button" class="link small" data-pt-drop>Remove photo</button>' : ''}</div>
    <p class="small muted">Profiles stay on this phone, like the rest of your journal.</p>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Add partner',
    onDelete: id ? () => { UI.sub.matchups = ''; removePhotos(p.photo ? [p.photo] : []); remove(p); saveMany(linked(p).map(x => ({ ...x, partnerId: '' }))) } : null,
    onMount: form => {
      hydratePhotos(form)
      form.addEventListener('change', e => {
        if (!e.target.matches('[data-pt-file]') || !e.target.files[0]) return
        photo = e.target.files[0]
        $('.pt-av', form).innerHTML = `<img src="${URL.createObjectURL(photo)}" alt="">`
      })
      form.addEventListener('click', e => { if (e.target.matches('[data-pt-drop]')) { dropPhoto = true; photo = null; $('.pt-av', form).textContent = initials(p.name || '?'); e.target.remove() } })
    },
    onSubmit: async fd => {
      const name = fd.get('name').trim(), nickname = fd.get('nickname').trim()
      const clash = [name, nickname].filter(Boolean).map(profileByName).find(x => x && x.id !== p.id)
      if (!name) { $('#form-error').textContent = 'Add their name.'; return false }
      if (clash) { $('#form-error').textContent = `${clash.name} already has that name or nickname.`; return false }
      const [added] = photo ? await addPhotos([photo]) : []
      if ((added || dropPhoto) && p.photo) removePhotos([p.photo])
      const rec = { ...p, name, nickname, belt: fd.get('belt'), stripes: +fd.get('stripes') || 0, size: fd.get('size'), weight: fd.get('weight').trim(),
        styles: fd.getAll('styles'), rival: !!fd.get('rival'), gym: fd.get('gym').trim(), photo: added || (dropPhoto ? '' : p.photo) }
      // Its rolls and rounds take the new name and link by id, so a rename carries over.
      const keys = [name, nickname].filter(Boolean).map(x => x.toLowerCase())
      const mine = [...S.roll, ...S.round].filter(x => (old && profileOf(x) === old) || (!profileOf(x) && keys.includes((x.partner || '').trim().toLowerCase())))
      saveMany([rec, ...mine.filter(x => x.partner !== name || x.partnerId !== rec.id).map(x => ({ ...x, partner: name, partnerId: rec.id }))])
      UI.sub.matchups = 'p:' + rec.id
      toast(id ? 'Saved' : `${name} added`)
    },
  })
}

const linked = p => [...S.roll, ...S.round].filter(x => x.partnerId === p.id)

function noteForm(p, noteId) {
  const n = (p.notes || []).find(x => x.id === noteId) || { date: today(), text: '', pinned: false }
  openSheet(noteId ? 'Edit note' : `Note on ${p.name}`, `
    ${field('Note', `<textarea name="text" rows="3" required placeholder="Gets the underhook early. Keep my knee shield up.">${esc(n.text)}</textarea>`)}
    <div class="grid2">${field('Date', `<input type="date" name="date" value="${esc(n.date)}" required>`)}<label class="new-partner pt-pin-check"><input type="checkbox" name="pinned" value="1" ${n.pinned ? 'checked' : ''}> <span>Pin to the brief</span></label></div>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: 'Save note',
    onDelete: noteId ? () => save({ ...p, notes: p.notes.filter(x => x.id !== noteId) }) : null,
    onSubmit: fd => {
      const text = fd.get('text').trim()
      if (!text) { $('#form-error').textContent = 'Write the note first.'; return false }
      const note = { ...n, id: n.id || newId('note'), date: fd.get('date') || today(), text, pinned: !!fd.get('pinned') }
      save({ ...p, notes: [...(p.notes || []).filter(x => x.id !== note.id), note] })
      toast('Note saved')
    },
  })
}

// ---------- Advanced: matchups by kind of partner ----------

function table(rows, firstColumn) {
  return `<div class="table-scroll"><table><thead><tr><th scope="col" class="l">${esc(firstColumn)}</th><th scope="col">Rolls</th><th scope="col">Success</th><th scope="col">vs everyone else</th><th scope="col" class="l">Usually goes wrong at</th><th scope="col" class="l">Main cause</th></tr></thead>
    <tbody>${rows.map(x => {
      const b = breakSummary(x.rolls), gap = x.others == null ? null : Math.round((x.rate - x.others) * 100)
      return `<tr><td class="l">${esc(cap(x.label))}</td><td>${x.n}</td>
        <td><span class="meter good"><span style="width:${Math.max(3, x.rate * 100)}%"></span></span>${pct(x.rate)}</td>
        <td class="${gap == null || Math.abs(gap) < 10 ? '' : gap < 0 ? 'delta-down' : 'delta-up'}">${gap == null ? '—' : (gap > 0 ? '+' : gap < 0 ? '−' : '') + Math.abs(gap) + ' pts'}</td>
        <td class="l">${b.spot || '—'}</td><td class="l">${b.cause ? esc(b.cause) : '—'}</td></tr>`
    }).join('')}</tbody></table></div>`
}

function matchupTables() {
  const rolls = S.roll.filter(r => r.date >= daysAgo(182))
  if (!rolls.length) return ''
  const hard = hardestMatchup(rolls), hb = hard && breakSummary(hard.rolls)
  return `<h2 class="pt-section">Matchups by kind of partner <span class="small muted">last 6 months</span></h2><div class="stat-grid">
    <section class="panel wide"><h2>Toughest matchup</h2>
      <div class="figures">
        <div class="figure"><div class="big">${pct(rate(rolls))}</div><div class="lbl">success across ${plural(rolls.length, 'roll')}</div></div>
        ${hard ? `<div class="figure"><div class="big" style="color:var(--broke)">${pct(hard.rate)}</div><div class="lbl">against ${esc(hard.label)} partners</div></div>` : ''}
      </div>
      ${hard
        ? `<p style="margin-top:8px;max-width:70ch">Your results drop most against <strong>${esc(hard.label)}</strong> partners: ${pct(hard.rate)} over ${plural(hard.n, 'roll')}, against ${pct(hard.others)} with everyone else.${hb.spot ? ` It mostly goes wrong at ${hb.spot}${hb.cause ? `, usually from ${esc(hb.cause.toLowerCase())}` : ''}.` : ''}</p>`
        : '<p class="muted" style="margin-top:8px">No matchup stands out yet. One shows up here once a group has at least 4 rolls and trails everyone else by 15 points or more.</p>'}
      <p class="small muted" style="margin-top:10px">Small groups swing a lot. Treat a gap from 4 or 5 rolls as a question to test, not a conclusion.</p>
    </section>
    <div class="wide">${matchupGroups(rolls).map(d => fold('mu-' + d.what, `<b>${d.title}</b><span class="small muted">noted on ${d.noted} of ${rolls.length}</span>`,
      d.rows.length ? table(d.rows, cap(d.what)) : `<p class="muted">Add partner ${d.what} when you log rolls to compare here.</p>`)).join('')}</div>
  </div>`
}

export const actions = {
  'partner-filter': el => { UI.partnerFilter = el.dataset.k },
  'partner-edit': el => profileForm(el.dataset.id),
  'partner-note': el => { const p = partnerById(el.dataset.id); if (p) noteForm(p, el.dataset.note) },
  'partner-rolls': el => { const p = partnerById(el.dataset.id); if (p) drilldown(p, el.dataset.k) },
  'partner-rehearse': el => {
    const p = partnerById(el.dataset.id), like = p && rehearsal(p, scout(p))
    if (!like) return
    UI.simSetup = { start: like.start, partner: like.partner, personal: true, rehearse: true }
    UI.sim = newRoll(like.start, like.partner, { personal: true, rehearse: true })
    UI.simSaved = {}
    UI.view = 'sim'
    scrollTo(0, 0)
  },
  // Names on 2+ rolls become profiles, with the belt, size and style of your latest roll with them.
  'partners-from-rolls': () => {
    const made = unprofiled().map(({ name }) => {
      const r = partnerProfile(name) || {}
      return newProfile({ name, belt: BELTS.includes(r.level) && r.level !== 'Unknown' ? r.level : '', size: r.size || '', styles: r.styles || [] })
    })
    const key = x => (x.partner || '').trim().toLowerCase()
    const links = [...S.roll, ...S.round].map(x => [x, made.find(p => p.name.toLowerCase() === key(x))]).filter(([x, p]) => p && !profileOf(x)).map(([x, p]) => ({ ...x, partner: p.name, partnerId: p.id }))
    saveMany([...made, ...links])
    toast(`${plural(made.length, 'profile')} created`)
  },
}
