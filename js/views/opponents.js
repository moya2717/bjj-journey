// Rolls → Opponents: everyone you've named, your nemesis first, and each one's story to read.
import { S, save } from '../store.js'
import { UI } from '../ui.js'
import { esc, fmtDate, fmtDateLong, fmtMonthY, plural, toast } from '../util.js'
import { sizeLabel } from '../model.js'
import { opponent, opponents, storyOf, summaryOf } from '../rivals.js'

// The story's back button goes to the list of opponents, not to the roll notes.
const head = label => `<div class="sub-head"><button class="btn sm ghost" data-act="open-sub" data-sub="opponents">‹ Opponents</button><h1>${esc(label)}</h1></div>`

const RESULT_WORD = { worked: 'won', partial: 'even', broke: 'lost' }

// The last dozen results as dots, oldest first, so a card reads like a form guide.
const form = o => `<span class="opp-form" aria-label="Last ${Math.min(12, o.n)}: ${o.entries.slice(-12).map(storyResult).join(', ')}">${o.entries.slice(-12).map(x => `<i class="${storyResult(x)}"></i>`).join('')}</span>`
const storyResult = x => RESULT_WORD[x.isRound ? (x.wins > x.losses ? 'worked' : x.wins < x.losses ? 'broke' : 'partial') : x.result] || 'even'
const who = o => [o.level && o.level !== 'Unknown' && `${o.level.toLowerCase()} belt`, o.size && sizeLabel(o.size), o.styles.slice(0, 2).join(', ').toLowerCase()].filter(Boolean).join(', ')

function card(o) {
  return `<button class="opp-card ${o.nemesis ? 'nemesis' : ''}" data-act="open-sub" data-sub="opp:${esc(o.key)}">
    <span class="opp-top"><b>${esc(o.name)}</b>${o.nemesis ? '<span class="opp-badge">Nemesis</span>' : ''}<span class="opp-rec">${o.won}–${o.even}–${o.lost}</span></span>
    <span class="small muted">${esc([plural(o.n, 'roll'), who(o)].filter(Boolean).join(' · '))}</span>
    ${form(o)}
    <span class="small">${o.weapon ? `Their weapon: ${esc(o.weapon.tech.name.toLowerCase())} (${o.weapon.times}×)` : `Last rolled ${esc(fmtDate(o.last))}`}</span>
  </button>`
}

export function opponentList() {
  const list = opponents()
  if (!list.length) return `<div class="empty-state"><h2>No opponents yet</h2><p>Put a name on a roll or a positional round, and that partner gets a page here: your record, their go-to move, and the story of every roll with them.</p><button class="btn" data-act="new-roll">Log a roll</button></div>`
  const nemesis = list.find(o => o.nemesis), rest = list.filter(o => !o.nemesis)
  return `${nemesis ? `<section class="nemesis-hero"><p class="w-lbl">Your nemesis</p>${card(nemesis)}</section>` : ''}
    <p class="small muted opp-legend">Record is won–even–lost. Dots are the latest rolls, oldest first.</p>
    <div class="opp-list">${rest.map(card).join('')}</div>`
}

export function opponentStory(key) {
  const o = opponent(key)
  if (!o) return head('Opponent') + '<p class="muted">No rolls with this partner any more.</p>'
  const story = storyOf(o), shown = UI.more['opp:' + key] || 10, hidden = Math.max(0, story.length - shown)
  return `${head(o.name)}
    <section class="opp-hero ${o.nemesis ? 'nemesis' : ''}">
      ${o.nemesis ? '<span class="opp-badge">Nemesis</span>' : ''}
      <div class="opp-score"><span><b>${o.won}</b>won</span><span><b>${o.even}</b>even</span><span><b>${o.lost}</b>lost</span></div>
      ${form(o)}
      <p class="small muted">${esc(who(o) || 'Rolling partner')} · since ${esc(fmtMonthY(o.first))}</p>
      <div class="opp-sofar">${summaryOf(o).map(l => `<p>${esc(l)}</p>`).join('')}</div>
      <button class="link small" data-act="pin-nemesis" data-key="${esc(o.key)}">${o.nemesis ? 'Not my nemesis' : 'Make them my nemesis'}</button>
    </section>
    <h2 class="opp-h">The story</h2>
    ${hidden ? `<button class="btn ghost show-more" data-act="show-more" data-k="opp:${esc(key)}" data-n="10">Show ${Math.min(10, hidden)} earlier ${hidden === 1 ? 'roll' : 'rolls'}</button>` : ''}
    <ol class="opp-story">${story.slice(-shown).map(scene).join('')}</ol>
    <div class="row-actions"><button class="btn sm" data-act="new-roll">Log a roll</button></div>`
}

function scene(s) {
  return `<li class="opp-scene ${esc(s.outcome)}">
    <p class="opp-when"><b>${esc(s.title)}</b> · ${esc(fmtDateLong(s.date))}</p>
    ${s.beats.map(b => `<p class="opp-beat">${esc(b)}</p>`).join('')}
    ${s.scene ? `<p>${esc(s.scene)}</p>` : ''}
    ${s.end ? `<p class="opp-end">${esc(s.end)}</p>` : ''}
    ${s.words ? `<blockquote>${esc(s.words)}</blockquote>` : ''}
    ${s.next ? `<p class="small muted">Plan for next time: ${esc(s.next.text)}${s.next.status === 'worked' ? ' (it worked)' : s.next.status === 'failed' ? ' (it didn’t work)' : ''}</p>` : ''}
    ${s.isRound ? '' : `<button class="link small" data-act="edit-roll" data-id="${esc(s.id)}">Edit</button>`}
  </li>`
}

export const actions = {
  'pin-nemesis': el => {
    const o = opponent(el.dataset.key)
    if (!o) return
    save({ ...S.settings, nemesis: o.nemesis ? '-' : o.key })
    toast(o.nemesis ? `${o.name} is off the hook` : `${o.name} is your nemesis now`)
  },
}
