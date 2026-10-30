// The Dojo: one character that grows with you. Its level is your BJJ level, the same number as on the
// Skill tree and your Profile: your belt sets the band, your moves and mat time fill it. Its look changes
// by itself as it levels: no items, no shop. Its stats are your game map, so the character is your game.
import { S, cached } from '../store.js'
import { BELT_LOOK } from '../vocab.js'
import { esc, fmtDate, hrs, sum } from '../util.js'
import { MASTERY, allTechs, currentRank, masteryOf, rankName, sparred, landedIds, techById } from '../model.js'
import { gameMap } from '../analysis.js'
import { bjjLevel, skillTree } from '../skills.js'
import { explain } from './skills.js'

// ---------- Level ----------

// Titles by level, so each belt band has its own. A black belt's track starts over at Lv 1.
const TITLES = [[1, 'Fresh on the mat'], [6, 'Shrimp in training'], [12, 'Frame builder'], [21, 'Mat rat'], [31, 'Technician'], [41, 'Problem solver'], [51, 'Game builder'], [61, 'Professor in the making'], [71, 'Grinder of grinders']]
const BLACK_TITLES = [[1, 'Black belt'], [11, 'Professor'], [31, 'Master of the mat']]
export const titleOf = L => (L.black ? BLACK_TITLES : TITLES).filter(([l]) => L.level >= l).pop()[1]

// The look grows at these levels; a black belt has it all, plus a red-and-gold aura of its own.
const GLOWS = [[10, 'a headband'], [25, 'a glow'], [50, 'sparks'], [75, 'a golden aura']]
const look = L => L.black ? 100 : L.level
const nextLook = L => L.black ? null : GLOWS.find(([l]) => l > L.level)

// ---------- The character ----------

const SKIN = '#C68E5E', HAIR = '#2A1D15', INK = '#1B1B1B'

// Gi or no-gi, from the kind of class you log most.
const nogi = () => S.session.filter(s => s.type === 'No-gi').length > S.session.filter(s => s.type === 'Gi').length

export function avatar(L, cls = '') {
  const level = look(L), rank = currentRank(), colors = BELT_LOOK[rank.belt] || BELT_LOOK.White, ng = nogi()
  const kit = ng ? 'var(--neon)' : '#F4F3EE', trim = ng ? 'var(--neon-2)' : 'rgba(0,0,0,.14)'
  const aura = L.black ? '#BF262C' : level >= 75 ? '#F5B301' : level >= 25 ? 'var(--neon)' : ''
  const gid = L.black ? 'dj-red' : level >= 75 ? 'dj-gold' : 'dj-neon'
  const glow = aura ? `<defs><radialGradient id="${gid}"><stop offset="35%" stop-color="${aura}" stop-opacity=".6"/><stop offset="100%" stop-color="${aura}" stop-opacity="0"/></radialGradient></defs><circle class="aura" cx="60" cy="74" r="58" fill="url(#${gid})"/>` : ''
  const sparks = level >= 50 ? [[16, 40], [104, 34], [12, 92], [108, 88], [30, 18], [92, 112]].map(([x, y], i) => `<path class="spark" style="animation-delay:${i * 0.35}s" d="M${x} ${y - 4}v8M${x - 4} ${y}h8" stroke="${L.black ? '#F5B301' : aura}" stroke-width="1.6" stroke-linecap="round"/>`).join('') : ''
  const tie = level >= 75 ? '#F5B301' : 'var(--neon-2)'
  const band = level >= 10 ? `<rect x="43" y="26" width="34" height="5" rx="2" fill="${tie}"/><path d="M76 28l10 3M76 30l8 6" stroke="${tie}" stroke-width="2.4" stroke-linecap="round"/>` : ''
  const belt = `<rect x="38" y="91" width="44" height="8" rx="2" fill="${colors.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><rect x="66" y="91" width="12" height="8" fill="${colors.bar}"/>
    ${Array.from({ length: Math.min(4, rank.stripes) }, (_, i) => `<rect x="${68 + i * 2.5}" y="91" width="1.4" height="8" fill="#F4F3EE"/>`).join('')}
    <rect x="56" y="90" width="8" height="10" rx="1.5" fill="${colors.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><path d="M57 100l-3 9M63 100l3 9" stroke="${colors.belt}" stroke-width="3.2" stroke-linecap="round"/>`
  const legs = ng
    ? `<rect x="46" y="106" width="11" height="24" rx="5" fill="${SKIN}"/><rect x="63" y="106" width="11" height="24" rx="5" fill="${SKIN}"/><rect x="41" y="96" width="38" height="17" rx="6" fill="#1F2329"/>`
    : `<rect x="44" y="97" width="15" height="34" rx="6" fill="${kit}"/><rect x="61" y="97" width="15" height="34" rx="6" fill="${kit}"/>`
  const arm = (x, r) => `<rect x="${x}" y="58" width="12" height="36" rx="6" fill="${kit}" transform="rotate(${r} ${x + 6} 60)"/>`
  const top = ng ? `<path d="M38 58q22-7 44 0l-2 42H40z" fill="${kit}"/><rect x="39" y="72" width="42" height="3" fill="${trim}"/>${belt}`
    : `<path d="M38 58q22-7 44 0l-2 42H40z" fill="${kit}"/><path d="M49 55l11 27 11-27" stroke="${trim}" stroke-width="5" fill="none"/>${belt}`
  return `<svg class="dojo-av ${cls}" viewBox="0 0 120 140" role="img" aria-label="Your character: ${L.black ? 'Black Belt Lv ' : 'level '}${L.level}, ${esc(rankName(rank).toLowerCase())}">
    <rect width="120" height="140" rx="18" fill="var(--surface-2)"/><rect y="112" width="120" height="28" fill="var(--mat-soft)"/>
    ${glow}${sparks}
    <ellipse cx="60" cy="132" rx="30" ry="4" fill="rgba(0,0,0,.2)"/>
    ${legs}<ellipse cx="51" cy="131" rx="7" ry="3.5" fill="${SKIN}"/><ellipse cx="69" cy="131" rx="7" ry="3.5" fill="${SKIN}"/>
    ${arm(26, 12)}${arm(82, -12)}<circle cx="29" cy="96" r="5.5" fill="${SKIN}"/><circle cx="91" cy="96" r="5.5" fill="${SKIN}"/>
    <rect x="54" y="48" width="12" height="11" fill="${SKIN}"/>${top}
    <circle cx="43" cy="38" r="3.5" fill="${SKIN}"/><circle cx="77" cy="38" r="3.5" fill="${SKIN}"/><circle cx="60" cy="36" r="17" fill="${SKIN}"/>
    <path d="M43 35q1-18 17-18t17 18q-5-9-17-9t-17 9z" fill="${HAIR}"/>
    <circle cx="54" cy="38" r="1.9" fill="${INK}"/><circle cx="66" cy="38" r="1.9" fill="${INK}"/><path d="M55 44q5 4 10 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${band}
  </svg>`
}

