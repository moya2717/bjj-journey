// Your character: the avatar, its level and stats, the story, the shop, and the quest board on Home.
// The numbers all come from js/game.js; this file only draws them and saves your choices.
import { S } from '../store.js'
import { BELT_LOOK } from '../vocab.js'
import { esc, plural, today, toast } from '../util.js'
import { field, openSheet } from '../sheet.js'
import { currentRank } from '../model.js'
import { BOSS_REWARD, KEEP_QUESTS, SHOP, SLOT_NAMES, STAT_HINTS, archetype, balance, cantBuy, equipped, freezeOffer, freezesLeft, game, hurtOn, levelOf,
  questsOn, run, saveGame, stats, story, totalXp, xpBreakdown } from '../game.js'

// ---------- The avatar, drawn from parts ----------

const SKINS = ['#F2D3B8', '#E0B48C', '#C68E5E', '#8D5A36', '#5C3A22']
const SKIN_NAMES = ['Light', 'Fair', 'Tan', 'Brown', 'Deep']
const HAIRS = ['Short', 'Buzz', 'Bun', 'Long']
const HAIR = '#2A1D15', INK = '#1B1B1B'
let uid = 0

const MATS = {
  '': () => `<rect width="120" height="140" rx="18" fill="var(--surface-2)"/><rect y="112" width="120" height="28" fill="var(--mat-soft)"/>`,
  'mat-tatami': () => `<rect width="120" height="140" rx="18" fill="#EAE3C9"/><rect y="110" width="120" height="30" fill="#7FA36A"/><path d="M0 125h120M40 110v30M80 110v30" stroke="#5E8550" stroke-width="1.5"/>`,
  'mat-night': () => `<rect width="120" height="140" rx="18" fill="#0B1530"/>${[[18, 20], [96, 14], [84, 40], [28, 52], [106, 70], [12, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#F4F3EE"/>`).join('')}<circle cx="98" cy="26" r="7" fill="#F4F3EE" opacity=".85"/><rect y="112" width="120" height="28" fill="#1E3A5F"/>`,
  'mat-neon': () => `<rect width="120" height="140" rx="18" fill="#07070F"/><rect y="112" width="120" height="28" fill="#0E0E1C"/><path d="M0 112h120M10 140l20-28M60 140v-28M110 140l-20-28" stroke="#22D3EE" stroke-width="1.2"/><path d="M0 126h120" stroke="#E879F9" stroke-width="1.2"/>`,
}
const PATCHES = {
  'patch-star': '<path d="M71 61l2 4.3 4.7.6-3.4 3.2.9 4.6-4.2-2.3-4.2 2.3.9-4.6-3.4-3.2 4.7-.6z" fill="#F5B301"/>',
  'patch-bolt': '<path d="M73 59l-6 9h4l-2 8 7-10h-4l3-7z" fill="#22D3EE" stroke="#0B0B0B" stroke-width=".6"/>',
  'patch-wave': '<circle cx="71" cy="67" r="6" fill="#1F4FA0"/><path d="M65.5 68q2.7-3 5.5 0t5.5 0" stroke="#fff" stroke-width="1.4" fill="none"/>',
}

export function avatar({ items = equipped(), skin = game().skin, hair = game().hair, cls = '', label } = {}) {
  const id = 'av' + ++uid, kit = SHOP[items.kit], rank = currentRank(), look = BELT_LOOK[rank.belt] || BELT_LOOK.White
  const skinC = SKINS[skin] || SKINS[0], kitC = kit.color, dark = items.kit === 'gi-black'
  const aura = SHOP[items.aura]
  const legs = kit.nogi
    ? `<rect x="46" y="106" width="11" height="24" rx="5" fill="${skinC}"/><rect x="63" y="106" width="11" height="24" rx="5" fill="${skinC}"/><rect x="41" y="96" width="38" height="17" rx="6" fill="#1F2329"/>`
    : `<rect x="44" y="97" width="15" height="34" rx="6" fill="${kitC}"/><rect x="61" y="97" width="15" height="34" rx="6" fill="${kitC}"/>`
  const arm = (x, r) => `<rect x="${x}" y="58" width="12" height="36" rx="6" fill="${kitC}" transform="rotate(${r} ${x + 6} 60)"/>`
  const top = kit.nogi
    ? `<path d="M38 58q22-7 44 0l-2 42H40z" fill="${kitC}"/><path d="M38 58q22-7 44 0" stroke="${kit.trim || look.belt}" stroke-width="3" fill="none"/>
       <rect x="39" y="72" width="42" height="${items.kit === 'rash-plain' ? 7 : 3}" fill="${items.kit === 'rash-plain' ? look.belt : kit.trim}"/>`
    : `<path d="M38 58q22-7 44 0l-2 42H40z" fill="${kitC}"/><path d="M49 55l11 27 11-27" stroke="${dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)'}" stroke-width="5" fill="none"/>
       <rect x="38" y="91" width="44" height="8" rx="2" fill="${look.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><rect x="66" y="91" width="12" height="8" fill="${look.bar}"/>
       ${Array.from({ length: Math.min(4, rank.stripes) }, (_, i) => `<rect x="${68 + i * 2.5}" y="91" width="1.4" height="8" fill="#F4F3EE"/>`).join('')}
       <rect x="56" y="90" width="8" height="10" rx="1.5" fill="${look.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><path d="M57 100l-3 9M63 100l3 9" stroke="${look.belt}" stroke-width="3.2" stroke-linecap="round"/>`
  const hairBack = hair === 3 ? `<rect x="42" y="28" width="36" height="30" rx="11" fill="${HAIR}"/>` : ''
  const hairTop = `<path d="M43 35q1-18 17-18t17 18q-5-9-17-9t-17 9z" fill="${HAIR}" ${hair === 1 ? 'opacity=".5"' : ''}/>${hair === 2 ? `<circle cx="60" cy="16" r="6" fill="${HAIR}"/>` : ''}`
  const band = SHOP[items.band] ? `<rect x="43" y="26" width="34" height="5" rx="2" fill="${SHOP[items.band].color}"/><path d="M76 28l10 3M76 30l8 6" stroke="${SHOP[items.band].color}" stroke-width="2.4" stroke-linecap="round"/>` : ''
  return `<svg class="avatar ${cls}" viewBox="0 0 120 140" role="img" aria-label="${esc(label || 'Your character')}">
    ${(MATS[items.mat] || MATS[''])()}
    ${aura ? `<defs><radialGradient id="${id}"><stop offset="35%" stop-color="${aura.color}" stop-opacity=".55"/><stop offset="100%" stop-color="${aura.color}" stop-opacity="0"/></radialGradient></defs><circle class="aura" cx="60" cy="72" r="56" fill="url(#${id})"/>` : ''}
    <ellipse cx="60" cy="132" rx="30" ry="4" fill="rgba(0,0,0,.2)"/>
    ${hairBack}${legs}
    <ellipse cx="51" cy="131" rx="7" ry="3.5" fill="${skinC}"/><ellipse cx="69" cy="131" rx="7" ry="3.5" fill="${skinC}"/>
    ${arm(26, 12)}${arm(82, -12)}<circle cx="29" cy="96" r="5.5" fill="${skinC}"/><circle cx="91" cy="96" r="5.5" fill="${skinC}"/>
    <rect x="54" y="48" width="12" height="11" fill="${skinC}"/>
    ${top}${PATCHES[items.patch] || ''}
    <circle cx="43" cy="38" r="3.5" fill="${skinC}"/><circle cx="77" cy="38" r="3.5" fill="${skinC}"/><circle cx="60" cy="36" r="17" fill="${skinC}"/>
    ${hairTop}
    <circle cx="54" cy="38" r="1.9" fill="${INK}"/><circle cx="66" cy="38" r="1.9" fill="${INK}"/><path d="M55 44q5 4 10 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${band}
  </svg>`
}

