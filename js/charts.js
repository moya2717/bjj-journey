import { S } from './store.js'
import { BELT_LOOK } from './vocab.js'
import { esc, fmtDateLong, isoDate, pct, today, weekStart } from './util.js'
import { rankName } from './model.js'

// Every value in a chart can be read: tap or click its mark, or Tab to it and press Enter. A mark
// carries its text in data-tip and the handler at the end of this file shows it in a callout.
// `hit` is an invisible, generous target, so thin bars and small dots are easy to tap.
const tip = (text, focus = true) => `data-tip="${esc(text)}"${focus ? ` tabindex="0" role="button" aria-label="${esc(text)}"` : ''}`
const hit = (x, y, w, h) => `<rect class="hit-area" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"></rect>`
const num = v => String(+(+v).toFixed(1))

export function lineChart(series, { w = 320, h = 120 } = {}) {
  const pL = 34, pR = 10, pT = 10, pB = 22, iw = w - pL - pR, ih = h - pT - pB
  const x = i => pL + (series.length < 2 ? iw / 2 : i * iw / (series.length - 1))
  const y = v => pT + ih - v * ih
  const points = series.map((s, i) => s.rate == null ? null : [x(i), y(s.rate), s]).filter(Boolean), slot = iw / Math.max(1, series.length - 1)
  const label = 'Monthly roll success: ' + series.map(s => `${s.label} ${pct(s.rate)}`).join(', ')
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(label)}">
    ${[0, 0.5, 1].map(v => `<line class="grid" x1="${pL}" x2="${w - pR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pL - 6}" y="${y(v) + 3}" text-anchor="end">${v * 100}%</text>`).join('')}
    ${series.map((s, i) => `<text class="axis" x="${x(i)}" y="${h - 6}" text-anchor="middle">${esc(s.label)}</text>`).join('')}
    ${points.length > 1 ? `<path class="line" d="M${points.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')}"/>` : ''}
    ${points.map(([px, py, s]) => `<g ${tip(`${s.label}: ${pct(s.rate)}`)}>${hit(px - slot / 2, 0, slot, h)}<circle class="dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5"/></g>`).join('')}
  </svg>`
}

export function heatmap(weeks) {
  const minutes = {}
  S.session.forEach(s => minutes[s.date] = (minutes[s.date] || 0) + Math.max(1, +s.minutes || 0))
  const start = weekStart(new Date()); start.setDate(start.getDate() - 7 * (weeks - 1))
  const now = today()
  let cells = '', months = '', prevMonth = -1, active = 0
  for (let w = 0; w < weeks; w++) {
    const ws = new Date(start); ws.setDate(ws.getDate() + 7 * w)
    months += `<span>${ws.getMonth() !== prevMonth ? ws.toLocaleDateString(undefined, { month: 'short' }) : ''}</span>`
    prevMonth = ws.getMonth()
    for (let d = 0; d < 7; d++) {
      const day = new Date(ws); day.setDate(day.getDate() + d)
      const key = isoDate(day)
      if (key > now) { cells += '<span class="cell future"></span>'; continue }
      const m = minutes[key] || 0
      if (m) active++
      // 182 days would be too many Tab stops; the calendar's label sums them up for keyboards and screen readers.
      cells += `<span class="cell l${heatLevel(m)}" ${tip(`${fmtDateLong(key)}: ${m ? m + ' min' : 'no training'}`, false)}></span>`
    }
  }
  return `<div class="heat-scroll"><div class="heat" role="img" aria-label="Training calendar for the last ${weeks} weeks, ${active} days trained">
    <span></span><div class="heat-months" aria-hidden="true">${months}</div>
    <div class="heat-days" aria-hidden="true"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
    <div class="heat-grid">${cells}</div></div></div>
    <div class="heat-key" aria-hidden="true">Less <span class="cell"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span> More mat time</div>`
}

export const heatLevel = minutes => !minutes ? 0 : minutes <= 60 ? 1 : minutes <= 90 ? 2 : minutes <= 150 ? 3 : 4

export function spark(months, max) {
  const w = 104, h = 30, bw = 12, gap = (w - bw * months.length) / Math.max(1, months.length - 1)
  const label = months.map(m => `${m.label} ${m.v == null ? 'no rolls' : pct(m.v)}`).join(', ')
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(label)}">${months.map((m, i) => {
    const x = i * (bw + gap), bh = Math.max(2, m.v / max * (h - 2))
    return `<g ${tip(`${m.label}: ${m.v == null ? 'no rolls' : pct(m.v)}`)}>${hit(x - gap / 2, 0, bw + gap, h)}${!m.v
      ? `<rect class="none" x="${x.toFixed(1)}" y="${h - 1.5}" width="${bw}" height="1.5"></rect>`
      : `<rect class="b${i === months.length - 1 ? ' last' : ''}" x="${x.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1.5"></rect>`}</g>`
  }).join('')}</svg>`
}

