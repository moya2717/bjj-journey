// The Dojo: one character that grows with you. Its level comes from two things only, time on the mat
// and the moves you've learned, and its look changes by itself as it levels: no items, no shop.
// Its stats are your game map, so the character is your game.
import { S, cached } from '../store.js'
import { BELT_LOOK } from '../vocab.js'
import { esc, fmtDate, hrs, plural, sum } from '../util.js'
import { MASTERY, allTechs, currentRank, masteryOf, rankName, sparred, landedIds, techById } from '../model.js'
import { gameMap } from '../analysis.js'

// ---------- Level ----------

// 10 XP an hour on the mat; a move gives more the further it's come: seen it 5, drilled 15,
// hit in sparring 30, hit on a higher belt 50.
const HOUR_XP = 10, MOVE_XP = [0, 5, 15, 30, 50]
export const xpFor = level => Math.round(50 * Math.pow(level - 1, 1.6))

export const fighter = () => cached('fighter', () => {
  const minutes = sum(S.session, 'minutes')
  const moves = allTechs().map(t => ({ t, level: masteryOf(t).level })).filter(m => m.level)
  const matXp = Math.round(minutes / 60 * HOUR_XP), moveXp = sum(moves, m => MOVE_XP[m.level])
  const xp = matXp + moveXp
  let level = 1
  while (xpFor(level + 1) <= xp) level++
  const from = xpFor(level), to = xpFor(level + 1)
  return { minutes, moves, learned: moves.filter(m => m.level >= 2).length, matXp, moveXp, xp, level, into: xp - from, need: to - xp, pct: (xp - from) / (to - from) }
})

const TITLES = [[1, 'Fresh on the mat'], [3, 'Shrimp in training'], [6, 'Frame builder'], [10, 'Mat rat'], [15, 'Technician'], [20, 'Grinder'], [30, 'Problem solver'], [40, 'Professor in the making'], [55, 'Legend of the mat']]
export const titleOf = level => TITLES.filter(([l]) => level >= l).pop()[1]

// The look grows at these levels.
const GLOWS = [[5, 'a headband'], [10, 'a glow'], [20, 'sparks'], [30, 'a golden aura']]
const nextLook = level => GLOWS.find(([l]) => l > level)

// ---------- The character ----------

const SKIN = '#C68E5E', HAIR = '#2A1D15', INK = '#1B1B1B'

// Gi or no-gi, from the kind of class you log most.
const nogi = () => S.session.filter(s => s.type === 'No-gi').length > S.session.filter(s => s.type === 'Gi').length