const nameOf = () => game().name || S.profile.name?.split(/\s+/)[0] || 'Your fighter'
const labelOf = (lv, arch) => `${nameOf()}, level ${lv.level} ${arch.name.toLowerCase()}`
const xpBar = pct => `<div class="xpbar" aria-hidden="true"><span style="width:${Math.round(pct * 100)}%"></span></div>`
const coin = n => `<span class="tokens"><i aria-hidden="true"></i>${n.toLocaleString()} ${n === 1 ? 'token' : 'tokens'}</span>`

// ---------- On the Athlete Profile ----------

export function characterPanel() {
  const lv = levelOf(), arch = archetype(), st = stats(), top = Math.max(25, ...st.map(s => s.value))
  return `<section class="panel wide char-card" id="character">
    <div class="char-top">
      <div class="char-avatar">${avatar({ label: labelOf(lv, arch) })}</div>
      <div class="char-info">
        <p class="w-lbl">Level ${lv.level}</p>
        <h2>${esc(nameOf())}</h2>
        <p><span class="tag pos">${esc(arch.name)}</span></p>
        ${xpBar(lv.pct)}
        <p class="small muted">${lv.into.toLocaleString()} / ${lv.need.toLocaleString()} XP to level ${lv.level + 1} · ${lv.xp.toLocaleString()} XP in all</p>
        <p class="small">${esc(arch.why)}</p>
        <div class="row-actions"><button class="btn sm ghost" data-act="game-edit">Edit character</button>${coin(balance())}</div>
      </div>
    </div>
    <div class="char-stats">${st.map(s => `<div class="char-stat" title="${esc(STAT_HINTS[s.name])}"><span>${s.name}</span><div class="meter mat"><span style="width:${s.value / top * 100}%"></span></div><b>${s.value}</b></div>`).join('')}</div>
    <details class="explain"><summary>How you earn XP and stats</summary>
      <table class="xp-table"><thead><tr><th>From</th><th>Each</th><th>You</th><th>XP</th></tr></thead><tbody>
        ${xpBreakdown().map(r => `<tr class="${r.xp ? '' : 'muted'}"><td>${esc(r.what)}</td><td>${r.each ?? '—'}</td><td>${r.n ?? '—'}</td><td>${r.xp.toLocaleString()}</td></tr>`).join('')}
      </tbody></table>
      <ul class="small muted fix-list">${Object.entries(STAT_HINTS).map(([k, v]) => `<li><b>${k}</b>: ${esc(v)}.</li>`).join('')}</ul>
      <p class="small muted">Everything is counted from your journal, so editing or deleting an entry changes it too. Every level also earns 10 tokens.</p>
    </details>
  </section>`
}

