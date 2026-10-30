import { S, save, remove } from '../store.js'
import { UI } from '../ui.js'
import { $, esc, newId, plural, slug, sum, toast } from '../util.js'
import { isOpen, more, subHead, subOf, tile } from './hub.js'
import { field, openSheet } from '../sheet.js'
import { masteryOf, techById } from '../model.js'
import { masteryButton } from './library.js'
import { GAME_MAPS } from '../maps.js'
import { CHECKLISTS, GLOSSARY, POINTS, RESOURCE_GROUPS } from '../resources.js'
import { videoSearch } from '../catalog.js'
import { VIDEOS, TIPS_INSTRUCTORS } from '../videos.js'
import { actions as videoActions, instructorsHub, libraryHub } from './videos.js'

const isAdded = map => S.seq.some(s => s.fromMap === map.id)

// Fold-outs remember whether they're open, so ticking a box doesn't close them.
const fold = key => `data-fold="${key}" ${isOpen(key) ? 'open' : ''}`

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
  const first = map.nodes.find(n => !n.parentId), reactions = map.nodes.filter(n => n.who === 'them').length
  return `<details class="map-card" ${fold('map:' + map.id)}>
    <summary><span class="map-title">${esc(map.name)}</span>
      <span class="map-preview"><span class="tag pos">${esc(map.position)}</span>${isAdded(map) ? '<span class="tag good">In my sequences</span>' : ''}</span>
      <span class="small muted">${esc(first?.label || '')}${reactions ? ` → ${plural(reactions, 'reaction')} mapped` : ''}</span></summary>
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

// A tile per kind of resource; each opens as its own sub-screen.
export function view() {
  const mine = [...S.link].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), sub = subOf('resources')
  const head = `<div class="page-head"><div><h1>Resources</h1><p class="lede">Game maps, belt checklists, videos, the language of the mat and places to learn.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-link">Save a link</button></div></div>`
  const group = RESOURCE_GROUPS.find(g => 'g:' + g.title === sub)
  if (group) return subHead(group.title, 'Resources') + `<div class="res-grid">${group.items.map(i => linkCard(i, false)).join('')}</div>`
  if (sub === 'videos') return subHead('Video library', 'Resources') + libraryHub()
  if (sub === 'instructors') return subHead('Instructors on bjj.tips', 'Resources') + instructorsHub()
  if (sub === 'maps') return subHead('Game maps', 'Resources') + `
      <p class="small muted" style="margin-bottom:10px;max-width:70ch">Decision trees for common positions: your move, how partners usually react, and an answer for each. Add one to Sequences, then edit it and log rolls against it.</p>
      ${MAP_GROUPS.map(([role, title]) => {
        const maps = GAME_MAPS.filter(m => m.role === role)
        return maps.length ? `<h3 class="map-group">${title} <span class="small muted">${maps.length}</span></h3><div class="stack">${maps.map(mapCard).join('')}</div>` : ''
      }).join('')}`
  if (sub === 'belts') return subHead('Belt checklists', 'Resources') + `
      <p class="small muted" style="margin-bottom:10px;max-width:70ch">The moves most coaches expect you to know before the next belt. Each climbs four levels: seen it, drilled it, hit it in sparring, hit it on a higher belt. Your logs fill these in; tap a level to raise it yourself.</p>
      <div class="stack">${CHECKLISTS.map(checklist).join('')}</div>`
  if (sub === 'glossary') return subHead('Glossary', 'Resources') + `<p class="small muted">${GLOSSARY.length} terms you’ll hear on the mat</p>
      <dl class="glossary">${GLOSSARY.map(([term, meaning]) => `<dt>${esc(term)}</dt><dd>${esc(meaning)}</dd>`).join('')}</dl>`
  if (sub === 'points') return subHead('Competition points', 'Resources') + `<p class="small muted">IBJJF scoring at a glance</p>
      <div class="table-scroll" style="margin-top:10px"><table><thead><tr><th scope="col">Position</th><th scope="col">Points</th></tr></thead>
        <tbody>${POINTS.table.map(([what, pts]) => `<tr><td>${esc(what)}</td><td>${pts}</td></tr>`).join('')}</tbody></table></div>
      <ul class="small" style="margin:10px 0 0;padding-left:18px">${POINTS.notes.map(n => `<li style="margin:4px 0">${esc(n)}</li>`).join('')}</ul>
      <p class="small muted" style="margin-top:8px">Rules change. Check the current rule book on <a href="https://ibjjf.com/" target="_blank" rel="noopener noreferrer">ibjjf.com</a> before you compete.</p>`
  if (sub === 'links') return subHead('My links', 'Resources') + `<div class="row-actions" style="margin-bottom:10px"><button class="btn sm" data-act="new-link">Save a link</button></div>
      ${mine.length ? `<div class="res-grid">${more('links', mine, 10, l => linkCard(l, true))}</div>` : '<p class="muted">Save instructionals, videos and articles you want to come back to.</p>'}`
  const added = GAME_MAPS.filter(isAdded).length
  const lists = CHECKLISTS.map(list => list.moves.map(name => techById('c:' + slug(name))).filter(Boolean)), learned = sum(lists, l => l.filter(t => masteryOf(t).level >= 3).length)
  return head + `<div class="dojo-tiles">
      ${tile('maps', 'Game maps', GAME_MAPS.length, added ? `${added} in your sequences` : 'decision trees')}
      ${tile('belts', 'Belt checklists', `${learned}<small>/${sum(lists, l => l.length)}</small>`, 'hit in sparring')}
      ${tile('videos', 'Video library', VIDEOS.length, 'checked by hand')}
      ${tile('instructors', 'Instructors', TIPS_INSTRUCTORS.length, 'on bjj.tips')}
      ${tile('links', 'My links', mine.length, mine[0] ? esc(mine[0].name) : 'save your own')}
      ${tile('glossary', 'Glossary', GLOSSARY.length, 'terms on the mat')}
      ${tile('points', 'Points', POINTS.table.length, 'IBJJF scoring')}
      ${RESOURCE_GROUPS.map(g => tile('g:' + g.title, esc(g.title), g.items.length, esc(g.items[0]?.name || ''))).join('')}
    </div>`
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

const MAP_GROUPS = [['Top', 'Attacking from top'], ['Bottom', 'From bottom'], ['Neutral', 'Standing']]

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
  ...videoActions,
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
