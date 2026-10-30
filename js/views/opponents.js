// Rolls → Opponents: everyone you've named, your nemesis first. Each one's page opens on a scouting
// brief from your own rolls, then your record and form, the story roll by roll, and your notes.
// A profile adds belt, size, style, a photo, a rival flag and notes; names without one still work.
import { S, remove, save, saveMany } from '../store.js'
import { UI } from '../ui.js'
import { BELTS, RANKS, RESULTS, SIZES, STYLES } from '../vocab.js'
import { $, byDateDesc, esc, fmtDate, fmtDateLong, newId, plural, toast, today } from '../util.js'
import { chipsEl, field, openSheet, selectEl } from '../sheet.js'
import { partnerProfile, profileByName, profileOf, sizeLabel } from '../model.js'
import { briefLine, opponent, opponents, scout, spotOf, storyOf, summaryOf } from '../rivals.js'
import { newProfile, partnerById, unprofiled } from '../partners.js'
import { addPhotos, hydratePhotos, removePhotos } from '../photos.js'
import { rollFlow } from '../picker.js'
import { newRoll, rollLike } from '../sim.js'
import { roundMini } from './rounds.js'

// The story's back button goes to the list of opponents, not to the roll notes.
const head = (label, extra = '') => `<div class="sub-head"><button class="btn sm ghost" data-act="open-sub" data-sub="opponents">‹ Opponents</button><h1>${esc(label)}</h1>${extra}</div>`

const RESULT_WORD = { worked: 'won', partial: 'even', broke: 'lost' }

// The last dozen results as dots, oldest first, so a card reads like a form guide.
const form = o => `<span class="opp-form" aria-label="Last ${Math.min(12, o.n)}: ${o.entries.slice(-12).map(storyResult).join(', ')}">${o.entries.slice(-12).map(x => `<i class="${storyResult(x)}"></i>`).join('')}</span>`
const storyResult = x => RESULT_WORD[x.isRound ? (x.wins > x.losses ? 'worked' : x.wins < x.losses ? 'broke' : 'partial') : x.result] || 'even'
const rank = o => o.profile?.belt ? `${o.profile.belt.toLowerCase()} belt${+o.profile.stripes ? `, ${plural(+o.profile.stripes, 'stripe')}` : ''}` : o.level && o.level !== 'Unknown' && `${o.level.toLowerCase()} belt`
const who = o => [o.profile?.nickname && `“${o.profile.nickname}”`, rank(o), o.size && sizeLabel(o.size), o.profile?.weight, o.styles.slice(0, 2).join(', ').toLowerCase()].filter(Boolean).join(', ')
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
const avatar = (o, cls = '') => `<span class="pt-av ${cls}" aria-hidden="true">${o.profile?.photo ? `<img data-photo="${esc(o.profile.photo)}" alt="">` : esc(initials(o.name || '?'))}</span>`
const badges = o => `${o.nemesis ? '<span class="opp-badge">Nemesis</span>' : ''}${o.profile?.rival ? '<span class="pt-badge">Rival</span>' : ''}`

function card(o) {
  return `<button class="opp-card ${o.nemesis ? 'nemesis' : ''}" data-act="open-sub" data-sub="opp:${esc(o.key)}">
    <span class="opp-top">${avatar(o, 'sm')}<b>${esc(o.name)}</b>${badges(o)}${o.n ? `<span class="opp-rec">${o.won}–${o.even}–${o.lost}</span>` : ''}</span>
    <span class="small muted">${esc([o.n ? [o.rolls && plural(o.rolls, 'roll'), o.n > o.rolls && plural(o.n - o.rolls, 'round')].filter(Boolean).join(', ') : 'No rolls yet', who(o)].filter(Boolean).join(' · '))}</span>
    ${o.n ? form(o) : ''}
    ${o.n ? `<span class="small">${o.weapon ? `Their weapon: ${esc(o.weapon.tech.name.toLowerCase())} (${o.weapon.times}×)` : `Last rolled ${esc(fmtDate(o.last))}`}</span>` : ''}
  </button>`
}

const FILTERS = [['', 'All'], ['gym', 'Gym'], ['rival', 'Rivals']]