export function beltArt(rank) {
  const look = BELT_LOOK[rank.belt] || BELT_LOOK.White
  return `<div class="belt-art" style="background:${look.belt}" role="img" aria-label="${esc(rankName(rank))}">
    <div class="bar" style="background:${look.bar}">${'<i></i>'.repeat(Math.min(4, +rank.stripes || 0))}</div></div>`
}

// Stacked bars, one per month or week. Each series gets a class (g0, g1… unless given) so CSS colors it for both themes.
export function stackedBars(months, names, { w = 340, h = 150, what = 'Moves landed', by = 'month', classes = names.map((_, i) => 'g' + i) } = {}) {
  const total = m => m.counts.reduce((a, b) => a + b, 0)
  // Small counts round up to a multiple of 4; big numbers to a round half-step, like 5000.
  const max = Math.max(1, ...months.map(total)), step = 10 ** Math.floor(Math.log10(max)) / 2
  const top = max <= 4 ? max : max < 100 ? Math.ceil(max / 4) * 4 : Math.ceil(max / step) * step
  const pL = 14 + 6 * String(top).length, pR = 6, pT = 10, pB = 22, iw = w - pL - pR, ih = h - pT - pB
  const slot = iw / months.length, bw = Math.min(28, slot * 0.64), y = v => pT + ih - v / top * ih
  // "Sep: Offensive 6 · Control 2 · Defensive 1 (9 total)", or "Sep: 3 sessions" for one series.
  const say = m => !total(m) ? `${m.label}: none` : names.length < 2 ? `${m.label}: ${num(m.counts[0])} ${names[0].toLowerCase()}`
    : `${m.label}: ${names.map((g, i) => `${g} ${num(m.counts[i])}`).join(' · ')} (${num(total(m))} total)`
  const label = `${what} by ${by}: ` + months.map(say).join('; ')
  return `<svg class="chart stack" viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(label)}">
    ${[0, top / 2, top].map(v => `<line class="grid" x1="${pL}" x2="${w - pR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pL - 6}" y="${y(v) + 3}" text-anchor="end">${+v.toFixed(1)}</text>`).join('')}
    ${months.map((m, i) => {
      const x = pL + i * slot + (slot - bw) / 2
      let base = 0
      return `<g ${tip(say(m))}>${hit(pL + i * slot, 0, slot, h)}${m.counts.map((c, j) => {
        if (!c) return ''
        const r = `<rect class="${classes[j]}" x="${x.toFixed(1)}" y="${y(base + c).toFixed(1)}" width="${bw.toFixed(1)}" height="${(c / top * ih).toFixed(1)}"></rect>`
        base += c
        return r
      }).join('')}${months.length > 8 && (months.length - 1 - i) % 2 ? '' : `<text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(m.label)}</text>`}</g>`
    }).join('')}
  </svg>`
}

