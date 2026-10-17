import { S, save, remove } from '../store.js'
import { UI } from '../ui.js'
import { $, $$, esc, newId, slug, toast } from '../util.js'
import { field, openSheet } from '../sheet.js'
import { masteryOf, techById } from '../model.js'
import { masteryButton } from './library.js'
import { GAME_MAPS } from '../maps.js'
import { CHECKLISTS, GLOSSARY, POINTS, RESOURCE_GROUPS } from '../resources.js'
import { videoSearch } from '../catalog.js'

const isAdded = map => S.seq.some(s => s.fromMap === map.id)

// Fold-outs remember whether they're open, so ticking a box doesn't close them.
const openState = new Set()
const fold = key => `data-fold="${key}" ${openState.has(key) ? 'open' : ''}`

function mapTree(map) {
  const children = parentId => map.nodes.filter(n => n.parentId === parentId)
  const node = n => {
    const tech = techById(n.techId), kids = children(n.id)
    return `<li><div class="node ${n.who}">
      <span class="who ${n.who}">${n.who === 'them' ? 'They' : 'You'}</span>
      <span class="node-label">${esc(n.label)}${tech && tech.name !== n.label ? ` <span class="node-tech">(${esc(tech.name)})</span>` : ''}</span>
    </div>${kids.length ? `<ul class="tree">${kids.map(node).join('')}</ul>` : ''}</li>`
  }
  return `<div class="tree-wrap"><ul class="tree">${children(null).map(node).join('')}</ul></div>`
}

function mapCard(map) {
  return `<details class="map-card" ${fold('map:' + map.id)}>
    <summary><span class="map-title">${esc(map.name)}</span><span class="small muted">${esc(map.position)}, ${esc(map.role.toLowerCase())} · ${map.nodes.length} steps</span></summary>
    <p class="small" style="margin:8px 0 4px;max-width:70ch">${esc(map.summary)}</p>
    ${mapTree(map)}
    <div class="row-actions">${isAdded(map)
      ? `<span class="promoted">In your sequences.</span> <button class="link" data-act="open-map" data-id="${map.id}">Open it</button>`
      : `<button class="btn sm" data-act="add-map" data-id="${map.id}">Add to my sequences</button>`}</div>
  </details>`
}

const linkCard = (item, own) => `<div class="res-item">
  <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" class="res-name">${esc(item.name)} <span aria-hidden="true">↗</span></a>
  ${item.note ? `<p class="small muted">${esc(item.note)}</p>` : ''}
  ${own ? `<div><button class="mini" data-act="edit-link" data-id="${item.id}">Edit</button></div>` : ''}
</div>`

export function view() {
  const mine = [...S.link].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return `<div class="page-head"><div><h1>Resources</h1><p class="lede">Game maps, belt checklists, the language of the mat and places to learn. Save your own links too.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-link">Save a link</button></div></div>
    <section class="ach-section"><h2>Game maps</h2>
      <p class="small muted" style="margin-bottom:10px;max-width:70ch">Decision trees for common positions: your move, how partners usually react, and an answer for each. Add one to Sequences, then edit it and log rolls against it.</p>
      <div class="stack">${GAME_MAPS.map(mapCard).join('')}</div>
    </section>
    <section class="ach-section"><h2>Belt checklists</h2>
      <p class="small muted" style="margin-bottom:10px;max-width:70ch">The moves most coaches expect you to know before the next belt. Each climbs four levels: seen it, drilled it, hit it in sparring, hit it on a higher belt. Your logs fill these in; tap a level to raise it yourself.</p>
      <div class="stack">${CHECKLISTS.map(checklist).join('')}</div>
    </section>
    <section class="ach-section"><h2>Know the language</h2><div class="stack">
      <details class="map-card" ${fold('glossary')}><summary><span class="map-title">Glossary</span><span class="small muted">${GLOSSARY.length} terms you’ll hear on the mat</span></summary>
        <dl class="glossary">${GLOSSARY.map(([term, meaning]) => `<dt>${esc(term)}</dt><dd>${esc(meaning)}</dd>`).join('')}</dl></details>
      <details class="map-card" ${fold('points')}><summary><span class="map-title">Competition points</span><span class="small muted">IBJJF scoring at a glance</span></summary>
        <div class="table-scroll" style="margin-top:10px"><table><thead><tr><th scope="col">Position</th><th scope="col">Points</th></tr></thead>
          <tbody>${POINTS.table.map(([what, pts]) => `<tr><td>${esc(what)}</td><td>${pts}</td></tr>`).join('')}</tbody></table></div>
        <ul class="small" style="margin:10px 0 0;padding-left:18px">${POINTS.notes.map(n => `<li style="margin:4px 0">${esc(n)}</li>`).join('')}</ul>
        <p class="small muted" style="margin-top:8px">Rules change. Check the current rule book on <a href="https://ibjjf.com/" target="_blank" rel="noopener noreferrer">ibjjf.com</a> before you compete.</p></details>
    </div></section>
    <section class="ach-section"><h2>My links</h2>
      ${mine.length ? `<div class="res-grid">${mine.map(l => linkCard(l, true)).join('')}</div>` : '<p class="muted">Save instructionals, videos and articles you want to come back to.</p>'}
    </section>
    ${RESOURCE_GROUPS.map(g => `<section class="ach-section"><h2>${esc(g.title)}</h2><div class="res-grid">${g.items.map(i => linkCard(i, false)).join('')}</div></section>`).join('')}`
}