export function opponentList() {
  const all = opponents(), loose = unprofiled()
  const suggest = loose.length ? `<div class="callout pt-suggest"><p>On 2 or more of your rolls with no profile yet: <b>${esc(loose.slice(0, 5).map(x => x.name).join(', '))}</b>${loose.length > 5 ? ` and ${loose.length - 5} more` : ''}. A profile keeps their belt, style and your notes.</p>
    <div><button class="btn sm" data-act="partners-from-rolls">Create profiles from your rolls</button></div></div>` : ''
  if (!all.length) return `<div class="empty-state"><h2>No opponents yet</h2><p>Put a name on a roll or a positional round, or add the people you roll with most. Each one gets a page: a scouting brief from your rolls, your record, and the story of every roll with them.</p><button class="btn" data-act="new-roll">Log a roll</button> <button class="btn ghost" data-act="partner-edit">Add a partner</button></div>`
  const list = all.filter(o => !UI.partnerFilter || (UI.partnerFilter === 'rival') === !!o.profile?.rival)
  const nemesis = list.find(o => o.nemesis), rest = list.filter(o => !o.nemesis)
  return `${suggest}
    ${all.some(o => o.profile?.rival) ? `<div class="seg pt-filter" role="group" aria-label="Show">${FILTERS.map(([k, label]) => `<button data-act="partner-filter" data-k="${k}" aria-pressed="${(UI.partnerFilter || '') === k}">${label}</button>`).join('')}</div>` : ''}
    ${nemesis ? `<section class="nemesis-hero"><p class="w-lbl">Your nemesis</p>${card(nemesis)}</section>` : ''}
    <p class="small muted opp-legend">Record is won–even–lost. Dots are the latest rolls, oldest first.</p>
    <div class="opp-list">${rest.length ? rest.map(card).join('') : nemesis ? '' : '<p class="muted">No one here yet.</p>'}</div>`
}

// ---------- One opponent ----------

const line = (o, l, k = l.k) => `<button class="brief-line" data-act="partner-rolls" data-key="${esc(o.key)}" data-k="${esc(k)}"><span>${esc(l.text)}</span><span class="brief-go" aria-label="See the ${l.ids.length === 1 ? 'roll' : plural(l.ids.length, 'roll')}">${l.ids.length} ›</span></button>`
const lines = (o, list, title) => list.length ? `<p class="w-lbl brief-h">${title}</p>${list.map(l => line(o, l)).join('')}` : ''

// Live roll from the spot the plan names (or where your rolls with them usually start), against a partner as tough as they are.
function rehearsal(o, b) {
  const from = b.plan?.from?.position ? b.plan.from : b.usual
  return from ? rollLike({ position: from.position, role: from.role, level: o.level || 'Unknown', size: o.size || '' }) : null
}

function brief(o) {
  const b = scout(o), sim = b.n ? rehearsal(o, b) : null
  return `<section class="panel brief"><div class="history-head"><h2>Before you roll</h2></div>
    ${!b.n ? `<p class="muted">No rolls logged with ${esc(o.name)} yet. Log one and the brief starts here.</p>` : b.thin ? `<p class="brief-thin">Only ${plural(b.n, 'roll')} logged with ${esc(o.name)}: log a few more for a real scouting report.</p>` : ''}
    ${b.lines.head.map(l => line(o, l)).join('')}
    ${b.plan ? `<div class="brief-plan"><p class="w-lbl">Game plan</p>${line(o, b.plan, 'plan')}</div>` : ''}
    ${lines(o, b.lines.them, `What ${esc(o.name)} does to you`)}
    ${lines(o, b.lines.mine, 'What works for you')}
    ${sim ? `<div class="brief-sim"><button class="btn sm" data-act="partner-rehearse" data-key="${esc(o.key)}">Rehearse in Live roll</button><span class="small muted">From ${esc(sim.start.split('|').join(', ').toLowerCase().replace(', neutral', ''))}, against a${sim.partner === 'even' ? 'n even' : ' ' + (sim.partner === 'tough' ? 'tougher' : 'easier')} partner</span></div>` : ''}
    ${b.notes.length ? `<p class="w-lbl brief-h">Your notes</p>${b.notes.map(n => `<p class="brief-note">${n.pinned ? '<span class="pt-pin">Pinned</span> ' : `<span class="small muted">${esc(fmtDate(n.date))}</span> `}${esc(n.text)}</p>`).join('')}` : ''}
  </section>`
}

function notesPanel(o) {
  const p = o.profile
  if (!p) return `<section class="pt-notes"><h2 class="opp-h">Notes</h2><div class="callout"><p>Make a profile for ${esc(o.name)} to keep notes, pin them to the brief, and add belt, style and a photo.</p><div><button class="btn sm" data-act="partner-edit" data-name="${esc(o.name)}">Make a profile</button></div></div></section>`
  const notes = [...(p.notes || [])].sort(byDateDesc), shown = UI.more['ptn:' + p.id] || 3
  return `<section class="pt-notes"><div class="history-head"><h2 class="opp-h">Notes</h2><button class="card-link" data-act="partner-note" data-id="${esc(p.id)}">Add note</button></div>
    ${notes.length ? `<div class="log-rolls">${notes.slice(0, shown).map(n => `<div class="pt-note ${n.pinned ? 'pinned' : ''}"><div class="log-roll-head"><span><b>${n.pinned ? 'Pinned' : 'Note'}</b> <span class="small muted">· ${esc(fmtDateLong(n.date))}</span></span>
        <button class="mini" data-act="partner-note" data-id="${esc(p.id)}" data-note="${esc(n.id)}">Edit</button></div><p>${esc(n.text)}</p></div>`).join('')}</div>
      ${notes.length > shown ? `<button class="btn ghost show-more" data-act="show-more" data-k="ptn:${esc(p.id)}" data-n="3">Show ${Math.min(3, notes.length - shown)} more</button>` : ''}`
      : `<p class="muted small">Add a note after a roll, or here. Pinned notes show up in the brief.</p>`}</section>`
}

