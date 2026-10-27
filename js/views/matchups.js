import { S } from '../store.js'
import { cap, daysAgo, esc, pct, plural, rate } from '../util.js'
import { partnerNames } from '../model.js'
import { breakSummary, hardestMatchup, matchupGroups } from '../analysis.js'
import { fold } from './hub.js'

function table(rows, firstColumn) {
  return `<div class="table-scroll"><table><thead><tr><th scope="col" class="l">${esc(firstColumn)}</th><th scope="col">Rolls</th><th scope="col">Success</th><th scope="col">vs everyone else</th><th scope="col" class="l">Usually goes wrong at</th><th scope="col" class="l">Main cause</th></tr></thead>
    <tbody>${rows.map(x => {
      const b = breakSummary(x.rolls), gap = x.others == null ? null : Math.round((x.rate - x.others) * 100)
      return `<tr><td class="l">${esc(cap(x.label))}</td><td>${x.n}</td>
        <td><span class="meter good"><span style="width:${Math.max(3, x.rate * 100)}%"></span></span>${pct(x.rate)}</td>
        <td class="${gap == null || Math.abs(gap) < 10 ? '' : gap < 0 ? 'delta-down' : 'delta-up'}">${gap == null ? '—' : (gap > 0 ? '+' : gap < 0 ? '−' : '') + Math.abs(gap) + ' pts'}</td>
        <td class="l">${b.spot || '—'}</td><td class="l">${b.cause ? esc(b.cause) : '—'}</td></tr>`
    }).join('')}</tbody></table></div>`
}

export function view() {
  const head = `<div class="page-head"><div><h1>Matchups</h1><p class="lede">How your rolls go against different kinds of partners, and where each matchup tends to go wrong. Covers the last 6 months.</p></div>
    <div class="head-actions"><button class="btn" data-act="new-roll">Log a roll</button></div></div>`
  const rolls = S.roll.filter(r => r.date >= daysAgo(182))
  if (!rolls.length) return head + `<div class="empty-state"><h2>No rolls in the last 6 months</h2><p>When you log a roll, note your partner’s belt, size and style. This page then shows which kinds of partners give you the most trouble.</p><button class="btn" data-act="new-roll">Log a roll</button></div>`
  const hard = hardestMatchup(rolls), hb = hard && breakSummary(hard.rolls)
  const people = partnerNames().map(name => {
    const key = name.toLowerCase(), isThem = r => (r.partner || '').trim().toLowerCase() === key
    const theirs = rolls.filter(isThem)
    return { label: name, n: theirs.length, rate: rate(theirs), others: rate(rolls.filter(r => !isThem(r))), rolls: theirs }
  }).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 12)

  return head + `<div class="stat-grid">
    <section class="panel wide"><h2>Toughest matchup</h2>
      <div class="figures">
        <div class="figure"><div class="big">${pct(rate(rolls))}</div><div class="lbl">success across ${plural(rolls.length, 'roll')}</div></div>
        ${hard ? `<div class="figure"><div class="big" style="color:var(--broke)">${pct(hard.rate)}</div><div class="lbl">against ${esc(hard.label)} partners</div></div>` : ''}
      </div>
      ${hard
        ? `<p style="margin-top:8px;max-width:70ch">Your results drop most against <strong>${esc(hard.label)}</strong> partners: ${pct(hard.rate)} over ${plural(hard.n, 'roll')}, against ${pct(hard.others)} with everyone else.${hb.spot ? ` It mostly goes wrong at ${hb.spot}${hb.cause ? `, usually from ${esc(hb.cause.toLowerCase())}` : ''}.` : ''}</p>`
        : '<p class="muted" style="margin-top:8px">No matchup stands out yet. One shows up here once a group has at least 4 rolls and trails everyone else by 15 points or more.</p>'}
    </section>
    <div class="wide">${matchupGroups(rolls).map(d => fold('mu-' + d.what, `<b>${d.title}</b><span class="small muted">noted on ${d.noted} of ${rolls.length}</span>`,
      d.rows.length ? table(d.rows, cap(d.what)) : `<p class="muted">Add partner ${d.what} when you log rolls to compare here.</p>`)).join('')}
    ${fold('mu-partners', `<b>Training partners</b><span class="small muted">${plural(people.length, 'partner')}</span>`, `<div>
      ${people.length ? table(people, 'Partner') : '<p class="muted">Add partner names to your roll notes. Anyone you’ve rolled with at least twice shows up here.</p>'}
      <p class="small muted" style="margin-top:10px">Small groups swing a lot. Treat a gap from 4 or 5 rolls as a question to test, not a conclusion.</p></div>`)}</div>
  </div>`
}

export const actions = {}
