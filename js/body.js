import { S } from './store.js'
import { esc, parseD, plural, span, today } from './util.js'

// Injuries: where it hurts, how bad, and how training changed around it.

export const BODY_PARTS = ['Neck', 'Shoulder', 'Elbow', 'Wrist / hand / fingers', 'Ribs', 'Lower back', 'Hip', 'Knee', 'Ankle / foot', 'Other']
export const CENTER_PARTS = ['Neck', 'Lower back']
export const SIDES = { L: 'Left', R: 'Right', both: 'Both sides' }
export const SEVERITY = ['', 'Mild', 'Moderate', 'Severe']
export const SEVERITY_HINT = ['', 'Training around it', 'Holding back a lot', 'Off the mats']
export const MODS = ['No takedowns', 'Drilling only', 'Avoid guard bottom', 'Avoid guard top', 'No leg locks', 'Light rolls only', 'Taped', 'Brace or support', 'Tapping early', 'Rest days']

export const isActive = i => !i.endDate
export const activeInjuries = () => S.injury.filter(isActive).sort((a, b) => (b.severity || 1) - (a.severity || 1) || b.startDate.localeCompare(a.startDate))
export const injuriesOf = session => (session.injuryIds || []).map(id => S.injury.find(i => i.id === id)).filter(Boolean)
export const activeOn = date => S.injury.filter(i => i.startDate <= date && (!i.endDate || i.endDate >= date))

export function injuryName(i) {
  const part = i.bodyPart || 'Injury'
  if (CENTER_PARTS.includes(part) || part === 'Other' || !SIDES[i.side]) return part
  return i.side === 'both' ? `${part} (both sides)` : `${SIDES[i.side]} ${part.toLowerCase()}`
}

const days = (from, to) => Math.max(0, Math.round((parseD(to) - parseD(from)) / 864e5))
const length = n => n < 60 ? plural(n, 'day') : null

export function duration(i) {
  if (!i.startDate) return ''
  if (isActive(i)) {
    const n = days(i.startDate, today())
    return n === 0 ? 'Started today' : `${length(n) || span(i.startDate)} so far`
  }
  const n = days(i.startDate, i.endDate)
  return n === 0 ? 'Healed the same day' : length(n) || span(i.startDate, i.endDate)
}

// ---------- Body map: front and back, each region tappable ----------

const W = 270, H = 236, FRONT = 70, BACK = 200

const SPOTS = [
  // [part, dx, y, r, views]  dx is toward the person's left; 0 for the center line
  ['Neck', 0, 35, 7, 'fb'],
  ['Shoulder', 29, 46, 10, 'fb'],
  ['Elbow', 39, 84, 9, 'fb'],
  ['Wrist / hand / fingers', 45, 122, 9, 'fb'],
  ['Ribs', 15, 72, 10, 'f'],
  ['Lower back', 0, 97, 11, 'b'],
  ['Hip', 17, 108, 10, 'f'],
  ['Knee', 15, 158, 10, 'fb'],
  ['Ankle / foot', 16, 206, 9, 'fb'],
]

function figure(cx) {
  const limb = (pts, w) => `<path d="M${pts.map(([x, y]) => `${cx + x},${y}`).join(' L')}" stroke-width="${w}"/>`
  const both = (pts, w) => limb(pts, w) + limb(pts.map(([x, y]) => [-x, y]), w)
  return `<g class="bm-body" aria-hidden="true">
    <circle cx="${cx}" cy="17" r="12"/>
    <path class="bm-fill" d="M${cx - 6},28 h12 v8 l22,6 q6,2 5,10 l-6,48 q4,6 2,12 h-58 q-2,-6 2,-12 l-6,-48 q-1,-8 5,-10 l22,-6z"/>
    ${both([[30, 47], [39, 84], [45, 120]], 11)}
    ${both([[13, 110], [15, 158], [15, 204]], 15)}
    ${both([[45, 120], [46, 128]], 12)}
    ${both([[15, 206], [19, 212]], 12)}
  </g>`
}

// Which injury, if any, colors a region: active wins over past, worse over milder.
function stateOf(part, side) {
  const here = S.injury.filter(i => i.bodyPart === part && (side === 'both' || CENTER_PARTS.includes(part) || i.side === side || i.side === 'both' || !i.side))
  const active = here.filter(isActive).sort((a, b) => (b.severity || 1) - (a.severity || 1))[0]
  return active ? ['active s' + (active.severity || 1), active] : here.length ? ['past', null] : ['', null]
}

export function bodyMap() {
  const spots = ['f', 'b'].flatMap(view => SPOTS.filter(s => s[4].includes(view)).flatMap(([part, dx, y, r]) => {
    const cx = view === 'f' ? FRONT : BACK
    // The person's left is your right on the front figure and your left on the back.
    return (dx ? ['R', 'L'] : ['both']).map(side => {
      const x = cx + (side === 'both' ? 0 : (side === 'L') === (view === 'f') ? dx : -dx)
      const [state, active] = stateOf(part, side)
      const label = (CENTER_PARTS.includes(part) ? part : `${SIDES[side]} ${part.toLowerCase()}`) + (active ? `, active injury: ${SEVERITY[active.severity || 1].toLowerCase()}` : state === 'past' ? ', past injury' : '')
      return `<circle class="bm-spot ${state}" cx="${x}" cy="${y}" r="${r}" role="button" tabindex="0" aria-label="${esc(label)}" data-act="body-part" data-part="${esc(part)}" data-side="${side}"><title>${esc(label)}</title></circle>`
    })
  })).join('')
  return `<svg class="body-map" viewBox="0 0 ${W} ${H}" role="group" aria-label="Body map. Tap where it hurts to log or open an injury.">
    ${figure(FRONT)}${figure(BACK)}${spots}
    <text class="axis" x="${FRONT}" y="${H - 1}" text-anchor="middle">Front</text><text class="axis" x="${BACK}" y="${H - 1}" text-anchor="middle">Back</text>
    <text class="axis" x="${FRONT - 52}" y="12">R</text><text class="axis" x="${FRONT + 46}" y="12">L</text>
    <text class="axis" x="${BACK - 52}" y="12">L</text><text class="axis" x="${BACK + 46}" y="12">R</text>
  </svg>`
}

// SVG regions aren't real buttons, so Enter and Space need wiring to the click handler.
export function wireBodyMap(root) {
  root.querySelector('.body-map')?.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.bm-spot')) {
      e.preventDefault()
      e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  })
}
