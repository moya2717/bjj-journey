import { S, save, remove } from '../store.js'
import { UI } from '../ui.js'
import { LIBRARY_GROUPS, TECH_TYPES } from '../vocab.js'
import { $, esc, newId, pct, toast, trunc } from '../util.js'
import { field, selectEl, openSheet } from '../sheet.js'
import { allTechs, isCustom, myTechs, techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { hydratePhotos } from '../photos.js'
import { techStats } from '../analysis.js'

export function view() {
  const scope = UI.libScope === 'mine' && !myTechs().length ? 'all' : UI.libScope
  return `<div class="page-head"><div><h1>Library</h1><p class="lede">Every common move, ready to pick when you log. Star the ones you’re working on, add your own details and video links, or add moves that aren’t here.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-tech">Add a move</button></div></div>
    <div class="lib-tools">
      <label class="field search"><span class="field-label">Search moves</span><input type="search" id="lib-search" value="${esc(UI.libQ)}" placeholder="Try “armbar” or “sweep”"></label>
      <div class="seg" role="group" aria-label="Which moves">
        <button data-act="lib-scope" data-scope="mine" aria-pressed="${scope === 'mine'}">My moves</button>
        <button data-act="lib-scope" data-scope="all" aria-pressed="${scope === 'all'}">All moves</button>
      </div>
    </div>
    <div class="pos-filter" role="group" aria-label="Filter by position">
      <button class="pill" data-act="lib-group" data-group="" aria-pressed="${!UI.libGroup}">All positions</button>
      ${LIBRARY_GROUPS.map(g => `<button class="pill" data-act="lib-group" data-group="${esc(g)}" aria-pressed="${UI.libGroup === g}">${esc(g)}</button>`).join('')}
    </div>
    <div id="lib-list">${list(scope)}</div>`
}

export function mount(root) {
  $('#lib-search')?.addEventListener('input', e => {
    UI.libQ = e.target.value
    $('#lib-list').innerHTML = list(UI.libScope === 'mine' && !myTechs().length ? 'all' : UI.libScope)
    hydratePhotos(root)
  })
  hydratePhotos(root)
}

function list(scope) {
  const q = UI.libQ.trim().toLowerCase()
  const moves = (scope === 'mine' ? myTechs() : allTechs())
    .filter(t => !UI.libGroup || t.position === UI.libGroup)
    .filter(t => !q || [t.name, t.type, t.position, t.notes].join(' ').toLowerCase().includes(q))
  if (!moves.length) return scope === 'mine' && !q
    ? '<div class="empty-state"><h2>No moves here yet</h2><p>Star moves in “All moves”, or log them in your training. They collect here.</p></div>'
    : '<p class="muted">No moves match. Try another word, or add it as a new move.</p>'
  const groups = LIBRARY_GROUPS.filter(g => moves.some(t => t.position === g))
  return groups.map(g => `<section class="pos-group"><h2>${esc(g)}</h2><div class="tech-grid">
    ${moves.filter(t => t.position === g).sort((a, b) => a.name.localeCompare(b.name)).map(card).join('')}</div></section>`).join('')
}

function card(t) {
  const st = techStats(t.id), used = st.n || st.drilled || st.reps
  return `<article class="tech ${t.starred ? 'mine' : ''}">
    <div class="tech-top"><h3>${esc(t.name)}</h3><button class="star" data-act="star" data-id="${esc(t.id)}" aria-pressed="${!!t.starred}" aria-label="${t.starred ? 'Unstar' : 'Star'} ${esc(t.name)}">★</button></div>
    <span class="tech-type">${esc(t.type)}${isCustom(t) ? ' · added by you' : ''}${t.learned ? ' · <span class="learned">✓ learned</span>' : ''}</span>
    ${(t.photos || []).length ? `<div class="photos">${t.photos.slice(0, 4).map(id => `<button data-act="view-photo" data-id="${id}" aria-label="Open photo"><img data-photo="${id}" alt="${esc(t.name)}"></button>`).join('')}</div>` : ''}
    ${used ? `<div class="tech-stats"><span>Drilled <b>${st.drilled}</b></span><span>Rolls <b>${st.n}</b></span><span>Success <b>${pct(st.rate)}</b></span>${st.reps ? `<span>Reps <b>${st.reps.toLocaleString()}</b></span>` : ''}</div>` : ''}
    ${st.n ? `<div class="meter good"><span style="width:${Math.max(4, (st.rate || 0) * 100)}%"></span></div>` : ''}
    ${t.notes ? `<p class="small">${esc(trunc(t.notes, 160))}</p>` : ''}
    <div class="row-actions">
      ${/^https?:\/\//i.test(t.link || '')
        ? `<a class="btn sm ghost" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">My link</a>`
        : `<a class="btn sm ghost" href="${esc(videoSearch(t.name))}" target="_blank" rel="noopener noreferrer">Find videos</a>`}
      <button class="btn sm ghost" data-act="edit-tech" data-id="${esc(t.id)}">${t.notes || t.link ? 'Edit' : 'Add notes or link'}</button>
    </div>
  </article>`
}

function techForm(id) {
  const t = id ? techById(id) : { name: '', position: UI.libGroup || 'Half guard', type: 'Pass', notes: '', link: '', starred: true }
  if (!t) return
  const custom = !id || isCustom(t), own = S.tech.find(x => x.id === id)
  openSheet(id ? t.name : 'Add a move', `
    ${custom ? field('Name', `<input type="text" name="name" id="t-name" value="${esc(t.name)}" placeholder="Knee cut to back take" required>`) : ''}
    ${custom ? `<div class="grid2">${field('Position', selectEl('position', LIBRARY_GROUPS, t.position))}${field('Type', selectEl('type', TECH_TYPES, t.type))}</div>` : `<p class="hint">${esc(t.position)} · ${esc(t.type)}</p>`}
    ${field('Key details', `<textarea name="notes" id="t-notes" rows="4" placeholder="The two or three details that make it work for you">${esc(t.notes)}</textarea>`)}
    ${field('Video or reference link', `<input type="url" name="link" id="t-link" value="${esc(t.link)}" placeholder="https://youtube.com/…" inputmode="url">`)}
    <label class="chip"><input type="checkbox" name="starred" ${t.starred ? 'checked' : ''}><span>★ In my moves</span></label>
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Add move',
    deleteLabel: custom ? 'Delete move' : 'Clear my notes',
    onDelete: own ? () => remove(own) : null,
    onSubmit: fd => {
      const name = custom ? fd.get('name').trim() : t.name
      if (!name) { $('#form-error').textContent = 'Give the move a name.'; return false }
      const link = fd.get('link').trim()
      if (link && !/^https?:\/\//i.test(link)) { $('#form-error').textContent = 'Links start with https://'; return false }
      const rec = { ...(own || {}), id: id || newId('tech'), kind: 'tech', notes: fd.get('notes').trim(), link, starred: fd.has('starred') }
      if (custom) Object.assign(rec, { name, position: fd.get('position'), type: fd.get('type') })
      save(rec)
      toast(id ? 'Move saved' : 'Move added to your library')
    },
  })
}

export const actions = {
  'new-tech': () => techForm(),
  'edit-tech': el => techForm(el.dataset.id),
  'star': el => {
    const t = techById(el.dataset.id), own = S.tech.find(x => x.id === t.id)
    save({ ...(own || { id: t.id, kind: 'tech' }), starred: !t.starred })
  },
  'lib-scope': el => { UI.libScope = el.dataset.scope },
  'lib-group': el => { UI.libGroup = el.dataset.group },
}
