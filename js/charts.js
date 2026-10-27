import { S } from './store.js'
import { BELT_LOOK } from './vocab.js'
import { esc, fmtDateLong, isoDate, pct, today, weekStart } from './util.js'
import { rankName } from './model.js'

export function lineChart(series, { w = 320, h = 120 } = {}) {
  const pL = 34, pR = 10, pT = 10, pB = 22, iw = w - pL - pR, ih = h - pT - pB
  const x = i => pL + (series.length < 2 ? iw / 2 : i * iw / (series.length - 1))
  const y = v => pT + ih - v * ih
  const points = series.map((s, i) => s.rate == null ? null : [x(i), y(s.rate)]).filter(Boolean)
  const label = 'Monthly roll success: ' + series.map(s => `${s.label} ${pct(s.rate)}`).join(', ')
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
    ${[0, 0.5, 1].map(v => `<line class="grid" x1="${pL}" x2="${w - pR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pL - 6}" y="${y(v) + 3}" text-anchor="end">${v * 100}%</text>`).join('')}
    ${series.map((s, i) => `<text class="axis" x="${x(i)}" y="${h - 6}" text-anchor="middle">${esc(s.label)}</text>`).join('')}
    ${points.length > 1 ? `<path class="line" d="M${points.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L')}"/>` : ''}
    ${points.map(p => `<circle class="dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"/>`).join('')}
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
      cells += `<span class="cell l${heatLevel(m)}" title="${esc(fmtDateLong(key))}: ${m ? m + ' min' : 'no training'}"></span>`
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
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${months.map((m, i) => {
    const x = (i * (bw + gap)).toFixed(1)
    if (!m.v) return `<rect class="none" x="${x}" y="${h - 1.5}" width="${bw}" height="1.5"></rect>`
    const bh = Math.max(2, m.v / max * (h - 2))
    return `<rect class="b${i === months.length - 1 ? ' last' : ''}" x="${x}" y="${(h - bh).toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="1.5"><title>${esc(m.label)}: ${pct(m.v)}</title></rect>`
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
  const label = `${what} by ${by}: ` + months.map(m => `${m.label} ${names.map((g, i) => `${g} ${m.counts[i]}`).join(', ')}`).join('; ')
  return `<svg class="chart stack" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
    ${[0, top / 2, top].map(v => `<line class="grid" x1="${pL}" x2="${w - pR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pL - 6}" y="${y(v) + 3}" text-anchor="end">${+v.toFixed(1)}</text>`).join('')}
    ${months.map((m, i) => {
      const x = pL + i * slot + (slot - bw) / 2
      let base = 0
      return `<g>${m.counts.map((c, j) => {
        if (!c) return ''
        const r = `<rect class="${classes[j]}" x="${x.toFixed(1)}" y="${y(base + c).toFixed(1)}" width="${bw.toFixed(1)}" height="${(c / top * ih).toFixed(1)}"><title>${esc(m.label)}: ${c} ${esc(names[j].toLowerCase())}</title></rect>`
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
  return `<svg class="chart fly" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
    <text class="axis" x="${mid - 6}" y="10" text-anchor="end">← Caught by</text><text class="axis" x="${mid + 6}" y="10">Landed →</text>
    ${rows.map((r, i) => {
      const cy = 18 + i * row, bh = row - 8, lw = r.landed / max * half, cw = r.caught / max * half
      return `<text class="axis type" x="0" y="${cy + bh / 2 + 4}">${esc(r.type)}</text>
        ${cw ? `<rect class="caught" x="${(mid - cw).toFixed(1)}" y="${cy}" width="${cw.toFixed(1)}" height="${bh}" rx="2"><title>${esc(r.type)}: caught by ${r.caught}</title></rect>` : ''}
        ${lw ? `<rect class="landed" x="${mid}" y="${cy}" width="${lw.toFixed(1)}" height="${bh}" rx="2"><title>${esc(r.type)}: landed ${r.landed}</title></rect>` : ''}
        ${r.caught ? `<text class="axis" x="${(mid - cw - 4).toFixed(1)}" y="${cy + bh / 2 + 4}" text-anchor="end">${r.caught}</text>` : ''}
        ${r.landed ? `<text class="axis" x="${(mid + lw + 4).toFixed(1)}" y="${cy + bh / 2 + 4}">${r.landed}</text>` : ''}`
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
  const every = Math.ceil(points.length / 6)
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(what + ': ' + points.filter(p => p.v != null).map(p => `${p.label} ${fmt(p.v)}`).join(', '))}">
    ${[min + pad, max - pad].map(v => `<line class="grid" x1="${pL}" x2="${w - pR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${pL - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
    ${points.map((p, i) => i % every ? '' : `<text class="axis" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(p.label)}</text>`).join('')}
    ${dots.length > 1 ? `<path class="line" d="M${dots.map(d => d[0].toFixed(1) + ',' + d[1].toFixed(1)).join(' L')}"/>` : ''}
    ${dots.map(d => `<circle class="dot" cx="${d[0].toFixed(1)}" cy="${d[1].toFixed(1)}" r="3.5"><title>${esc(d[2].label)}: ${esc(fmt(d[2].v))}</title></circle>`).join('')}
  </svg>`
}

// A tile's sparkline: small bars, the latest one lit. Decorative; the tile says the number.
export function sparkBars(values) {
  const max = Math.max(1e-9, ...values.map(v => v || 0)), w = 100 / values.length
  return `<svg class="tile-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">${values.map((v, i) => {
    const h = v ? Math.max(2, v / max * 22) : 1
    return `<rect class="${i === values.length - 1 ? 'last' : ''}" x="${(i * w + w * 0.15).toFixed(1)}" y="${(24 - h).toFixed(1)}" width="${(w * 0.7).toFixed(1)}" height="${h.toFixed(1)}" rx="1"></rect>`
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
  return `<svg class="radar ${mini ? 'mini' : ''}" viewBox="0 0 ${W} ${H}" ${mini ? 'aria-hidden="true"' : `role="img" aria-label="${esc('Your game, out of 100: ' + label)}"`}>
    ${[25, 50, 75, 100].map(v => `<polygon class="ring" points="${shape(() => v)}"></polygon>`).join('')}
    ${axes.map((a, i) => { const [x, y] = at(i, 100); return `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line>` }).join('')}
    ${caught ? `<polygon class="caught" points="${shape(a => a.caught)}"></polygon>` : ''}
    ${then ? `<polygon class="then" points="${shape(a => a.then)}"></polygon>` : ''}
    <polygon class="now" points="${shape(a => Math.max(10, a.v))}"></polygon>
    ${mini ? '' : axes.map((a, i) => { const [x, y] = at(i, 116), anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end', top = y < cy - 4
      return `<text x="${x.toFixed(1)}" y="${(y + (top ? -6 : 4)).toFixed(1)}" text-anchor="${anchor}">${esc(a.label)}<tspan class="v" x="${x.toFixed(1)}" dy="14">${a.v}</tspan></text>` }).join('')}
  </svg>`
}