export function storyPanel() {
  const chapters = story(), cur = chapters.find(c => c.state !== 'done'), done = chapters.filter(c => c.state === 'done')
  const n = cur ? chapters.indexOf(cur) + 1 : chapters.length
  return `<section class="panel story" id="story"><h2>The Open Mat Chronicles</h2>
    ${!cur ? '<p>You’ve finished every chapter. The story goes on in your journal.</p>'
      : cur.state === 'locked' ? `<p class="w-lbl">Chapter ${n}</p><h3>${esc(cur.title)}</h3><p class="small muted">Unlocks at level ${cur.level}. You’re level ${levelOf().level}.</p>`
      : `<p class="w-lbl">Chapter ${n}</p><h3>${esc(cur.title)}</h3><p class="story-text">${esc(cur.text)}</p>
        <p class="small"><b>Mission:</b> ${esc(cur.what)} · +${cur.tokens} tokens</p>
        ${cur.state === 'ready' ? '<div class="row-actions"><button class="btn sm" data-act="game-chapter" data-id="' + cur.id + '">Start chapter</button></div>'
          : `<div class="meter good"><span style="width:${cur.have / cur.need * 100}%"></span></div><p class="small muted">${cur.have} of ${cur.need}, counting from ${esc(cur.from)}</p>`}`}
    ${done.length ? `<p class="small muted" style="margin-top:10px">Done: ${done.map(c => esc(c.title)).join(' · ')}</p>` : ''}
  </section>`
}

