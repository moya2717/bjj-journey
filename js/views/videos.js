// Videos on move and position pages, and the Video library in Resources. Nothing loads until you tap:
// a video opens on YouTube (the app, on iPhone), or plays here from youtube-nocookie.com when you ask.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { POSITIONS } from '../vocab.js'
import { $, esc, newId, toast, today } from '../util.js'
import { field, openSheet } from '../sheet.js'
import { techById } from '../model.js'
import { videoSearch } from '../catalog.js'
import { CREATORS, TIPS, TIPS_INSTRUCTORS, VIDEOS, tipsFor, youtubeId } from '../videos.js'
import { more } from './hub.js'
import { actions as study } from './study.js'

// Your own video links are saved links pinned to a move id or a position name.
const asVideo = l => ({ id: l.id, title: l.name, by: 'Your link', url: l.url, kind: 'video', own: true })
const mineAt = at => S.link.filter(l => l.at === at).map(asVideo)
const find = id => VIDEOS.find(v => v.id === id) || asVideo(S.link.find(l => l.id === id) || {})

export const offline = () => navigator.onLine ? '' : '<p class="hint">You’re offline. The links are here, but videos need a connection.</p>'
export const commission = '<p class="hint">bjj.tips lists free YouTube videos and paid BJJ Fanatics courses, and may earn a commission on those course links.</p>'

function videoItem(v) {
  const yt = youtubeId(v.url)
  return `<div class="res-item vid">
    <a class="res-name" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)} <span aria-hidden="true">↗</span></a>
    <p class="small muted">${v.creator === 'John Danaher' && v.kind !== 'channel' ? 'John Danaher · ' : ''}${esc(v.by)}${v.paid ? ' · <span class="tag pos">Paid</span>' : v.kind === 'channel' ? ' · Channel' : ''}</p>
    ${v.note ? `<p class="small muted">${esc(v.note)}</p>` : ''}
    ${yt || v.own ? `<div class="row-actions">
      ${yt ? `<button class="mini" data-act="vid-play" data-yt="${yt}" aria-expanded="false">Play here</button><button class="mini" data-act="vid-study" data-id="${esc(v.id)}">Save to my study</button>` : ''}
      ${v.own ? `<button class="mini" data-act="edit-link" data-id="${esc(v.id)}">Edit</button>` : ''}</div><div class="vid-frame"></div>` : ''}
  </div>`
}

// [label, url] pairs as one line of links.
const links = list => list.map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join(' · ')
const tipsLine = pos => {
  const pages = tipsFor(pos)
  return pages.length ? `<p class="small vid-tips">Watch on bjj.tips: ${links(pages)} <span class="muted">(free videos and paid courses; it may earn a commission on course links)</span></p>`
    : `<p class="small vid-tips">bjj.tips has no page for ${esc(pos || 'this')}. ${links([['Browse its positions', TIPS + 'positions.html']])}</p>`
}

// A move page passes its id and the position it's filed under; a position page passes just the position.
export function videosSection({ techId = '', pos }) {
  const at = techId || pos, curated = VIDEOS.filter(v => techId ? v.techIds.includes(techId) : v.position === pos)
  const list = [...mineAt(at), ...curated]
  return `<section class="flow-card"><h2>Videos</h2>
    ${list.length ? `<div class="vid-list">${more('vid:' + at, list, 4, videoItem)}</div>` : '<p class="hint">No checked videos for this yet. Paste one you like, or search.</p>'}
    <div class="row-actions">
      <button class="btn sm ghost" data-act="vid-add" data-at="${esc(at)}">Paste a YouTube link</button>
      <a class="btn sm ghost" href="${esc(videoSearch(techId ? techById(techId)?.name || pos : pos))}" target="_blank" rel="noopener noreferrer">Search YouTube</a>
    </div>
    ${tipsLine(pos)}${offline()}
  </section>`
}

// ---------- Resources: Video library and bjj.tips instructors ----------

const filters = () => UI.vidF ||= { creator: '', pos: '', type: '' }
const pill = (key, value, label) => `<button class="pill" data-act="vid-filter" data-k="${key}" data-v="${esc(value)}" aria-pressed="${filters()[key] === value}">${esc(label)}</button>`