// ---------- The page ----------

// The moves that most recently joined your game: the first day each was drilled or landed.
const newestMoves = () => cached('newestMoves', () => {
  const first = {}
  const mark = (id, date) => { if (id && date && (!first[id] || date < first[id])) first[id] = date }
  S.session.forEach(s => (s.drilled || []).forEach(id => mark(id, s.date)))
  sparred().forEach(r => landedIds(r).forEach(id => mark(id, r.date)))
  return Object.entries(first).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 5).map(([id, date]) => ({ t: techById(id), date })).filter(x => x.t)
})

export function view() {
  const L = bjjLevel(), tree = skillTree(), name = S.profile.name?.split(/\s+/)[0] || 'Your fighter', map = gameMap(), next = nextLook(L)
  const moves = allTechs().map(t => masteryOf(t).level).filter(Boolean), byLevel = [4, 3, 2, 1].map(l => [l, moves.filter(m => m === l).length])
  const into = L.black ? (L.level - 1) % 10 / 9 : (L.level - L.lo) / (L.hi - L.lo)
  return `<section class="dojo-hero">
      ${avatar(L)}
      <div class="dojo-id">
        <p class="w-lbl">${esc(rankName(currentRank()))}</p>
        <h1>${esc(name)}</h1>
        <p class="dojo-title">${L.black ? `<b>Black Belt Lv ${L.level}</b>` : `Level <b>${L.level}</b>`} · ${esc(titleOf(L))}</p>
        <div class="xpbar" aria-hidden="true"><span style="width:${Math.max(3, Math.round(into * 100))}%"></span></div>
        <p class="small muted">${L.black ? `Level 100${L.since ? ' since ' + esc(fmtDate(L.since)) : ''}` : `${esc(L.belt)} belt band · ${L.lo}–${L.hi}`}</p>
      </div>
    </section>
    <div class="dojo-tiles">
      <div class="dojo-tile static"><span class="w-lbl">Mat time</span><span class="dojo-big">${hrs(sum(S.session, 'minutes'))}<small> h</small></span><span class="dojo-small">${hrs(L.hours * 60)} h at this belt</span></div>
      <button class="dojo-tile" data-act="goto" data-view="skills" data-anchor=""><span class="w-lbl">Moves explored</span><span class="dojo-big">${tree.lit}</span><span class="dojo-small">of ${tree.nodes.length} ›</span></button>
      <div class="dojo-tile static"><span class="w-lbl">Live wins</span><span class="dojo-big">${tree.nodes.reduce((n, x) => n + x.wins, 0)}</span><span class="dojo-small">landed live</span></div>
    </div>
    <p class="dojo-next">${L.top ? 'Top of your band. Ready for the next stripe or belt?' : 'Next level: light up new moves, land the ones you know live, and keep showing up.'}${next ? ` At level ${next[0]} your fighter gets ${next[1]}.` : L.black ? ' Your fighter wears a black belt’s red aura.' : ''}</p>

    <section class="panel dojo-stats"><h2>Stats</h2><p class="small muted">Your game map: each grows as you learn and land moves of that kind.</p>
      ${map.axes.map(a => `<div class="dojo-stat"><span>${esc(a.label)}</span><span class="xpbar"><span style="width:${Math.max(2, a.v)}%"></span></span><b>${a.v}</b></div>`).join('')}
    </section>

    <section class="panel"><h2>Your moves</h2>
      <div class="dojo-levels">${byLevel.map(([l, n]) => `<div><b>${n}</b><span class="small muted">${esc(MASTERY[l])}</span></div>`).join('')}</div>
      ${newestMoves().length ? `<p class="field-label" style="margin-top:12px">Newest in your game</p><ul class="list dojo-new">${newestMoves().map(x => `<li><span>${esc(x.t.name)}</span><span class="small muted">${esc(fmtDate(x.date))}</span></li>`).join('')}</ul>` : '<p class="small muted">Name the moves you drill in your class notes, and they show up here.</p>'}
    </section>
    <div class="dojo-how">${explain()}</div>`
}

export const actions = {}