export function shopPanel() {
  const eq = equipped(), lv = levelOf().level
  const tile = id => {
    const it = SHOP[id], have = game().owned[id] || 0, no = cantBuy(id), on = !it.ability && Object.values(eq).includes(id)
    const preview = it.ability ? `<span class="ability-icon" aria-hidden="true">${{ reshuffle: '↻', scout: '◎', freeze: '❄' }[id]}</span>` : avatar({ items: { ...eq, [it.slot]: id }, cls: 'mini', label: it.name })
    const btn = !it.ability && (have || !it.price)
      ? `<button class="btn sm ${on ? '' : 'ghost'}" data-act="game-equip" data-id="${id}" aria-pressed="${on}">${on ? 'Wearing' : 'Wear'}</button>`
      : no ? `<button class="btn sm ghost" disabled>${esc(no)}</button>` : `<button class="btn sm" data-act="game-buy" data-id="${id}">Buy · ${it.price}</button>`
    return `<li class="shop-item ${on ? 'on' : ''} ${it.level > lv ? 'locked' : ''}">${preview}<span class="shop-name">${esc(it.name)}${id === 'freeze' && have ? ` <span class="small muted">(${freezesLeft()} held)</span>` : ''}</span>
      ${it.desc ? `<span class="small muted">${esc(it.desc)}</span>` : `<span class="small muted">${SLOT_NAMES[it.slot]}${it.price ? '' : ' · free'}</span>`}${btn}</li>`
  }
  const abilities = Object.keys(SHOP).filter(id => SHOP[id].ability), cosmetics = Object.keys(SHOP).filter(id => !SHOP[id].ability)
  return `<section class="panel shop" id="shop"><div class="history-head"><h2 style="margin:0">Shop</h2>${coin(balance())}</div>
    <p class="small muted">Earn tokens from quests, bosses, story chapters and levels. Perks are just for the game: they never change your journal.</p>
    <h3>Abilities</h3><ul class="shop-grid">${abilities.map(tile).join('')}</ul>
    <h3>Look</h3><ul class="shop-grid">${cosmetics.map(tile).join('')}</ul>
  </section>`
}

// ---------- Home ----------

export function questBoard() {
  const t = today(), quests = questsOn(t), r = run(), week = r.weeks.at(-1), boss = week?.boss, offer = freezeOffer()
  const mult = 1 + 0.1 * Math.min(r.streak, 5)
  return `<section class="quests" aria-labelledby="qb-h">
    <div class="history-head"><h2 id="qb-h">Today’s quests</h2><span class="small muted">${r.streak ? `${plural(r.streak, 'week')} streak · tokens ×${mult.toFixed(1)}` : `Finish ${KEEP_QUESTS} this week to start a streak`}</span></div>
    ${hurtOn(t) ? '<p class="small muted">Injury-friendly quests while you heal. Rest is training too.</p>' : ''}
    <ul class="quest-list">${quests.map(q => `<li class="quest ${q.done ? 'done' : ''}">
      <span class="q-check" aria-hidden="true"></span>
      <span class="q-text"><b>${esc(q.text)}</b><span class="small muted">+${q.tokens} tokens · +${q.xp} XP${q.done ? ' · done' : q.self ? ' · tick it when you’ve done it' : ''}</span></span>
      ${q.self ? `<button class="btn sm ${q.done ? 'ghost' : ''}" data-act="game-self" data-id="${q.id}" aria-pressed="${q.done}">${q.done ? 'Undo' : 'Done'}</button>` : ''}</li>`).join('')}</ul>
    ${boss ? `<div class="boss ${boss.done ? 'beaten' : ''}"><p class="w-lbl">Weekly boss${boss.done ? ' · beaten' : ''}</p>
      <p><b>${esc(boss.name)}</b> <span class="small muted">+${BOSS_REWARD.tokens} tokens · +${BOSS_REWARD.xp} XP</span></p>
      ${boss.parts.map(([label, have, need]) => `<div class="boss-part"><span class="small">${esc(label)}</span><span class="small muted">${Math.min(have, need)} / ${need}</span><div class="meter ${have >= need ? 'good' : 'mat'}"><span style="width:${Math.min(1, have / need) * 100}%"></span></div></div>`).join('')}</div>` : ''}
    ${offer ? `<div class="callout"><p>Last week slipped by. A streak freeze keeps your streak going.</p><div class="row-actions"><button class="btn sm" data-act="game-freeze" data-week="${offer}">Use a streak freeze</button></div></div>` : ''}
    <div class="quest-foot"><button class="card-link" data-act="goto" data-view="athlete" data-anchor="character">Character and shop</button>${coin(balance())}</div>
    <p class="small muted">Quests tick themselves off from what you log. Rest days never cost you anything.</p>
  </section>`
}

export function characterWidget() {
  const lv = levelOf(), arch = archetype()
  return `<button class="widget char-widget" data-act="goto" data-view="athlete" data-anchor="character">
    ${avatar({ cls: 'sm', label: labelOf(lv, arch) })}
    <span class="cw-body"><span class="w-lbl">Level ${lv.level} · ${esc(arch.name)}</span><span class="cw-name">${esc(nameOf())}</span>${xpBar(lv.pct)}<span class="w-sub">${lv.into.toLocaleString()} / ${lv.need.toLocaleString()} XP · ${balance().toLocaleString()} tokens</span></span>
  </button>`
}

