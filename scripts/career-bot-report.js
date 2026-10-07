// Summarise career-bot CSVs as markdown tables for the balance record.
//   node scripts/career-bot-report.js [dir=test-results/career-bot] > summary.md
import { readFileSync, readdirSync } from 'node:fs';

const dir = process.argv[2] || 'test-results/career-bot';
function parse(text) {
  const rows = [],
    lines = text.trim().split('\n'),
    head = lines.shift().split(',');
  for (const line of lines) {
    const cells = [];
    let cur = '',
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    const row = {};
    head.forEach((k, i) => {
      const v = cells[i] ?? '';
      row[k] = v !== '' && !isNaN(+v) ? +v : v;
    });
    rows.push(row);
  }
  return rows;
}
const runs = readdirSync(dir)
  .filter((f) => f.endsWith('.csv'))
  .map((f) => ({ name: f.replace(/\.csv$/, ''), rows: parse(readFileSync(`${dir}/${f}`, 'utf8')) }))
  .filter((r) => r.rows.length);
const money = (v) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const spark = (values) => {
  const bars = '▁▂▃▄▅▆▇█',
    lo = Math.min(...values),
    hi = Math.max(...values);
  return values.map((v) => bars[hi === lo ? 0 : Math.round(((v - lo) / (hi - lo)) * 7)]).join('');
};

console.log(`## Runs (${runs.length})\n`);
console.log(
  '| Run | Days | Fished / rest / dock | Final cash | Debt | Total lb | lb per fished day | Net per fished day | Late offloads | Failed pickups | Rescues | Injuries | Lowest marked stock |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of runs) {
  const fished = r.rows.filter((x) => x.action === 'fish'),
    last = r.rows.at(-1);
  console.log(
    `| ${r.name} | ${last.day} | ${fished.length} / ${r.rows.filter((x) => x.action === 'rest').length} / ${r.rows.filter((x) => x.action === 'dock').length} | ${money(last.cash)} | ${money(last.debt || 0)} | ${Math.round(fished.reduce((n, x) => n + (x.catchLb || 0), 0)).toLocaleString('en-US')} | ${Math.round(avg(fished.map((x) => x.catchLb || 0)))} | ${money(avg(fished.map((x) => x.net || 0)))} | ${fished.filter((x) => x.onTime === 0).length} | ${fished.reduce((n, x) => n + (x.recoveryFailures || 0), 0)} | ${fished.filter((x) => /rescue/.test(x.note || '')).length} | ${fished.reduce((n, x) => n + (x.injuries || 0), 0)} | ${Math.min(...fished.map((x) => x.stockMarkedPct ?? 100))}% |`,
  );
}

console.log('\n## Cash over time\n');
console.log('| Run | Cash by day (sparkline) | Day 10 | Day 20 | Day 30 | Day 45 | Day 60 |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of runs) {
  const at = (d) => {
    const row = r.rows.filter((x) => x.day <= d).at(-1);
    return row ? money(row.cash) : '';
  };
  console.log(
    `| ${r.name} | ${spark(r.rows.map((x) => x.cash))} | ${at(10)} | ${at(20)} | ${at(30)} | ${at(45)} | ${at(60)} |`,
  );
}

console.log('\n## Purchases and milestones\n');
for (const r of runs) {
  const events = r.rows.filter((x) => x.purchases).map((x) => `d${x.day}: ${x.purchases}`);
  const rankUp = r.rows.find((x) => x.rank >= 1),
    rank2 = r.rows.find((x) => x.rank >= 2);
  console.log(
    `- **${r.name}**: ${events.join('; ') || 'nothing'}${rankUp ? ` · rank 1 on day ${rankUp.day}` : ''}${rank2 ? ` · rank 2 on day ${rank2.day}` : ''}`,
  );
}

// Style averages by ten-day window (fished days only).
console.log('\n## By style, ten-day windows (fished days)\n');
console.log(
  '| Style | Days | Fished | lb/day | Price $/lb | Gross $/day | Crew $/day | Fuel $/day | Net $/day | Late % |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
const styles = [...new Set(runs.map((r) => r.rows[0].style))];
for (const style of styles) {
  const rows = runs.filter((r) => r.rows[0].style === style).flatMap((r) => r.rows),
    maxDay = Math.max(...rows.map((x) => x.day));
  for (let from = 1; from <= maxDay; from += 10) {
    const slice = rows.filter((x) => x.day >= from && x.day < from + 10),
      fished = slice.filter((x) => x.action === 'fish');
    if (!slice.length) continue;
    console.log(
      `| ${style} | ${from}–${from + 9} | ${fished.length}/${slice.length} | ${Math.round(avg(fished.map((x) => x.catchLb)))} | ${avg(fished.filter((x) => x.landedLb).map((x) => x.pricePerLb)).toFixed(2)} | ${money(avg(fished.map((x) => x.value || 0)))} | ${money(avg(fished.map((x) => x.crewPay || 0)))} | ${money(avg(fished.map((x) => x.fuelCost || 0)))} | ${money(avg(fished.map((x) => x.net || 0)))} | ${Math.round((100 * fished.filter((x) => x.onTime === 0).length) / Math.max(1, fished.length))}% |`,
    );
  }
}

console.log('\n## Where the days went (areas fished)\n');
for (const r of runs) {
  const counts = {};
  for (const x of r.rows)
    counts[x.action === 'fish' ? x.area : x.action] =
      (counts[x.action === 'fish' ? x.area : x.action] || 0) + 1;
  console.log(
    `- ${r.name}: ` +
      Object.entries(counts)
        .map(([k, v]) => `${k} ${v}`)
        .join(', '),
  );
}

console.log('\n## Diver surfacing reasons (all runs)\n');
const reasons = {};
for (const r of runs)
  for (const x of r.rows)
    for (const part of String(x.diverSurfaceReasons || '')
      .split(' | ')
      .filter(Boolean)) {
      const [k, v] = part.split('=');
      reasons[k] = (reasons[k] || 0) + +v;
    }
for (const [k, v] of Object.entries(reasons)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15))
  console.log(`- ${k}: ${v}`);

console.log('\n## Incidents (all runs)\n');
const incidents = {};
for (const r of runs)
  for (const x of r.rows)
    for (const m of String(x.note || '').matchAll(
      /(near miss|injury|fatality|rescued|SUNK|stranded):?([a-zA-Z ]*?)(?= near miss| injury| fatality| rescued| SUNK| stranded| error|$)/g,
    )) {
      const key = `${m[1]}${m[2] ? ': ' + m[2] : ''}`;
      incidents[key] = (incidents[key] || 0) + 1;
    }
for (const [k, v] of Object.entries(incidents).sort((a, b) => b[1] - a[1]))
  console.log(`- ${k}: ${v}`);
