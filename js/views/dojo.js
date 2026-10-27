// The Dojo: your character, quests, story and shop, each a tab in their own section.
// Live roll sits alongside them. Everything shown is read from the journal by game.js and chronicle.js.
import { S } from '../store.js'
import { esc, fmtDate, plural, toast } from '../util.js'
import { BOSS_REWARD, LEVEL_TOKENS, SHOP, SLOT_NAMES, badges, equipped, fighterName, game, levelOf, levelRewards, owns, run, saveGame } from '../game.js'
import { chapterText, chronicle, sinceLabel } from '../chronicle.js'
import { characterPanel, itemTile, missionsPanel, questBoard, shopPanel } from './character.js'

const share = async text => {
  try {
    if (navigator.share) await navigator.share({ text })
    else { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere.') }
  } catch (e) {
    if (e.name === 'AbortError') return
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere.') } catch { toast('Couldn’t copy. Try again.') }
  }
}

// ---------- Character ----------

function inventoryPanel() {
  const eq = equipped(), lv = levelOf().level
  const mine = Object.keys(SHOP).filter(id => !SHOP[id].ability && owns(id))
  const abilities = Object.keys(SHOP).filter(id => SHOP[id].ability && (game().owned[id] || 0) > 0)
  return `<section class="panel wide" id="inventory"><div class="history-head"><h2 style="margin:0">Inventory</h2><button class="btn sm ghost" data-act="tab" data-view="shop">Shop</button></div>
    <p class="small muted">Tap to wear something. Tap “Wearing” again to take it off. Your kit always stays on.</p>
    ${Object.keys(SLOT_NAMES).filter(slot => mine.some(id => SHOP[id].slot === slot)).map(slot => `<h3>${SLOT_NAMES[slot]}</h3>
      <ul class="shop-grid">${mine.filter(id => SHOP[id].slot === slot).map(id => itemTile(id, eq, lv)).join('')}</ul>`).join('')}
    <h3>Abilities</h3>${abilities.length ? `<ul class="list">${abilities.map(id => `<li><b>${esc(SHOP[id].name)}</b> <span class="small muted">${esc(SHOP[id].desc)}</span></li>`).join('')}</ul>`
      : '<p class="small muted">None yet. Reshuffle and Scout help in Live roll; a streak freeze saves your quest streak.</p>'}
  </section>`
}

function badgesPanel() {
  const list = badges(), mine = list.filter(b => b.earned), pick = game().title
  return `<section class="panel" id="badges"><h2>Titles and badges</h2>
    <p class="small muted" style="margin:-6px 0 10px">${plural(mine.length, 'badge')} of ${list.length}. Tap one you’ve earned to wear it as your title.</p>
    <div class="badge-grid">${list.map(b => b.earned
      ? `<button class="badge on" data-act="game-title" data-id="${b.id}" aria-pressed="${b.id === pick}"><b>${esc(b.name)}</b><span>${esc(b.how)}</span></button>`
      : `<div class="badge"><b>${esc(b.name)}</b><span>${esc(b.how)}</span></div>`).join('')}</div>
  </section>`
}

function trackPanel() {
  const lv = levelOf().level, track = levelRewards(Math.max(30, lv + 5)).filter(r => r.rewards.length || r.level % 5 === 0)
  const next = track.find(r => r.level > lv)
  return `<section class="panel" id="track"><h2>Level rewards</h2>
    <p class="small muted" style="margin:-6px 0 10px">Every level gives ${LEVEL_TOKENS} tokens. These levels bring more.</p>
    <ol class="track">${track.map(r => `<li class="${r.level <= lv ? 'got' : r === next ? 'next' : ''}"><span class="track-lv">${r.level}</span>
      <span>${r.rewards.length ? r.rewards.map(esc).join(' · ') : `+${LEVEL_TOKENS} tokens`}${r === next ? ` <span class="tag">next</span>` : ''}</span></li>`).join('')}</ol>
  </section>`
}

export const character = {
  view: () => `<h1 class="sr">Character</h1><div class="stat-grid">${characterPanel()}${inventoryPanel()}${badgesPanel()}${trackPanel()}</div>`,
}

// ---------- Quests ----------

function weeksPanel() {
  const weeks = run().weeks.slice(-6).reverse()
  return `<section class="panel" id="weeks"><h2>Recent weeks</h2>
    ${weeks.length ? `<ul class="list week-list">${weeks.map(w => `<li><span><b>Week of ${fmtDate(w.from)}</b>
      <span class="small muted">${plural(w.done, 'quest')} · ${esc(w.boss.name)} ${w.boss.done ? 'beaten' : 'standing'}${w.hurt ? ' · healing' : ''}${w.frozen ? ' · freeze used' : ''}</span></span>
      <span class="small">${w.kept ? '<span class="tag good">streak kept</span>' : ''} +${w.earned}</span></li>`).join('')}</ul>`
      : '<p class="muted small">Your weeks show up here once you start logging.</p>'}
    <p class="small muted">Beating a boss is worth ${BOSS_REWARD.tokens} tokens and ${BOSS_REWARD.xp} XP.</p>
  </section>`
}

export const quests = {
  view: () => `<h1 class="sr">Quests</h1>${questBoard()}<div class="stat-grid">${missionsPanel()}${weeksPanel()}</div>`,
}

// ---------- Story: the chronicle ----------

export const story = {
  view() {
    const chapters = chronicle(), N = fighterName()
    return `<div class="page-head"><div><h1>The Story So Far</h1><p class="lede">${esc(N)}’s journey, written from the journal. A new chapter opens with every stripe and belt.</p></div></div>
      <div class="chronicle">${chapters.map(c => `<details class="chapter ${c.current ? 'current' : ''}" ${c.current || chapters.length === 1 ? 'open' : ''}>
        <summary><span class="w-lbl">Chapter ${c.n}${c.current ? ' · in progress' : ''}</span><span class="chapter-title">${esc(c.title)}</span>${c.from ? `<span class="small muted">${esc(sinceLabel(c))}</span>` : ''}</summary>
        <div class="chapter-body">
          ${c.quiet ? `<p>${!S.session.length ? `Every black belt was once a white belt who kept showing up. ${esc(N)}’s story starts with the first class you log.` : c.current ? 'This chapter has only just begun. The next moments are yours to write.' : 'A quiet chapter: showing up, putting in the rounds, getting a little better each week.'}</p>` : c.moments.map(m => `<p>${esc(m)}</p>`).join('')}
          ${c.summary ? `<p class="small muted">${esc(c.summary)}</p>` : ''}
          ${c.ending ? `<p class="chapter-end">${esc(c.ending)}</p>` : ''}
          ${c.quiet && !S.session.length ? '' : `<div class="row-actions"><button class="btn sm ghost" data-act="story-share" data-n="${c.n}">Share chapter</button></div>`}
        </div></details>`).join('')}</div>
      <p class="small muted" style="margin-top:12px">Only what’s in your log makes it into the story: firsts, rivals, comebacks, medals and milestones. Partner names appear as you wrote them.</p>`
  },
  actions: {
    'story-share': el => { const c = chronicle()[+el.dataset.n - 1]; if (c) share(`${fighterName()}: The Story So Far\n\n${chapterText(c)}`); return false },
    'game-title': el => { saveGame({ title: game().title === el.dataset.id ? '' : el.dataset.id }) },
  },
}

export const shop = {
  view: () => `<h1 class="sr">Shop</h1><div class="stat-grid">${shopPanel()}</div>`,
}
