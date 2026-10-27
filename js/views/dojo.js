// The Dojo: your character, quests, story, shop and Live roll, each a tab in their own section.
// Every screen is meant to fit one phone screen: the Character tab is a hub of tiles that open
// sub-screens, and chapters open in a sheet. Everything shown is read from the journal by game.js
// and chronicle.js; only your picks are saved.
import { S } from '../store.js'
import { UI } from '../ui.js'
import { esc, fmtMonthY, plural, toast, trunc } from '../util.js'
import { openSheet } from '../sheet.js'
import { LEVEL_TOKENS, SHOP, SLOT_NAMES, STAT_HINTS, archetype, badges, balance, cantBuy, equipped, fighterName, freezesLeft, game, hasAbility,
  levelOf, levelRewards, owns, questsOn, run, saveGame, stats, tierOf, title, xpBreakdown } from '../game.js'
import { chapterText, chronicle, sinceLabel } from '../chronicle.js'
import { avatar, coin, missionsPanel, questBoard, xpBar } from './character.js'

// The last Dojo tab and sub-screen come back next time you open the app.
const KEY = 'bjj-dojo'
export function lastDojo() { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
export function remember(view) { try { localStorage.setItem(KEY, JSON.stringify({ view, sub: UI.dojoSub || '' })) } catch {} }

const share = async text => {
  try {
    if (navigator.share) await navigator.share({ text })
    else { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere.') }
  } catch (e) {
    if (e.name === 'AbortError') return
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere.') } catch { toast('Couldn’t copy. Try again.') }
  }
}

const ICONS = { reshuffle: '↻', scout: '◎', freeze: '❄' }
const isOwned = id => SHOP[id].ability ? hasAbility(id) : owns(id)
const cosmetics = () => Object.keys(SHOP).filter(id => !SHOP[id].ability)
const abilities = () => Object.keys(SHOP).filter(id => SHOP[id].ability)

// ---------- Character hub ----------

function hero() {
  const lv = levelOf()
  return `<section class="dojo-hero">
    <div class="dojo-av">${avatar({ label: `${fighterName()}, level ${lv.level}` })}</div>
    <div class="dojo-id">
      <p class="w-lbl">Level ${lv.level} · ${esc(archetype().name)}</p>
      <h1>${esc(fighterName())}</h1>
      <p class="char-title">${esc(title())}</p>
      ${xpBar(lv.pct)}
      <p class="small muted">${lv.into.toLocaleString()} / ${lv.need.toLocaleString()} XP to level ${lv.level + 1}</p>
      <div class="dojo-id-row">${coin(balance())}<button class="btn sm ghost" data-act="game-edit">Edit</button></div>
    </div>
  </section>`
}

function hub() {
  const lv = levelOf().level, st = stats(), best = [...st].sort((a, b) => b.value - a.value)[0], b = badges()
  const next = levelRewards(Math.max(30, lv + 10)).find(r => r.level > lv && r.rewards.length)
  const mine = abilities().filter(hasAbility), ch = chronicle().at(-1), done = questsOn(new Date().toLocaleDateString('sv')).filter(q => q.done).length
  const tile = (sub, label, big, small, act = 'dojo-sub') => `<button class="dojo-tile" data-act="${act}" data-sub="${sub}" ${act === 'tab' ? `data-view="${sub}"` : ''}>
    <span class="w-lbl">${label}</span><span class="dojo-big">${big}</span><span class="dojo-small">${small}</span></button>`
  return `${hero()}
    <div class="dojo-tiles">
      ${tile('inventory', 'Inventory', cosmetics().filter(owns).length, 'items to wear')}
      ${tile('stats', 'Stats', `${best.value}`, esc(best.name))}
      ${tile('titles', 'Titles', `${b.filter(x => x.earned).length}<small>/${b.length}</small>`, esc(trunc(title(), 18)))}
      ${tile('rewards', 'Level rewards', next ? `Lv ${next.level}` : '—', next ? esc(trunc(next.rewards[0], 22)) : 'All unlocked')}
      ${tile('abilities', 'Abilities', `${mine.length}<small>/${abilities().length}</small>`, mine.length ? esc(trunc(mine.map(id => SHOP[id].name).join(', '), 22)) : 'In the shop')}
      ${tile('story', 'Story', `Ch ${ch.n}`, 'in progress', 'tab')}
    </div>
    <button class="dojo-row" data-act="tab" data-view="quests"><span><b>Today’s quests</b><span class="small muted">${done} of 3 done</span></span><span aria-hidden="true">›</span></button>`
}

const subHead = label => `<div class="sub-head"><button class="btn sm ghost" data-act="dojo-sub" data-sub="">‹ Character</button><h1>${label}</h1></div>`

// ---------- Inventory and shop: one browser ----------

// Slot tabs, filter chips, a grid of small previews, and a sticky avatar showing the picked item.
function browser(mode) {
  const shop = mode === 'shop', eq = equipped(), slots = [...(shop ? ['abilities'] : []), ...Object.keys(SLOT_NAMES)]
  const slot = slots.includes(UI[mode + 'Slot']) ? UI[mode + 'Slot'] : 'kit'
  const filter = UI[mode + 'Filter'] || (shop ? 'all' : 'owned')
  const ids = Object.keys(SHOP).filter(id => slot === 'abilities' ? SHOP[id].ability : SHOP[id].slot === slot)
  const shown = ids.filter(id => filter === 'all' || (filter === 'owned') === isOwned(id))
  const sel = ids.includes(UI.itemSel) ? UI.itemSel : shown.includes(eq[slot]) ? eq[slot] : shown[0] || ''
  const it = SHOP[sel], on = it && !it.ability && eq[it.slot] === sel
  const action = !it ? '' : !it.ability && owns(sel)
    ? (on ? (it.slot === 'kit' ? '<button class="btn sm" disabled>Wearing</button>' : `<button class="btn sm ghost" data-act="game-equip" data-id="${sel}">Take off</button>`) : `<button class="btn sm" data-act="game-equip" data-id="${sel}">Wear</button>`)
    : cantBuy(sel) ? `<button class="btn sm ghost" disabled>${it.unlock && !owns(sel) ? '🔒 ' : ''}${esc(cantBuy(sel))}</button>`
    : `<button class="btn sm" data-act="game-buy" data-id="${sel}">Buy · ${it.price}</button>`
  const pill = (k, label, cur, act) => `<button class="pill" data-act="${act}" data-mode="${mode}" data-k="${k}" aria-pressed="${k === cur}">${label}</button>`
  const tag = id => { const x = SHOP[id]; return !x.ability && eq[x.slot] === id ? 'Wearing' : isOwned(id) ? (x.ability ? 'Owned' : shop ? 'Owned' : '') : x.unlock ? '🔒 Unlock' : x.level > levelOf().level ? `Lv ${x.level}` : `● ${x.price}` }
  return `<div class="inv-preview">
      ${it && !it.ability ? avatar({ items: { ...eq, [it.slot]: sel }, cls: 'inv-av', label: it.name }) : `<span class="ability-icon big" aria-hidden="true">${ICONS[sel] || '·'}</span>`}
      <div class="inv-info">${it ? `<span class="tier ${tierOf(it)}">${it.ability ? 'ability' : tierOf(it)}</span><b>${esc(it.name)}${sel === 'freeze' && hasAbility('freeze') ? ` (${freezesLeft()} held)` : ''}</b>
        <span class="small muted">${esc(it.desc)}</span>${action}` : '<span class="small muted">Nothing here yet. Try the Shop.</span>'}</div>
    </div>
    <div class="inv-slots" role="group" aria-label="Slot">${slots.map(k => pill(k, k === 'abilities' ? 'Abilities' : SLOT_NAMES[k], slot, 'inv-slot')).join('')}</div>
    <div class="inv-filters" role="group" aria-label="Show">${[['all', 'All'], ['owned', 'Owned'], ['locked', shop ? 'Not owned' : 'Locked']].map(([k, l]) => pill(k, l, filter, 'inv-filter')).join('')}</div>
    ${shown.length ? `<div class="inv-grid">${shown.map(id => `<button class="inv-tile ${id === sel ? 'sel' : ''} ${isOwned(id) ? '' : 'locked'}" data-act="item-pick" data-id="${id}" aria-pressed="${id === sel}" aria-label="${esc(SHOP[id].name)}">
      ${SHOP[id].ability ? `<span class="ability-icon" aria-hidden="true">${ICONS[id]}</span>` : avatar({ items: { ...eq, [SHOP[id].slot]: id }, cls: 'tile-av', label: '' })}
      <span class="inv-name">${esc(SHOP[id].name)}</span><span class="inv-tag">${tag(id)}</span></button>`).join('')}</div>`
      : `<p class="small muted">${filter === 'owned' ? 'Nothing owned in this slot yet.' : 'You own everything here.'}</p>`}`
}

// ---------- Sub-screens ----------

function statsSub() {
  const st = stats(), top = Math.max(25, ...st.map(s => s.value)), open = UI.statTip, arch = archetype()
  return `${subHead('Stats')}
    <p class="small muted">${esc(arch.name)}: ${esc(arch.why)}</p>
    <div class="stat-rows">${st.map(s => `<button class="stat-row" data-act="stat-tip" data-k="${s.name}" aria-expanded="${open === s.name}">
      <span>${s.name}</span><span class="meter mat"><span style="width:${s.value / top * 100}%"></span></span><b>${s.value}</b>
      ${open === s.name ? `<small>${esc(STAT_HINTS[s.name])}</small>` : ''}</button>`).join('')}</div>
    <p class="small muted">Tap a stat to see what feeds it.</p>
    <details class="fold"><summary><b>How you earn XP</b><span aria-hidden="true">›</span></summary>
      <table class="xp-table"><tbody>${xpBreakdown().filter(r => r.xp).map(r => `<tr><td>${esc(r.what)}</td><td>${r.xp.toLocaleString()}</td></tr>`).join('') || '<tr><td>Log a session to start earning.</td><td></td></tr>'}</tbody></table>
      <p class="small muted">Everything is counted from your journal. Every level also earns ${LEVEL_TOKENS} tokens.</p></details>`
}

function titlesSub() {
  const list = badges(), pick = game().title
  return `${subHead('Titles')}<p class="small muted">${list.filter(b => b.earned).length} of ${list.length} earned. Tap one to wear it under your name.</p>
    <div class="badge-grid">${list.map(b => b.earned
      ? `<button class="badge on" data-act="game-title" data-id="${b.id}" aria-pressed="${b.id === pick}"><b>${esc(b.name)}</b><span>${esc(b.how)}</span></button>`
      : `<div class="badge"><b>🔒 ${esc(b.name)}</b><span>${esc(b.how)}</span></div>`).join('')}</div>`
}

function rewardsSub() {
  const lv = levelOf().level, all = levelRewards(Math.max(30, lv + 10)).filter(r => r.rewards.length || r.level % 5 === 0)
  const at = Math.max(0, all.findIndex(r => r.level > lv) - 2), list = all.slice(at, at + 8), next = all.find(r => r.level > lv)
  return `${subHead('Level rewards')}<p class="small muted">You’re level ${lv}. Every level gives ${LEVEL_TOKENS} tokens; these bring more.</p>
    <ol class="track">${list.map(r => `<li class="${r.level <= lv ? 'got' : r === next ? 'next' : ''}"><span class="track-lv">${r.level}</span>
      <span>${r.rewards.length ? r.rewards.map(esc).join(' · ') : `+${LEVEL_TOKENS} tokens`}</span></li>`).join('')}</ol>`
}

function abilitiesSub() {
  return `${subHead('Abilities')}<p class="small muted">Perks for Live roll and your streak. They never change your journal.</p>
    <ul class="list">${abilities().map(id => `<li class="ability-row"><span class="ability-icon" aria-hidden="true">${ICONS[id]}</span>
      <span><b>${esc(SHOP[id].name)}</b> <span class="small muted">${hasAbility(id) ? (id === 'freeze' ? `${freezesLeft()} held` : 'Owned') : esc(cantBuy(id) || `${SHOP[id].price} tokens`)}</span><br><span class="small muted">${esc(SHOP[id].desc)}</span></span></li>`).join('')}</ul>
    <div class="row-actions"><button class="btn sm" data-act="shop-abilities">Abilities in the shop</button></div>`
}

const SUBS = { inventory: () => `${subHead('Inventory')}${browser('inventory')}`, stats: statsSub, titles: titlesSub, rewards: rewardsSub, abilities: abilitiesSub }

export const character = {
  view: () => `<h1 class="sr">Character</h1><div class="dojo">${(SUBS[UI.dojoSub] || hub)()}</div>`,
  actions: {
    'dojo-sub': el => { UI.dojoSub = el.dataset.sub; UI.itemSel = ''; scrollTo(0, 0) },
    'item-pick': el => { UI.itemSel = el.dataset.id },
    'inv-slot': el => { UI[el.dataset.mode + 'Slot'] = el.dataset.k; UI.itemSel = '' },
    'inv-filter': el => { UI[el.dataset.mode + 'Filter'] = el.dataset.k; UI.itemSel = '' },
    'stat-tip': el => { UI.statTip = UI.statTip === el.dataset.k ? '' : el.dataset.k },
    'game-title': el => { saveGame({ title: game().title === el.dataset.id ? '' : el.dataset.id }) },
    'shop-abilities': () => { UI.shopSlot = 'abilities'; UI.shopFilter = 'all'; UI.view = 'shop'; scrollTo(0, 0) },
  },
}

// ---------- Quests ----------

function historyRows() {
  const weeks = run().weeks.slice(-6).reverse()
  return weeks.length ? `<ul class="list week-list">${weeks.map(w => `<li><span><b>${new Date(w.from + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</b>
    <span class="small muted">${plural(w.done, 'quest')} · ${esc(w.boss.name)} ${w.boss.done ? 'beaten' : 'standing'}${w.hurt ? ' · healing' : ''}${w.frozen ? ' · freeze' : ''}</span></span>
    <span class="small">${w.kept ? '<span class="tag good">kept</span> ' : ''}+${w.earned}</span></li>`).join('')}</ul>` : '<p class="muted small">Your weeks show up here once you start logging.</p>'
}

export const quests = {
  view: () => `<h1 class="sr">Quests</h1>${questBoard()}
    <details class="fold"><summary><b>Missions</b><span class="small muted">The Open Mat Chronicles</span><span aria-hidden="true">›</span></summary>${missionsPanel()}</details>
    <details class="fold"><summary><b>History</b><span class="small muted">Last 6 weeks</span><span aria-hidden="true">›</span></summary>${historyRows()}</details>`,
}

// ---------- Story: the chronicle, a chapter at a time ----------

const teaser = c => c.current && !c.moments.length ? c.ending : c.moments.at(-1) || c.summary || c.ending

function readChapter(c) {
  const N = fighterName()
  openSheet(`Chapter ${c.n}: ${c.title}`, `
    ${c.from ? `<p class="small muted">${esc(sinceLabel(c))}${c.current ? ' · in progress' : ''}</p>` : ''}
    <div class="chapter-body">
      ${c.quiet ? `<p>${!S.session.length ? `Every black belt was once a white belt who kept showing up. ${esc(N)}’s story starts with the first class you log.` : c.current ? 'This chapter has only just begun. The next moments are yours to write.' : 'A quiet chapter: showing up, putting in the rounds, getting a little better each week.'}</p>` : c.moments.map(m => `<p>${esc(m)}</p>`).join('')}
      ${c.summary ? `<p class="small muted">${esc(c.summary)}</p>` : ''}
      ${c.ending ? `<p class="chapter-end">${esc(c.ending)}</p>` : ''}
    </div>
    ${c.quiet && !S.session.length ? '' : `<div class="row-actions"><button type="button" class="btn sm ghost" data-act="story-share" data-n="${c.n}">Share chapter</button></div>`}`)
}

export const story = {
  view() {
    const chapters = chronicle()
    return `<div class="page-head"><div><h1>The Story So Far</h1><p class="lede">${esc(fighterName())}’s journey, written from the journal. Tap a chapter to read it.</p></div></div>
      <div class="story-rows">${[...chapters].reverse().map(c => `<button class="story-row ${c.current ? 'current' : ''}" data-act="story-read" data-n="${c.n}">
        <span class="w-lbl">Chapter ${c.n}${c.from ? ` · ${fmtMonthY(c.from)} – ${c.to ? fmtMonthY(c.to) : 'now'}` : ''}${c.current ? ' · in progress' : ''}</span>
        <span class="story-title">${esc(c.title)}</span>
        <span class="story-teaser">${esc(teaser(c) || 'A story waiting for its first class.')}</span></button>`).join('')}</div>`
  },
  actions: {
    'story-read': el => { const c = chronicle()[+el.dataset.n - 1]; if (c) readChapter(c); return false },
    'story-share': el => { const c = chronicle()[+el.dataset.n - 1]; if (c) share(`${fighterName()}: The Story So Far\n\n${chapterText(c)}`); return false },
  },
}

export const shop = {
  view: () => `<div class="sub-head"><h1>Shop</h1>${coin(balance())}</div><div class="dojo">${browser('shop')}</div>`,
}
