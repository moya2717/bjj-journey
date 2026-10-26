// Your character: the avatar, its level and stats, the story, the shop, and the quest board on Home.
// The numbers all come from js/game.js; this file only draws them and saves your choices.
import { S } from '../store.js'
import { UI } from '../ui.js'
import { BELT_LOOK } from '../vocab.js'
import { esc, plural, today, toast } from '../util.js'
import { field, openSheet } from '../sheet.js'
import { currentRank } from '../model.js'
import { ACTIVE_REST_DAYS, BOSS_REWARD, KEEP_QUESTS, SHOP, SLOT_NAMES, STAT_HINTS, archetype, balance, cantBuy, equipped, freezeOffer, freezesLeft, game, hurtOn, legsHurt, levelOf, owns,
  questsOn, run, saveGame, stats, story, tierOf, totalXp, xpBreakdown } from '../game.js'

// ---------- The avatar, drawn from parts ----------

const SKINS = ['#F2D3B8', '#E0B48C', '#C68E5E', '#8D5A36', '#5C3A22']
const SKIN_NAMES = ['Light', 'Fair', 'Tan', 'Brown', 'Deep']
const HAIRS = ['Short', 'Buzz', 'Bun', 'Long']
const HAIR = '#2A1D15', INK = '#1B1B1B'
let uid = 0