export function libraryHub() {
  const f = filters(), positions = POSITIONS.filter(p => VIDEOS.some(v => v.position === p))
  const shown = VIDEOS.filter(v => (!f.creator || v.creator === f.creator) && (!f.pos || v.position === f.pos) && (!f.type || (f.type === 'paid') === !!v.paid))
  return `<p class="small muted" style="margin-bottom:10px;max-width:70ch">Free videos from the creators’ own channels, each checked by hand, plus paid courses marked Paid. Tap a title to watch on YouTube, or Play here.</p>
    <div class="vid-filters">
    <div class="pos-filter sticky-chips" role="group" aria-label="Filter by creator">${pill('creator', '', 'Everyone')}${CREATORS.map(c => pill('creator', c, c)).join('')}</div>
    <div class="pos-filter sticky-chips" role="group" aria-label="Filter by type">${pill('type', '', 'Free and paid')}${pill('type', 'free', 'Free')}${pill('type', 'paid', 'Paid')}</div>
    <div class="pos-filter sticky-chips" role="group" aria-label="Filter by position">${pill('pos', '', 'Any position')}${positions.map(p => pill('pos', p, p)).join('')}</div></div>
    ${offline()}
    ${shown.length ? `<div class="res-grid">${more('vidlib', shown, 12, videoItem)}</div>` : '<p class="muted">Nothing matches. Try fewer filters.</p>'}
    <p class="small muted" style="margin-top:12px">Checked ${esc(VIDEOS[0].verified)}. More by position and instructor on <a href="${TIPS}" target="_blank" rel="noopener noreferrer">bjj.tips</a>.</p>`
}

export const instructorsHub = () => `<p class="small muted" style="margin-bottom:10px;max-width:70ch">Each instructor’s page on bjj.tips lists their YouTube videos and courses. By position: ${links([['all positions', TIPS + 'positions.html']])}.</p>
  ${commission}
  <div class="res-grid" style="margin-top:10px">${TIPS_INSTRUCTORS.map(([name, url]) => `<div class="res-item"><a class="res-name" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)} <span aria-hidden="true">↗</span></a></div>`).join('')}</div>`

function addForm(at) {
  const label = techById(at)?.name || at
  openSheet('Add a video', `
    <p class="hint">For ${esc(label)}. Copy the link from YouTube’s Share button and paste it here.</p>
    ${field('YouTube link', `<input type="url" name="url" id="vid-url" placeholder="https://youtu.be/…" inputmode="url" required>`)}
    ${field('Title', `<input type="text" name="name" id="vid-name" placeholder="What it shows">`)}
    <p class="form-error" id="form-error"></p>`, {
    submitLabel: 'Add video',
    onSubmit: fd => {
      const id = youtubeId(fd.get('url'))
      if (!id) { $('#form-error').textContent = 'That isn’t a YouTube video link. It looks like https://youtu.be/… or https://www.youtube.com/watch?v=…'; return false }
      save({ id: newId('link'), kind: 'link', at, name: fd.get('name').trim() || `${label} video`, url: 'https://www.youtube.com/watch?v=' + id, note: '' })
      toast('Video added')
    },
  })
}

export const actions = {
  'vid-filter': el => { filters()[el.dataset.k] = el.dataset.v; UI.more.vidlib = 0 },
  'vid-add': el => addForm(el.dataset.at),
  // Plays in place without redrawing the page; tap again to close it.
  'vid-play': el => {
    const frame = el.closest('.vid').querySelector('.vid-frame'), open = el.getAttribute('aria-expanded') === 'true'
    if (!open && !navigator.onLine) { toast('Videos need a connection'); return false }
    frame.innerHTML = open ? '' : `<iframe src="https://www.youtube-nocookie.com/embed/${el.dataset.yt}?autoplay=1&rel=0" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
    el.setAttribute('aria-expanded', !open)
    el.textContent = open ? 'Play here' : 'Close video'
    return false
  },
  // Adds it to Study's video list once, then opens it there for timestamped notes.
  'vid-study': el => {
    const v = find(el.dataset.id), url = 'https://www.youtube.com/watch?v=' + youtubeId(v.url)
    const had = S.study.find(s => youtubeId(s.url) === youtubeId(url)), id = had?.id || newId('study')
    if (!had) save({ id, kind: 'study', title: v.title, url, date: today(), minutes: 0, notes: [] })
    toast(had ? 'Already in your study' : 'Saved to Study')
    study['edit-study']({ dataset: { id } })
  },
}