export function opponentStory(key) {
  const o = opponent(key)
  if (!o) return head('Opponent') + '<p class="muted">No rolls or profile for this partner any more.</p>'
  const story = storyOf(o), shown = UI.more['opp:' + key] || 10, hidden = Math.max(0, story.length - shown)
  const edit = `<button class="btn sm ghost" data-act="partner-edit" ${o.profile ? `data-id="${esc(o.profile.id)}">Edit` : `data-name="${esc(o.name)}">Profile`}</button>`
  return `${head(o.name, edit)}
    <section class="pt-hero">${avatar(o, 'big')}<div class="pt-id">
      <p>${badges(o)} ${esc(who(o) || 'Rolling partner')}</p>
      ${o.profile?.gym ? `<p class="small muted">${esc(o.profile.gym)}</p>` : ''}
    </div></section>
    ${brief(o)}
    ${o.n ? `<section class="opp-hero ${o.nemesis ? 'nemesis' : ''}">
      <div class="opp-score"><span><b>${o.won}</b>won</span><span><b>${o.even}</b>even</span><span><b>${o.lost}</b>lost</span></div>
      ${form(o)}
      <div class="opp-sofar">${summaryOf(o).map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <button class="link small" data-act="pin-nemesis" data-key="${esc(o.key)}">${o.nemesis ? 'Not my nemesis' : 'Make them my nemesis'}</button>
    </section>` : ''}
    <div class="row-actions pt-actions"><button class="btn sm" data-act="new-roll" data-partner="${esc(o.name)}">Log a roll with ${esc(o.name)}</button><button class="btn sm ghost" data-act="new-round" data-partner="${esc(o.name)}">Positional round</button></div>
    ${story.length ? `<h2 class="opp-h">The story</h2>
    ${hidden ? `<button class="btn ghost show-more" data-act="show-more" data-k="opp:${esc(key)}" data-n="10">Show ${Math.min(10, hidden)} earlier ${hidden === 1 ? 'roll' : 'rolls'}</button>` : ''}
    <ol class="opp-story">${story.slice(-shown).map(scene).join('')}</ol>` : ''}
    ${notesPanel(o)}`
}

function scene(s) {
  return `<li class="opp-scene ${esc(s.outcome)}">
    <p class="opp-when"><b>${esc(s.title)}</b> · ${esc(fmtDateLong(s.date))}</p>
    ${s.beats.map(b => `<p class="opp-beat">${esc(b)}</p>`).join('')}
    ${s.scene ? `<p>${esc(s.scene)}</p>` : ''}
    ${s.end ? `<p class="opp-end">${esc(s.end)}</p>` : ''}
    ${s.words ? `<blockquote>${esc(s.words)}</blockquote>` : ''}
    ${s.next ? `<p class="small muted">Plan for next time: ${esc(s.next.text)}${s.next.status === 'worked' ? ' (it worked)' : s.next.status === 'failed' ? ' (it didn’t work)' : ''}</p>` : ''}
    <button class="link small" data-act="${s.isRound ? 'edit-round' : 'edit-roll'}" data-id="${esc(s.id)}">Edit</button>
  </li>`
}

// ---------- Sheets ----------

const rollItem = r => `<div class="log-roll ${esc(r.result)}"><div class="log-roll-head"><span><b>${esc(spotOf(r) || 'Roll')}</b> <span class="small muted">· ${esc(fmtDateLong(r.date))}</span></span>
    <span class="result ${esc(r.result)}">${esc(RESULTS[r.result]?.label || '')}</span></div>
  ${rollFlow(r)}
  ${(r.reasons || []).length ? `<p class="small muted">Why: ${esc(r.reasons.join(', ').toLowerCase())}</p>` : ''}
  ${r.what ? `<p class="small log-what">${esc(r.what)}</p>` : ''}</div>`

// A brief line's rolls, so every number can be checked.
function drilldown(o, k) {
  const l = briefLine(o, k)
  if (!l) return
  const items = o.entries.filter(x => l.ids.includes(x.id)).sort(byDateDesc)
  openSheet(`With ${o.name}: ${plural(items.length, items.every(x => x.isRound) ? 'round' : 'roll')}`, `<p class="brief-src">${esc(l.text)}</p>
    <div class="log-rolls">${items.map(x => x.isRound ? roundMini(x, true) : rollItem(x)).join('')}</div>`)
}

function profileForm(id, name = '') {
  const old = id && partnerById(id), from = !old && name ? partnerProfile(name) || {} : {}
  const p = old || newProfile({ name, belt: RANKS.includes(from.level) ? from.level : '', size: from.size || '', styles: from.styles || [] })
  let photo = null, dropPhoto = false
  openSheet(id ? 'Edit partner' : name ? `Profile for ${name}` : 'Add a partner', `
    <div class="grid2">${field('Name', `<input type="text" name="name" value="${esc(p.name)}" required placeholder="Dave">`)}${field('Nickname (optional)', `<input type="text" name="nickname" value="${esc(p.nickname)}" placeholder="Big Dave">`)}</div>
    <div class="grid2">${field('Belt', selectEl('belt', [{ value: '', label: 'Not noted' }, ...RANKS], p.belt))}${field('Stripes', selectEl('stripes', [0, 1, 2, 3, 4], +p.stripes || 0))}</div>
    <div class="grid2">${field('Size', selectEl('size', [{ value: '', label: 'Not noted' }, ...SIZES.map(s => ({ value: s, label: { Lighter: 'Lighter than you', Similar: 'About your size', Heavier: 'Heavier than you' }[s] }))], p.size))}${field('Weight or class (optional)', `<input type="text" name="weight" value="${esc(p.weight)}" placeholder="85 kg, medium heavy">`)}</div>
    <fieldset><legend>Their style</legend>${chipsEl('styles', STYLES, p.styles || [])}</fieldset>
    <label class="new-partner"><input type="checkbox" name="rival" value="1" ${p.rival ? 'checked' : ''}> <span>Tournament rival, not from my gym</span></label>
    ${field('Gym or team (optional)', `<input type="text" name="gym" value="${esc(p.gym)}">`)}
    <div class="pt-photo">${avatar({ name: p.name, profile: p }, 'big')}<label class="btn sm ghost file-btn">${p.photo ? 'Change photo' : 'Add a photo'}<input type="file" accept="image/*" data-pt-file></label>${p.photo ? '<button type="button" class="link small" data-pt-drop>Remove photo</button>' : ''}</div>
    <p class="small muted">Profiles stay on this phone, like the rest of your journal.</p>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Save profile',
    onDelete: id ? () => { UI.sub.rolls = 'opponents'; removePhotos(p.photo ? [p.photo] : []); remove(p); saveMany([...S.roll, ...S.round].filter(x => x.partnerId === p.id).map(x => ({ ...x, partnerId: '' }))) } : null,
    deleteLabel: 'Delete profile',
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
      const keys = [name, nickname, p.name].filter(Boolean).map(x => x.toLowerCase())
      const mine = [...S.roll, ...S.round].filter(x => (old && profileOf(x) === old) || (!profileOf(x) && keys.includes((x.partner || '').trim().toLowerCase())))
      // A nemesis pinned by name follows them onto the profile.
      const pinned = S.settings.nemesis && keys.includes(S.settings.nemesis) ? [{ ...S.settings, nemesis: rec.id }] : []
      saveMany([rec, ...mine.filter(x => x.partner !== name || x.partnerId !== rec.id).map(x => ({ ...x, partner: name, partnerId: rec.id })), ...pinned])
      UI.sub.rolls = 'opp:' + rec.id
      toast(id ? 'Saved' : `Profile for ${name} saved`)
    },
  })
}

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

export const actions = {
  'pin-nemesis': el => {
    const o = opponent(el.dataset.key)
    if (!o) return
    save({ ...S.settings, nemesis: o.nemesis ? '-' : o.key })
    toast(o.nemesis ? `${o.name} is off the hook` : `${o.name} is your nemesis now`)
  },
  'partner-filter': el => { UI.partnerFilter = el.dataset.k },
  'partner-edit': el => profileForm(el.dataset.id, el.dataset.name),
  'partner-note': el => { const p = partnerById(el.dataset.id); if (p) noteForm(p, el.dataset.note) },
  'partner-rolls': el => { const o = opponent(el.dataset.key); if (o) drilldown(o, el.dataset.k) },
  'partner-rehearse': el => {
    const o = opponent(el.dataset.key), like = o && rehearsal(o, scout(o))
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
    const pinned = made.find(p => p.name.toLowerCase() === S.settings.nemesis)
    saveMany([...made, ...links, ...(pinned ? [{ ...S.settings, nemesis: pinned.id }] : [])])
    toast(`${plural(made.length, 'profile')} created`)
  },
}