// Everything sits on a 120 × 140 canvas: head centered at (60, 36), hands at (29, 96) and (91, 96),
// feet at y 131. Pets sit bottom left; emotes are a speech bubble top left.
const MATS = {
  '': () => `<rect width="120" height="140" rx="18" fill="var(--surface-2)"/><rect y="112" width="120" height="28" fill="var(--mat-soft)"/>`,
  'mat-tatami': () => `<rect width="120" height="140" rx="18" fill="#EAE3C9"/><rect y="110" width="120" height="30" fill="#7FA36A"/><path d="M0 125h120M40 110v30M80 110v30" stroke="#5E8550" stroke-width="1.5"/>`,
  'mat-night': () => `<rect width="120" height="140" rx="18" fill="#0B1530"/>${[[18, 20], [96, 14], [84, 40], [28, 52], [106, 70], [12, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#F4F3EE"/>`).join('')}<circle cx="98" cy="26" r="7" fill="#F4F3EE" opacity=".85"/><rect y="112" width="120" height="28" fill="#1E3A5F"/>`,
  'mat-neon': () => `<rect width="120" height="140" rx="18" fill="#07070F"/><rect y="112" width="120" height="28" fill="#0E0E1C"/><path d="M0 112h120M10 140l20-28M60 140v-28M110 140l-20-28" stroke="#22D3EE" stroke-width="1.2"/><path d="M0 126h120" stroke="#E879F9" stroke-width="1.2"/>`,
  'mat-dusk': id => `<defs><linearGradient id="${id}s" x2="0" y2="1"><stop offset="0" stop-color="#F59E0B"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect width="120" height="140" rx="18" fill="url(#${id}s)"/>
    <rect x="12" y="20" width="22" height="30" rx="2" fill="#FDE68A" opacity=".45"/><rect x="86" y="20" width="22" height="30" rx="2" fill="#FDE68A" opacity=".45"/><rect y="112" width="120" height="28" fill="#5B3A1E"/><path d="M0 121h120M0 131h120" stroke="#3F2814"/>`,
  'mat-paper': () => `<rect width="120" height="140" rx="18" fill="#F7F5EE"/><path d="M0 100L120 64" stroke="#C9333A" stroke-width="1.3" stroke-dasharray="4 3"/><path d="M98 0h4q18 0 18 18v4z" fill="#DDD8C6"/><rect y="112" width="120" height="28" fill="#E7E2D2"/><path d="M0 112h120" stroke="#C8C2AE"/>`,
  'mat-arcade': () => `<rect width="120" height="140" rx="18" fill="#0B0820"/>${[[14, 18, '#22D3EE'], [26, 30, '#E879F9'], [96, 16, '#FACC15'], [104, 36, '#22D3EE'], [10, 64, '#4ADE80'], [108, 80, '#E879F9']].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="5" height="5" fill="${c}"/>`).join('')}
    <rect y="112" width="120" height="28" fill="#140F33"/><path d="M0 112h120M0 124h120M20 112l-10 28M60 112v28M100 112l10 28M40 112l-4 28M80 112l4 28" stroke="#E879F9" stroke-width=".9"/>`,
  'mat-mountain': () => `<rect width="120" height="140" rx="18" fill="#BFE3F5"/><path d="M0 104L30 58l25 32 25-42 40 50v14H0z" fill="#6B7F99"/><path d="M80 48l-8 12h16zM30 58l-6 9h12z" fill="#fff"/><rect y="112" width="120" height="28" fill="#7FA36A"/>`,
}
const PATCHES = {
  'patch-star': '<path d="M71 61l2 4.3 4.7.6-3.4 3.2.9 4.6-4.2-2.3-4.2 2.3.9-4.6-3.4-3.2 4.7-.6z" fill="#F5B301"/>',
  'patch-bolt': '<path d="M73 59l-6 9h4l-2 8 7-10h-4l3-7z" fill="#22D3EE" stroke="#0B0B0B" stroke-width=".6"/>',
  'patch-wave': '<circle cx="71" cy="67" r="6" fill="#1F4FA0"/><path d="M65.5 68q2.7-3 5.5 0t5.5 0" stroke="#fff" stroke-width="1.4" fill="none"/>',
  'patch-kunai': '<path d="M71 59l2.6 6-2.6 4-2.6-4z" fill="#C0C6CD" stroke="#374151" stroke-width=".5"/><rect x="70.2" y="69" width="1.6" height="4" fill="#374151"/><circle cx="71" cy="74.6" r="1.6" fill="none" stroke="#374151" stroke-width=".8"/>',
  'patch-omoplata': '<path d="M73 56q12-4 15 8l-12 3z" fill="#C0C6CD" stroke="#4B5563" stroke-width=".8"/><circle cx="80" cy="60" r=".9" fill="#4B5563"/>',
}
const FACES = {
  'mask-shadow': '<path d="M44 39q16 5 32 0l-1 7q-15 11-30 0z" fill="#1E2026"/>',
  'goggles-gogo': '<path d="M43 37h34" stroke="#111" stroke-width="2"/><circle cx="54" cy="38" r="5" fill="#22D3EE" fill-opacity=".45" stroke="#111" stroke-width="1.8"/><circle cx="66" cy="38" r="5" fill="#22D3EE" fill-opacity=".45" stroke="#111" stroke-width="1.8"/>',
  'specs-xray': '<rect x="48.5" y="34" width="10" height="8" rx="2" fill="#fff" stroke="#111" stroke-width="1.4"/><rect x="61.5" y="34" width="10" height="8" rx="2" fill="#fff" stroke="#111" stroke-width="1.4"/><path d="M58.5 38h3M51 36l5 4M56 36l-5 4M64 36l5 4M69 36l-5 4" stroke="#C9333A" stroke-width="1.1"/>',
}
const HELD = {
  'held-duck': '<ellipse cx="99" cy="104" rx="7.5" ry="5.5" fill="#FACC15"/><circle cx="103" cy="97" r="4.2" fill="#FACC15"/><path d="M106.5 97l4 1-4 1.6z" fill="#F97316"/><circle cx="104" cy="96" r=".9" fill="#111"/>',
  'held-lasso': '<path d="M91 99q3 7 9 9" stroke="#C89B5A" stroke-width="2" fill="none"/><ellipse cx="104" cy="112" rx="10" ry="5" fill="none" stroke="#C89B5A" stroke-width="2.2"/><ellipse cx="104" cy="112" rx="6.5" ry="3" fill="none" stroke="#A47B4F" stroke-width="1.4"/>',
}
const PETS = {
  'pet-turtle': '<path d="M5 133q0-15 14-15t14 15z" fill="#3F8F4E" stroke="#2C6B39"/><path d="M12 124l7-3 7 3M10 133l9-5 9 5" stroke="#2C6B39" fill="none"/><circle cx="35" cy="128" r="4" fill="#7BC27F"/><circle cx="36.3" cy="127" r=".9" fill="#111"/><ellipse cx="9" cy="134" rx="3" ry="1.6" fill="#7BC27F"/><ellipse cx="29" cy="134" rx="3" ry="1.6" fill="#7BC27F"/>',
  'pet-sloth': '<ellipse cx="18" cy="124" rx="11" ry="11" fill="#8B6B4A"/><ellipse cx="18" cy="121" rx="7" ry="5.5" fill="#E8D5B5"/><ellipse cx="15" cy="120" rx="2.3" ry="1.5" fill="#4A3826" transform="rotate(-20 15 120)"/><ellipse cx="21" cy="120" rx="2.3" ry="1.5" fill="#4A3826" transform="rotate(20 21 120)"/><circle cx="15" cy="120" r=".7" fill="#fff"/><circle cx="21" cy="120" r=".7" fill="#fff"/><path d="M16 124q2 1.5 4 0" stroke="#4A3826" fill="none"/><path d="M9 131l-2 3M12 133l-1 3M24 133l1 3M27 131l2 3" stroke="#4A3826" stroke-width="1.2"/>',
  'pet-shark': '<path d="M5 128q15-11 30 0q-15 7-30 0z" fill="#7C8EA3"/><path d="M5 128q15 5 30 0q-15 7-30 0z" fill="#E5E7EB"/><path d="M16 121l5-9 4 9z" fill="#7C8EA3"/><path d="M6 128l-4-5v10z" fill="#7C8EA3"/><circle cx="29" cy="126" r="1" fill="#111"/><path d="M28 130l2-1 2 1" stroke="#111" stroke-width=".7" fill="none"/>',
  'pet-worm': '<path d="M6 132q4-9 8 0t8 0t6-2" stroke="#F9A8D4" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="31" cy="127" r="4.5" fill="#F9A8D4"/><circle cx="30" cy="126" r=".8" fill="#111"/><circle cx="33" cy="126" r=".8" fill="#111"/><path d="M28 130l3 2.5 3-2.5" stroke="#fff" stroke-width="1.4" fill="none"/>',
}