// Two-sided bars from a center line: landed to the right, caught by to the left.
export function butterfly(rows, { w = 320, row = 22 } = {}) {
  const pL = 70, mid = pL + (w - pL) / 2, half = (w - pL) / 2 - 22, h = rows.length * row + 22
  const max = Math.max(1, ...rows.flatMap(r => [r.landed, r.caught]))
  const label = 'Landed versus caught by, per move type: ' + rows.map(r => `${r.type} landed ${r.landed}, caught by ${r.caught}`).join('; ')
  return `<svg class="chart fly" viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(label)}">
    <text class="axis" x="${mid - 6}" y="10" text-anchor="end">← Caught by</text><text class="axis" x="${mid + 6}" y="10">Landed →</text>
    ${rows.map((r, i) => {
      const cy = 18 + i * row, bh = row - 8, lw = r.landed / max * half, cw = r.caught / max * half
      return `<g ${tip(`${r.type}: landed ${r.landed} · caught by ${r.caught}`)}>${hit(0, cy - 4, w, row)}<text class="axis type" x="0" y="${cy + bh / 2 + 4}">${esc(r.type)}</text>
        ${cw ? `<rect class="caught" x="${(mid - cw).toFixed(1)}" y="${cy}" width="${cw.toFixed(1)}" height="${bh}" rx="2"></rect>` : ''}
        ${lw ? `<rect class="landed" x="${mid}" y="${cy}" width="${lw.toFixed(1)}" height="${bh}" rx="2"></rect>` : ''}
        ${r.caught ? `<text class="axis" x="${(mid - cw - 4).toFixed(1)}" y="${cy + bh / 2 + 4}" text-anchor="end">${r.caught}</text>` : ''}
        ${r.landed ? `<text class="axis" x="${(mid + lw + 4).toFixed(1)}" y="${cy + bh / 2 + 4}">${r.landed}</text>` : ''}</g>`
    }).join('')}
    <line class="grid" x1="${mid}" x2="${mid}" y1="14" y2="${h - 2}"/>
  </svg>`
}