export function avatar(level, cls = '') {
  const rank = currentRank(), look = BELT_LOOK[rank.belt] || BELT_LOOK.White, ng = nogi()
  const kit = ng ? 'var(--neon)' : '#F4F3EE', trim = ng ? 'var(--neon-2)' : 'rgba(0,0,0,.14)'
  const aura = level >= 30 ? '#F5B301' : level >= 10 ? 'var(--neon)' : ''
  const gid = level >= 30 ? 'dj-gold' : 'dj-neon'
  const glow = aura ? `<defs><radialGradient id="${gid}"><stop offset="35%" stop-color="${aura}" stop-opacity=".6"/><stop offset="100%" stop-color="${aura}" stop-opacity="0"/></radialGradient></defs><circle class="aura" cx="60" cy="74" r="58" fill="url(#${gid})"/>` : ''
  const sparks = level >= 20 ? [[16, 40], [104, 34], [12, 92], [108, 88], [30, 18], [92, 112]].map(([x, y], i) => `<path class="spark" style="animation-delay:${i * 0.35}s" d="M${x} ${y - 4}v8M${x - 4} ${y}h8" stroke="${aura}" stroke-width="1.6" stroke-linecap="round"/>`).join('') : ''
  const band = level >= 5 ? `<rect x="43" y="26" width="34" height="5" rx="2" fill="${level >= 30 ? '#F5B301' : 'var(--neon-2)'}"/><path d="M76 28l10 3M76 30l8 6" stroke="${level >= 30 ? '#F5B301' : 'var(--neon-2)'}" stroke-width="2.4" stroke-linecap="round"/>` : ''
  const belt = `<rect x="38" y="91" width="44" height="8" rx="2" fill="${look.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><rect x="66" y="91" width="12" height="8" fill="${look.bar}"/>
    ${Array.from({ length: Math.min(4, rank.stripes) }, (_, i) => `<rect x="${68 + i * 2.5}" y="91" width="1.4" height="8" fill="#F4F3EE"/>`).join('')}
    <rect x="56" y="90" width="8" height="10" rx="1.5" fill="${look.belt}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/><path d="M57 100l-3 9M63 100l3 9" stroke="${look.belt}" stroke-width="3.2" stroke-linecap="round"/>`
  const legs = ng
    ? `<rect x="46" y="106" width="11" height="24" rx="5" fill="${SKIN}"/><rect x="63" y="106" width="11" height="24" rx="5" fill="${SKIN}"/><rect x="41" y="96" width="38" height="17" rx="6" fill="#1F2329"/>`
    : `<rect x="44" y="97" width="15" height="34" rx="6" fill="${kit}"/><rect x="61" y="97" width="15" height="34" rx="6" fill="${kit}"/>`
  const arm = (x, r) => `<rect x="${x}" y="58" width="12" height="36" rx="6" fill="${kit}" transform="rotate(${r} ${x + 6} 60)"/>`
  const top = ng ? `<path d="M38 58q22-7 44 0l-2 42H40z" fill="${kit}"/><rect x="39" y="72" width="42" height="3" fill="${trim}"/>${belt}`
    : `<path d="M38 58q22-7 44 0l-2 42H40z" fill="${kit}"/><path d="M49 55l11 27 11-27" stroke="${trim}" stroke-width="5" fill="none"/>${belt}`
  return `<svg class="dojo-av ${cls}" viewBox="0 0 120 140" role="img" aria-label="Your character: level ${level}, ${esc(rankName(rank).toLowerCase())}">
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
  const f = fighter(), name = S.profile.name?.split(/\s+/)[0] || 'Your fighter', map = gameMap(), next = nextLook(f.level)
  const byLevel = [4, 3, 2, 1].map(l => [l, f.moves.filter(m => m.level === l).length])
  const hoursToGo = Math.ceil(f.need / HOUR_XP), drillsToGo = Math.ceil(f.need / MOVE_XP[2])
  return `<section class="dojo-hero">
      ${avatar(f.level)}
      <div class="dojo-id">
        <p class="w-lbl">${esc(rankName(currentRank()))}</p>
        <h1>${esc(name)}</h1>
        <p class="dojo-title">Level <b>${f.level}</b> · ${esc(titleOf(f.level))}</p>
        <div class="xpbar" aria-hidden="true"><span style="width:${Math.round(f.pct * 100)}%"></span></div>
        <p class="small muted">${f.into.toLocaleString()} / ${(f.into + f.need).toLocaleString()} XP to level ${f.level + 1}</p>
      </div>
    </section>
    <div class="dojo-tiles">
      <div class="dojo-tile static"><span class="w-lbl">Mat time</span><span class="dojo-big">${hrs(f.minutes)}<small> h</small></span><span class="dojo-small">${f.matXp.toLocaleString()} XP</span></div>
      <div class="dojo-tile static"><span class="w-lbl">Moves learned</span><span class="dojo-big">${f.learned}</span><span class="dojo-small">${f.moveXp.toLocaleString()} XP</span></div>
      <div class="dojo-tile static"><span class="w-lbl">Total</span><span class="dojo-big">${f.xp.toLocaleString()}</span><span class="dojo-small">XP</span></div>
    </div>
    <p class="dojo-next">Next level: about <b>${plural(hoursToGo, 'hour')}</b> on the mat, or <b>${plural(drillsToGo, 'new move')}</b> drilled.${next ? ` At level ${next[0]} your fighter gets ${next[1]}.` : ''}</p>

    <section class="panel dojo-stats"><h2>Stats</h2><p class="small muted">Your game map: each grows as you learn and land moves of that kind.</p>
      ${map.axes.map(a => `<div class="dojo-stat"><span>${esc(a.label)}</span><span class="xpbar"><span style="width:${Math.max(2, a.v)}%"></span></span><b>${a.v}</b></div>`).join('')}
    </section>

    <section class="panel"><h2>Your moves</h2>
      <div class="dojo-levels">${byLevel.map(([l, n]) => `<div><b>${n}</b><span class="small muted">${esc(MASTERY[l])}</span></div>`).join('')}</div>
      ${newestMoves().length ? `<p class="field-label" style="margin-top:12px">Newest in your game</p><ul class="list dojo-new">${newestMoves().map(x => `<li><span>${esc(x.t.name)}</span><span class="small muted">${esc(fmtDate(x.date))}</span></li>`).join('')}</ul>` : '<p class="small muted">Name the moves you drill in your class notes, and they show up here.</p>'}
    </section>
    <p class="small muted dojo-how">How leveling works: ${HOUR_XP} XP for every hour on the mat, and for each move ${MOVE_XP.slice(1).map((x, i) => `${x} once you’ve ${['seen it', 'drilled it', 'hit it in sparring', 'hit it on a higher belt'][i]}`).join(', ')}.</p>`
}

export const actions = {}
