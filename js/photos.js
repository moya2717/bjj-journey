import { putPhotos, getPhoto, deletePhotos } from './store.js'
import { $, $$, newId } from './util.js'

const MAX_SIDE = 1600
const urls = new Map()

// Shrinks a camera photo to a sensible size before storing it, so the journal stays small.
async function shrink(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
}

export async function addPhotos(files) {
  const photos = []
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    photos.push({ id: newId('photo'), blob: await shrink(file).catch(() => file), addedAt: Date.now() })
  }
  await putPhotos(photos)
  return photos.map(p => p.id)
}

export async function removePhotos(ids) {
  ids.forEach(id => { URL.revokeObjectURL(urls.get(id)); urls.delete(id) })
  await deletePhotos(ids)
}

export async function photoURL(id) {
  if (!urls.has(id)) {
    const photo = await getPhoto(id)
    if (!photo) return ''
    urls.set(id, URL.createObjectURL(photo.blob))
  }
  return urls.get(id)
}

// Views render <img data-photo="id">; this fills in the real image afterwards.
export function hydratePhotos(root = document) {
  $$('img[data-photo]', root).forEach(async img => { img.src = await photoURL(img.dataset.photo) })
}

// Full-screen photos: swipe sideways between them; × or the Escape key closes.
export function openViewer(ids, start = 0) {
  let dlg = $('#viewer')
  if (!dlg) { document.body.insertAdjacentHTML('beforeend', '<dialog id="viewer" class="viewer"></dialog>'); dlg = $('#viewer') }
  dlg.innerHTML = `<div class="viewer-strip">${ids.map(id => `<div class="viewer-slide"><img data-photo="${id}" alt="Training photo"></div>`).join('')}</div>
    <button type="button" class="icon-btn viewer-x" aria-label="Close">×</button>${ids.length > 1 ? '<p class="viewer-count" aria-live="polite"></p>' : ''}`
  hydratePhotos(dlg)
  const strip = $('.viewer-strip', dlg), count = $('.viewer-count', dlg)
  const show = () => { if (count) count.textContent = `${Math.round(strip.scrollLeft / strip.clientWidth) + 1} / ${ids.length}` }
  strip.addEventListener('scroll', show, { passive: true })
  $('.viewer-x', dlg).onclick = () => dlg.close()
  dlg.showModal()
  strip.scrollLeft = start * strip.clientWidth
  show()
}
