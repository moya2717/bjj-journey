// Shared layout for screens that open on a summary, like Profile and Stats: tiles that open sub-screens,
// lists that show the first few with "Show more", and folds that remember whether they're open.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { esc, toast } from '../util.js'
import { isSimple } from '../model.js'

export const subOf = view => UI.sub[view] || ''

// A tile: a label, one key number, a short line and an optional sparkline. It opens a sub-screen
// of this screen, or with `view` one of another screen. A tap on the sparkline reads out a bar
// instead, so those tiles show a › for the part that opens.
export const tile = (sub, label, big, small, { view = '', spark = '', cls = '' } = {}) =>
  `<button class="dojo-tile ${cls}" data-act="${view ? 'goto' : 'open-sub'}" ${view ? `data-view="${view}" data-anchor="${sub}"` : `data-sub="${sub}"`}>
    ${spark ? '<span class="tile-go" aria-hidden="true">›</span>' : ''}<span class="w-lbl">${label}</span><span class="dojo-big">${big}</span>${spark}<span class="dojo-small">${small}</span></button>`

export const subHead = (label, back) => `<div class="sub-head"><button class="btn sm ghost" data-act="open-sub" data-sub="">‹ ${esc(back)}</button><h1>${esc(label)}</h1></div>`

// The first n items, and a button for the next n.
export const moreButton = (key, total, n) => {
  const left = total - (UI.more[key] || n)
  return left > 0 ? `<button class="btn ghost show-more" data-act="show-more" data-k="${key}" data-n="${n}">Show ${Math.min(n, left)} more${left > n ? ` <span class="muted">of ${left}</span>` : ''}</button>` : ''
}
export const more = (key, items, n, render) => items.slice(0, UI.more[key] || n).map(render).join('') + moreButton(key, items.length, n)

// Folds stay open or closed the way you left them, on this device.
const KEY = 'bjj-folds'
let folds = {}
try { folds = JSON.parse(localStorage.getItem(KEY)) || {} } catch {}
export const isOpen = (key, open = false) => folds[key] ?? open
export const fold = (key, summary, body, open = false) =>
  `<details class="fold" data-fold="${key}" ${isOpen(key, open) ? 'open' : ''}><summary>${summary}<span aria-hidden="true">›</span></summary>${body}</details>`
document.addEventListener('toggle', e => {
  const d = e.target
  if (!d.dataset?.fold) return
  folds[d.dataset.fold] = d.open
  try { localStorage.setItem(KEY, JSON.stringify(folds)) } catch {}
}, true)

// Simple mode: a row into the Advanced stats hub, and a quiet link at the bottom of a screen that
// switches the whole app between Simple and Advanced.
export const advancedRow = () => isSimple() ? `<button class="dojo-row" data-act="goto" data-view="stats" data-anchor="advanced"><span><b>Advanced stats</b><span class="small muted">Load, matchups, energy and sleep, trends and the rest</span></span><span aria-hidden="true">›</span></button>` : ''
export const modeLink = () => `<p class="mode-link"><button class="link small" data-act="set-mode" data-mode="${isSimple() ? 'advanced' : 'simple'}">${isSimple() ? 'Show advanced stats' : 'Switch to the simple view'}</button></p>`

export const actions = {
  'set-mode': el => { save({ ...S.settings, mode: el.dataset.mode }); toast(el.dataset.mode === 'simple' ? 'Simple view: just the essentials' : 'Advanced: every stat and chart'); scrollTo(0, 0) },
  'open-sub': el => { UI.sub[UI.view] = el.dataset.sub; scrollTo(0, 0) },
  'show-more': el => { UI.more[el.dataset.k] = (UI.more[el.dataset.k] || +el.dataset.n) + +el.dataset.n },
}