// A simple trend line for any number, with a formatter for the axis. Gaps (null) are skipped.
export function trendLine(points, { w = 340, h = 120, fmt = String, what = '' } = {}) {
  const pL = 38, pR = 10, pT = 10, pB = 22, iw = w - pL - pR, ih = h - pT - pB
  const vals = points.map(p => p.v).filter(v => v != null)
  if (!vals.length) return ''
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.15 || hi * 0.1 || 1, min = lo - pad, max = hi + pad
  const x = i => pL + (points.length < 2 ? iw / 2 : i * iw / (points.length - 1)), y = v => pT + ih - (v - min) / (max - min) * ih
  const dots = points.map((p, i) => p.v == null ? null : [x(i), y(p.v), p]).filter(Boolean)
  const every = Math.ceil(points.length / 6), slot = iw / Math.max(1, points.length - 1)
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="group" aria-label="${esc(what + ': ' + points.filter(p => p.v != null).map(p => `${p.label} ${fmt(p.v)}`).join(', '))}">
    ${[min + pad, max - pad].map(v => `<line class="grid" x1="${pL}" x2="${w - pR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${pL - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
    ${points.map((p, i) => i % every ? '' : `<text class="axis" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(p.label)}</text>`).join('')}
    ${dots.length > 1 ? `<path class="line" d="M${dots.map(d => d[0].toFixed(1) + ',' + d[1].toFixed(1)).join(' L')}"/>` : ''}
    ${dots.map(d => `<g ${tip(`${d[2].label}: ${fmt(d[2].v)}`)}>${hit(d[0] - slot / 2, 0, slot, h)}<circle class="dot" cx="${d[0].toFixed(1)}" cy="${d[1].toFixed(1)}" r="3.5"></circle></g>`).join('')}
  </svg>`
}

// A tile's sparkline: small bars, the latest one lit, from points like { label, v, text }. Hidden from
// screen readers (the tile says the number), but tapping a bar shows its value; the rest of the tile opens it.
export function sparkBars(points) {
  const max = Math.max(1e-9, ...points.map(p => p.v || 0)), w = 100 / points.length
  return `<svg class="tile-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">${points.map((p, i) => {
    const h = p.v ? Math.max(2, p.v / max * 22) : 1
    return `<g ${tip(`${p.label}: ${p.text ?? p.v ?? '—'}`, false)}>${hit(i * w, 0, w, 24)}<rect class="${i === points.length - 1 ? 'last' : ''}" x="${(i * w + w * 0.15).toFixed(1)}" y="${(24 - h).toFixed(1)}" width="${(w * 0.7).toFixed(1)}" height="${h.toFixed(1)}" rx="1"></rect></g>`
  }).join('')}</svg>`
}

// A radar of your game: one spoke per axis (values 0–100), a lit shape for now, an optional dashed
// shape from before and a faint one for where partners catch you. A tiny starter shape shows
// before there's anything logged, so the chart always reads as something to grow.
export function radar(axes, { mini = false, then = false, caught = false } = {}) {
  const W = mini ? 100 : 340, H = mini ? 72 : 300, cx = W / 2, cy = H / 2 + (mini ? 0 : 4), R = mini ? 32 : 88, n = axes.length
  const at = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = R * Math.max(v, 0) / 100; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] }
  const shape = f => axes.map((a, i) => at(i, f(a)).map(x => x.toFixed(1)).join(',')).join(' ')
  const label = axes.map(a => `${a.label} ${a.v}`).join(', ')
  const say = a => `${a.label}: ${a.v} of 100${then ? ` · ${a.then} three months ago` : ''}${caught && a.caught ? ` · caught ${a.caught}` : ''}`
  return `<svg class="radar ${mini ? 'mini' : ''}" viewBox="0 0 ${W} ${H}" ${mini ? 'aria-hidden="true"' : `role="group" aria-label="${esc('Your game, out of 100: ' + label)}"`}>
    ${[25, 50, 75, 100].map(v => `<polygon class="ring" points="${shape(() => v)}"></polygon>`).join('')}
    ${axes.map((a, i) => { const [x, y] = at(i, 100); return `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>` }).join('')}
    ${caught ? `<polygon class="caught" points="${shape(a => a.caught)}"></polygon>` : ''}
    ${then ? `<polygon class="then" points="${shape(a => a.then)}"></polygon>` : ''}
    <polygon class="now" points="${shape(a => Math.max(10, a.v))}"></polygon>
    ${axes.map((a, i) => { const [x, y] = at(i, 116), anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end', top = y < cy - 4
      // Each side's slice of the chart, out past its label, is its tap target.
      const out = mini ? 110 : 150, wedge = [[cx, cy], ...[-0.5, -0.25, 0, 0.25, 0.5].map(d => at(i + d, out))].map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')
      return `<g ${tip(say(a), !mini)}><polygon class="hit-area" points="${wedge}"></polygon>${mini ? '' : `<text x="${x.toFixed(1)}" y="${(y + (top ? -6 : 4)).toFixed(1)}" text-anchor="${anchor}">${esc(a.label)}<tspan class="v" x="${x.toFixed(1)}" dy="14">${a.v}</tspan></text>`}</g>` }).join('')}
  </svg>`
}

// The callout, one for the whole app. It listens before the app's click handler, so tapping a
// sparkline inside a tile shows the value instead of opening the tile. A tap anywhere else closes it.
const callout = document.createElement('div')
callout.id = 'chart-tip'
callout.setAttribute('role', 'status')
let shown = null
function hideTip() {
  shown?.classList.remove('tip-on')
  shown = null
  callout.remove()
}
function showTip(mark) {
  hideTip()
  shown = mark
  mark.classList.add('tip-on')
  callout.textContent = mark.dataset.tip
  document.body.append(callout)
  // Centered above the mark, kept on screen and clear of the header; below it if there's no room.
  const r = mark.getBoundingClientRect(), w = callout.offsetWidth, h = callout.offsetHeight
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 0
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8))
  const top = r.top - h - 8 > header ? r.top - h - 8 : Math.min(r.bottom + 8, innerHeight - h - 8)
  callout.style.left = left + scrollX + 'px'
  callout.style.top = top + scrollY + 'px'
}
const toggle = mark => mark === shown ? hideTip() : showTip(mark)
document.addEventListener('click', e => {
  const mark = e.target.closest?.('[data-tip]')
  if (!mark) return hideTip()
  e.stopPropagation()
  e.preventDefault()
  toggle(mark)
}, true)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return hideTip()
  const mark = (e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-tip]')
  if (mark) { e.preventDefault(); toggle(mark) }
})
addEventListener('resize', hideTip)