function checklist(list) {
  const moves = list.moves.map(name => techById('c:' + slug(name))).filter(Boolean)
  const learned = moves.filter(t => masteryOf(t).level >= 3).length
  return `<details class="map-card" ${fold('list:' + list.id)}>
    <summary><span class="map-title">${esc(list.title)}</span><span class="small muted">${learned} of ${moves.length} hit in sparring</span></summary>
    <div class="meter good" style="margin:10px 0"><span style="width:${Math.max(2, learned / moves.length * 100)}%"></span></div>
    <p class="small" style="margin-bottom:8px">${esc(list.note)}</p>
    <ul class="checklist">${moves.map(t => `<li>
      <span class="check-name">${esc(t.name)} <span class="small muted">${esc(t.position)}</span></span>
      ${masteryButton(t)}
      <a class="mini" href="${esc(t.link || videoSearch(t.name))}" target="_blank" rel="noopener noreferrer">Video</a>
    </li>`).join('')}</ul>
  </details>`
}

export function mount(root) {
  $$('details[data-fold]', root).forEach(d => d.addEventListener('toggle', () => {
    if (d.open) openState.add(d.dataset.fold)
    else openState.delete(d.dataset.fold)
  }))
}

function linkForm(id) {
  const l = id ? S.link.find(x => x.id === id) : { name: '', url: '', note: '' }
  if (!l) return
  openSheet(id ? 'Edit link' : 'Save a link', `
    ${field('Title', `<input type="text" name="name" id="l-name" value="${esc(l.name)}" placeholder="Half guard instructional" required>`)}
    ${field('Link', `<input type="url" name="url" id="l-url" value="${esc(l.url)}" placeholder="https://" inputmode="url" required>`)}
    ${field('Why it’s useful', `<textarea name="note" id="l-note" rows="2" placeholder="Volume 2 covers the knee shield">${esc(l.note)}</textarea>`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: id ? 'Save' : 'Save link',
    onDelete: id ? () => remove(l) : null,
    onSubmit: fd => {
      const name = fd.get('name').trim(), url = fd.get('url').trim()
      if (!name || !/^https?:\/\//i.test(url)) { $('#form-error').textContent = 'Add a title and a link that starts with https://'; return false }
      save({ ...(id ? l : {}), id: id || newId('link'), kind: 'link', name, url, note: fd.get('note').trim() })
    },
  })
}

export const actions = {
  'new-link': () => linkForm(),
  'edit-link': el => linkForm(el.dataset.id),
  'add-map': el => {
    const map = GAME_MAPS.find(m => m.id === el.dataset.id)
    if (!map || isAdded(map)) return
    const ids = Object.fromEntries(map.nodes.map(n => [n.id, newId('n')]))
    save({ id: newId('seq'), kind: 'seq', fromMap: map.id, name: map.name, position: map.position, role: map.role, notes: map.summary,
      nodes: map.nodes.map(n => ({ ...n, id: ids[n.id], parentId: n.parentId ? ids[n.parentId] : null })) })
    toast('Added to your sequences')
  },
  'open-map': el => {
    const seq = S.seq.find(s => s.fromMap === el.dataset.id)
    if (seq) { UI.seqSel = seq.id; UI.view = 'sequences'; scrollTo(0, 0) }
  },
}
