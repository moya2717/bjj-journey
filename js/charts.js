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