// ---------- Feedback after a save ----------

const CHEERS = ['Every round adds up.', 'Showing up is the technique.', 'Slow is smooth, smooth is fast.', 'The mat remembers.', 'Small wins, stacked.']

export function celebrate(level) {
  const dlg = document.createElement('dialog')
  dlg.className = 'levelup'
  dlg.setAttribute('aria-labelledby', 'lu-h')
  dlg.innerHTML = `<form method="dialog" class="levelup-card">
    <div class="burst" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
    ${avatar({ label: nameOf() })}
    <p class="w-lbl">Level up</p><h2 id="lu-h">Level ${level}</h2>
    <p>${esc(CHEERS[level % CHEERS.length])} +10 tokens.</p>
    <button class="btn">Keep training</button></form>`
  dlg.addEventListener('close', () => dlg.remove())
  document.body.append(dlg)
  dlg.showModal()
}

// What a save earned: XP, quests finished today and any new level.
export const snapshot = () => ({ xp: totalXp(), level: levelOf().level, done: questsOn(today()).filter(q => q.done).map(q => q.id), story: story().filter(c => c.state === 'done').map(c => c.id) })
export function announceGains(before, after) {
  const gained = after.xp - before.xp, quests = questsOn(today()).filter(q => q.done && !before.done.includes(q.id))
  const chapters = story().filter(c => after.story.includes(c.id) && !before.story.includes(c.id))
  const parts = [gained > 0 && `+${gained.toLocaleString()} XP`, ...quests.map(q => `Quest done: ${q.text}`), ...chapters.map(c => `Chapter done: ${c.title}, +${c.tokens} tokens`)].filter(Boolean)
  if (after.level > before.level) setTimeout(() => celebrate(after.level), 700)
  return parts.length ? parts.join(' · ') : ''
}

// ---------- Actions ----------

function editCharacter() {
  const G = game()
  openSheet('Edit character', `
    ${field('Name', `<input type="text" name="name" value="${esc(G.name)}" placeholder="${esc(S.profile.name?.split(/\s+/)[0] || 'Your fighter')}" maxlength="24">`)}
    <fieldset><legend>Skin</legend><div class="chips">${SKIN_NAMES.map((n, i) => `<label class="chip"><input type="radio" name="skin" value="${i}" ${i === G.skin ? 'checked' : ''}><span><i class="swatch" style="background:${SKINS[i]}"></i>${n}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Hair</legend><div class="chips">${HAIRS.map((n, i) => `<label class="chip"><input type="radio" name="hair" value="${i}" ${i === G.hair ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
    <p class="hint">Your belt comes from your rank. Gi or no-gi kit, patches and more are in the shop.</p>`, {
    submitLabel: 'Save character',
    onSubmit: fd => { saveGame({ name: fd.get('name').trim(), skin: +fd.get('skin') || 0, hair: +fd.get('hair') || 0 }); toast('Character saved') },
  })
}

export const actions = {
  'game-edit': () => editCharacter(),
  'game-buy': el => {
    const id = el.dataset.id, it = SHOP[id], G = game()
    if (!it || cantBuy(id)) return
    saveGame({ owned: { ...G.owned, [id]: (G.owned[id] || 0) + 1 }, spent: G.spent + it.price, equipped: it.slot ? { ...G.equipped, [it.slot]: id } : G.equipped })
    toast(it.ability ? `${it.name} unlocked` : `${it.name} bought and equipped`)
  },
  // Kit is always worn; other slots come off with a second tap.
  'game-equip': el => {
    const it = SHOP[el.dataset.id], G = game(), on = equipped()[it.slot] === el.dataset.id
    saveGame({ equipped: { ...G.equipped, [it.slot]: on && it.slot !== 'kit' ? '' : el.dataset.id } })
  },
  'game-self': el => {
    const G = game(), t = today(), list = G.self[t] || [], id = el.dataset.id
    saveGame({ self: { ...G.self, [t]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] } })
  },
  'game-chapter': el => { saveGame({ story: { ...game().story, [el.dataset.id]: today() } }); toast('Chapter started. Your mission counts from today.') },
  'game-freeze': el => { saveGame({ frozen: [...game().frozen, el.dataset.week] }); toast('Streak saved. Back at it this week.') },
}