// Auras with a color glow; smoke and the web are drawn.
function auraOf(it, id) {
  if (!it) return ''
  if (it.name === 'Smoke-bomb aura') return [[24, 120, 11], [40, 128, 9], [82, 128, 9], [98, 120, 11], [16, 102, 7], [106, 102, 7], [60, 134, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#9CA3AF" opacity=".55"/>`).join('')
  if (it.name === 'Spider Guard web') {
    const pt = (r, k) => `${(60 + r * Math.cos(k * Math.PI / 4)).toFixed(1)},${(70 + r * Math.sin(k * Math.PI / 4)).toFixed(1)}`
    return `<g stroke="#94A3B8" stroke-opacity=".7" stroke-width=".9" fill="none">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M60 70L${pt(58, k)}"/>`).join('')}${[18, 34, 50].map(r => `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7].map(k => pt(r, k)).join(' ')}"/>`).join('')}</g>`
  }
  const glow = `<defs><radialGradient id="${id}"><stop offset="35%" stop-color="${it.color}" stop-opacity=".55"/><stop offset="100%" stop-color="${it.color}" stop-opacity="0"/></radialGradient></defs><circle class="aura" cx="60" cy="72" r="56" fill="url(#${id})"/>`
  return glow + (it.name === 'Second Wind' ? '<path d="M8 58q10-6 20 0t20 0M72 46q10-6 20 0t20 0M14 86q8-5 16 0" stroke="#4ADE80" stroke-width="1.6" fill="none" stroke-linecap="round"/>' : '')
}

// Headwear: a plain band unless the item says otherwise.
function headOf(it) {
  if (!it) return ''
  const c = it.color
  if (it.crown) return '<path d="M45 22l3-12 6 7 6-10 6 10 6-7 3 12z" fill="#F5B301" stroke="#B45309" stroke-width=".8"/><circle cx="60" cy="18" r="1.6" fill="#C9333A"/>'
  if (it.hood) return `<path d="M43 34q1-18 17-18t17 18q-5-6-17-6t-17 6z" fill="${c}"/>`
  if (it.bandana) return `<path d="M42 34q1-19 18-19t18 19q-8-5-18-5t-18 5z" fill="${c}"/>${[[51, 23], [60, 19], [69, 23], [56, 27], [65, 27]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#FDE68A"/>`).join('')}<path d="M76 30l9 4M76 31l6 7" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`
  return `<rect x="43" y="26" width="34" height="5" rx="2" fill="${c}"/><path d="M76 28l10 3M76 30l8 6" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>${it.plate ? '<rect x="55" y="25.3" width="10" height="6.4" rx="1" fill="#C0C6CD" stroke="#6B7280" stroke-width=".6"/>' : ''}`
}

const bubble = say => { const w = say.length * 5.4 + 12; return `<rect x="3" y="5" width="${w}" height="16" rx="8" fill="#fff" stroke="#111"/><path d="M14 20.5l2 6 5-6" fill="#fff" stroke="#111" stroke-linejoin="round"/><path d="M14.5 20.5h6" stroke="#fff" stroke-width="1.4"/><text x="${3 + w / 2}" y="16.5" text-anchor="middle" font-size="8.5" font-weight="800" font-family="Archivo, sans-serif" fill="#111">${esc(say)}</text>` }

export function avatar({ items = equipped(), skin = game().skin, hair = game().hair, cls = '', label } = {}) {
  const id = 'av' + ++uid, kit = SHOP[items.kit], rank = currentRank(), look = BELT_LOOK[rank.belt] || BELT_LOOK.White
  const skinC = SKINS[skin] || SKINS[0], kitC = kit.color, sleeve = kit.sleeve || kitC, dark = ['gi-black', 'gi-shinobi', 'gi-kimura'].includes(items.kit)
  const head = SHOP[items.band], hooded = kit.hood || head?.hood, hoodC = head?.hood ? head.color : kitC
  const legs = kit.nogi
    ? `<rect x="46" y="106" width="11" height="24" rx="5" fill="${skinC}"/><rect x="63" y="106" width="11" height="24" rx="5" fill="${skinC}"/><rect x="41" y="96" width="38" height="17" rx="6" fill="#1F2329"/>`
    : `<rect x="44" y="97" width="15" height="34" rx="6" fill="${kitC}"/><rect x="61" y="97" width="15" height="34" rx="6" fill="${kitC}"/>`
  const feet = items.feet ? '<ellipse cx="51" cy="131" rx="7" ry="3.5" fill="#1B1B1B"/><ellipse cx="69" cy="131" rx="7" ry="3.5" fill="#1B1B1B"/><path d="M49 128.5v5M67 128.5v5" stroke="#6B7280" stroke-width=".8"/>'
    : `<ellipse cx="51" cy="131" rx="7" ry="3.5" fill="${skinC}"/><ellipse cx="69" cy="131" rx="7" ry="3.5" fill="${skinC}"/>`
  const arm = (x, r) => `<rect x="${x}" y="58" width="12" height="36" rx="6" fill="${sleeve}" transform="rotate(${r} ${x + 6} 60)"/>${kit.plated ? `<path d="M${x} 72h12M${x} 82h12" stroke="${kit.trim}" stroke-width="1.2" transform="rotate(${r} ${x + 6} 60)"/>` : ''}`
  const jacket = kit.long ? 'M38 58q22-7 44 0l3 58H35z' : 'M38 58q22-7 44 0l-2 42H40z'
  const belt = `<rect x="38" y="91" width="44" height="8" rx="2" fill="${look.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><rect x="66" y="91" width="12" height="8" fill="${look.bar}"/>
       ${Array.from({ length: Math.min(4, rank.stripes) }, (_, i) => `<rect x="${68 + i * 2.5}" y="91" width="1.4" height="8" fill="#F4F3EE"/>`).join('')}
       <rect x="56" y="90" width="8" height="10" rx="1.5" fill="${look.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><path d="M57 100l-3 9M63 100l3 9" stroke="${look.belt}" stroke-width="3.2" stroke-linecap="round"/>`
  const top = kit.nogi
    ? `<path d="${jacket}" fill="${kitC}"/><path d="M38 58q22-7 44 0" stroke="${kit.trim || look.belt}" stroke-width="3" fill="none"/>
       <rect x="39" y="72" width="42" height="${items.kit === 'rash-plain' ? 7 : 3}" fill="${items.kit === 'rash-plain' ? look.belt : kit.trim}"/>
       ${kit.hood ? `<path d="M56 58v10M64 58v10" stroke="${kit.trim}" stroke-width="1.2"/>` : ''}`
    : `<path d="${jacket}" fill="${kitC}"/><path d="M49 55l11 27 11-27" stroke="${kit.trim || (dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)')}" stroke-width="5" fill="none"/>
       ${kit.plated ? `<path d="M40 66q20 5 40 0M40 78q20 5 40 0" stroke="${kit.trim}" stroke-width="1.4" fill="none"/>` : ''}
       ${kit.long ? `<path d="M64 74l3 5h-6zM64 104l3 5h-6z" fill="${kit.trim}"/>` : ''}${belt}`
  const hairBack = hair === 3 && !hooded ? `<rect x="42" y="28" width="36" height="30" rx="11" fill="${HAIR}"/>` : ''
  const hairTop = `<path d="M43 35q1-18 17-18t17 18q-5-9-17-9t-17 9z" fill="${HAIR}" ${hair === 1 ? 'opacity=".5"' : ''}/>${hair === 2 && !hooded ? `<circle cx="60" cy="16" r="6" fill="${HAIR}"/>` : ''}`
  const hood = hooded ? `<path d="M39 48q-3-35 21-35t21 35z" fill="${hoodC}"/>` : ''
  return `<svg class="char-av ${cls}" viewBox="0 0 120 140" role="img" aria-label="${esc(label || 'Your character')}">
    ${(MATS[items.mat] || MATS[''])(id)}
    ${auraOf(SHOP[items.aura], id)}
    ${items.back ? '<path d="M38 58h44l14 66q-36 9-72 0z" fill="#C9333A" stroke="#E8B64C" stroke-width="2"/>' : ''}
    <ellipse cx="60" cy="132" rx="30" ry="4" fill="rgba(0,0,0,.2)"/>
    ${PETS[items.pet] || ''}
    ${hairBack}${hood}${legs}${feet}
    ${arm(26, 12)}${arm(82, -12)}<circle cx="29" cy="96" r="5.5" fill="${skinC}"/><circle cx="91" cy="96" r="5.5" fill="${skinC}"/>
    ${HELD[items.held] || ''}
    <rect x="54" y="48" width="12" height="11" fill="${skinC}"/>
    ${top}${PATCHES[items.patch] || ''}
    <circle cx="43" cy="38" r="3.5" fill="${skinC}"/><circle cx="77" cy="38" r="3.5" fill="${skinC}"/><circle cx="60" cy="36" r="17" fill="${skinC}"/>
    ${hairTop}${kit.hood && !head?.hood ? headOf({ hood: true, color: kitC }) : ''}
    <circle cx="54" cy="38" r="1.9" fill="${INK}"/><circle cx="66" cy="38" r="1.9" fill="${INK}"/><path d="M55 44q5 4 10 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${FACES[items.face] || ''}${headOf(head)}
    ${SHOP[items.emote] ? bubble(SHOP[items.emote].say) : ''}
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

// One shelf at a time: abilities, or one slot of cosmetics. Locked items say how to unlock them.
export function shopPanel() {
  const eq = equipped(), lv = levelOf().level, shelf = UI.shopSlot || 'kit'
  const tile = id => {
    const it = SHOP[id], have = game().owned[id] || 0, no = cantBuy(id), on = !it.ability && eq[it.slot] === id
    const preview = it.ability ? `<span class="ability-icon" aria-hidden="true">${{ reshuffle: '↻', scout: '◎', freeze: '❄' }[id]}</span>` : avatar({ items: { ...eq, [it.slot]: id }, cls: 'mini', label: it.name })
    const btn = !it.ability && owns(id)
      ? `<button class="btn sm ${on ? '' : 'ghost'}" data-act="game-equip" data-id="${id}" aria-pressed="${on}">${on ? 'Wearing' : 'Wear'}</button>`
      : no ? `<button class="btn sm ghost" disabled>${it.unlock ? '<span aria-hidden="true">🔒 </span>' : ''}${esc(no)}</button>` : `<button class="btn sm" data-act="game-buy" data-id="${id}">Buy · ${it.price}</button>`
    const tier = it.ability ? '' : `<span class="tier ${tierOf(it)}">${tierOf(it)}${it.unlock ? ' · unlock' : !it.price ? ' · free' : ''}</span>`
    return `<li class="shop-item ${on ? 'on' : ''} ${it.level > lv || (it.unlock && !owns(id)) ? 'locked' : ''}">${preview}${tier}<span class="shop-name">${esc(it.name)}${id === 'freeze' && have ? ` <span class="small muted">(${freezesLeft()} held)</span>` : ''}</span>
      <span class="small muted">${esc(it.desc)}</span>${btn}</li>`
  }
  const shelves = ['abilities', ...Object.keys(SLOT_NAMES)]
  const ids = Object.keys(SHOP).filter(id => shelf === 'abilities' ? SHOP[id].ability : SHOP[id].slot === shelf)
  return `<section class="panel shop" id="shop"><div class="history-head"><h2 style="margin:0">Shop</h2>${coin(balance())}</div>
    <p class="small muted">Earn tokens from quests, bosses, story chapters and levels. Some pieces can’t be bought: they unlock from the story, achievements, running and levels. Perks are just for the game: they never change your journal.</p>
    <div class="shop-shelves" role="group" aria-label="Shop shelf">${shelves.map(k => `<button class="pill" data-act="shop-slot" data-slot="${k}" aria-pressed="${k === shelf}">${k === 'abilities' ? 'Abilities' : SLOT_NAMES[k]}${eq[k] && k !== 'kit' ? ' •' : ''}</button>`).join('')}</div>
    <ul class="shop-grid">${ids.map(tile).join('')}</ul>
  </section>`
}

// ---------- Home ----------

export function questBoard() {
  const t = today(), quests = questsOn(t), r = run(), week = r.weeks.at(-1), boss = week?.boss, offer = freezeOffer()
  const mult = week?.mult || 1
  return `<section class="quests" aria-labelledby="qb-h">
    <div class="history-head"><h2 id="qb-h">Today’s quests</h2><span class="small muted">${r.streak ? `${plural(r.streak, 'week')} streak · ` : `Finish ${KEEP_QUESTS} this week to start a streak · `}tokens ×${mult.toFixed(2).replace(/0$/, '')}</span></div>
    ${hurtOn(t) ? '<p class="small muted">Injury-friendly quests while you heal. Rest is training too.</p>' : legsHurt(t) ? '<p class="small muted">Running is on pause while your legs heal. Upper-body and mobility quests stand in.</p>' : ''}
    <ul class="quest-list">${quests.map(q => `<li class="quest ${q.done ? 'done' : ''}">
      <span class="q-check" aria-hidden="true"></span>
      <span class="q-text"><b>${esc(q.text)}</b><span class="small muted">+${q.tokens} tokens · +${q.xp} XP${q.done ? ' · done' : q.self ? ' · tick it when you’ve done it' : ''}</span></span>
      ${q.self ? `<button class="btn sm ${q.done ? 'ghost' : ''}" data-act="game-self" data-id="${q.id}" aria-pressed="${q.done}">${q.done ? 'Undo' : 'Done'}</button>` : ''}</li>`).join('')}</ul>
    ${boss ? `<div class="boss ${boss.done ? 'beaten' : ''}"><p class="w-lbl">Weekly boss${boss.done ? ' · beaten' : ''}</p>
      <p><b>${esc(boss.name)}</b> <span class="small muted">+${BOSS_REWARD.tokens} tokens · +${BOSS_REWARD.xp} XP</span></p>
      ${boss.parts.map(([label, have, need]) => `<div class="boss-part"><span class="small">${esc(label)}</span><span class="small muted">${Math.min(have, need)} / ${need}</span><div class="meter ${have >= need ? 'good' : 'mat'}"><span style="width:${Math.min(1, have / need) * 100}%"></span></div></div>`).join('')}</div>` : ''}
    ${offer ? `<div class="callout"><p>Last week slipped by. A streak freeze keeps your streak going.</p><div class="row-actions"><button class="btn sm" data-act="game-freeze" data-week="${offer}">Use a streak freeze</button></div></div>` : ''}
    <div class="quest-foot"><button class="card-link" data-act="goto" data-view="athlete" data-anchor="character">Character and shop</button>${coin(balance())}</div>
    <p class="small muted">${week?.rest >= ACTIVE_REST_DAYS ? 'Active recovery bonus: +10% tokens this week.' : `Move on ${ACTIVE_REST_DAYS} days off the mat this week (a run, a ride, yoga) for +10% tokens.`} Quests tick themselves off from what you log. Rest days never cost you anything.</p>
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
export const snapshot = () => ({ xp: totalXp(), level: levelOf().level, done: questsOn(today()).filter(q => q.done).map(q => q.id), story: story().filter(c => c.state === 'done').map(c => c.id), unlocks: Object.keys(SHOP).filter(id => SHOP[id].unlock && owns(id)) })
export function announceGains(before, after) {
  const gained = after.xp - before.xp, quests = questsOn(today()).filter(q => q.done && !before.done.includes(q.id))
  const chapters = story().filter(c => after.story.includes(c.id) && !before.story.includes(c.id))
  const parts = [gained > 0 && `+${gained.toLocaleString()} XP`, ...quests.map(q => `Quest done: ${q.text}`), ...chapters.map(c => `Chapter done: ${c.title}, +${c.tokens} tokens`), ...after.unlocks.filter(id => !before.unlocks.includes(id)).map(id => `Unlocked in the shop: ${SHOP[id].name}`)].filter(Boolean)
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
  'shop-slot': el => { UI.shopSlot = el.dataset.slot },
  'game-chapter': el => { saveGame({ story: { ...game().story, [el.dataset.id]: today() } }); toast('Chapter started. Your mission counts from today.') },
  'game-freeze': el => { saveGame({ frozen: [...game().frozen, el.dataset.week] }); toast('Streak saved. Back at it this week.') },
}
