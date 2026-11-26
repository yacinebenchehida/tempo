<script lang="ts">
  import { db, clock } from '../lib/store.svelte';
  import { summarize, pct, signedPct, OTHER, type Period } from '../lib/stats';
  import { fmtDur, fmtHours, HOUR } from '../lib/time';
  import { exportFile } from '../lib/native';
  import { toast } from '../lib/store.svelte';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';

  let period = $state<Period>('week');
  let offset = $state(0);
  let hoverS = $state<string | null>(null);
  let hoverB = $state<number | null>(null);
  let showTable = $state(false);

  // Recompute once a minute, not every second.
  const minute = $derived(Math.floor(clock.now / 60000));
  const s = $derived.by(() => {
    void minute;
    return summarize(db, period, offset, Date.now());
  });
  const colorOf = (id: string) => s.series.find((x) => x.id === id)?.color ?? OTHER.color;
  const nameOf = (id: string) => s.series.find((x) => x.id === id)?.name ?? 'Other';

  // ----- doughnut -----
  const R = 80;
  const C = 2 * Math.PI * R;
  const donut = $derived.by(() => {
    let acc = 0;
    return s.series.map((x) => {
      const len = s.total ? (x.total / s.total) * C : 0;
      const seg = { ...x, dash: `${Math.max(0, len - 3)} ${C}`, offset: -acc };
      acc += len;
      return seg;
    });
  });
  const center = $derived(hoverS ? s.series.find((x) => x.id === hoverS) : null);

  // ----- stacked bars -----
  const W = 760, H = 250, X0 = 48, PW = 704, BASE = 226, PH = 210;
  const step = $derived.by(() => {
    const max = Math.max(...s.buckets.map((b) => b.total), HOUR);
    const st = [1, 2, 3, 4, 5, 10, 20, 25, 40, 50, 100, 200].map((h) => h * HOUR).find((x) => max / x <= 4.5) ?? 500 * HOUR;
    return { step: st, top: Math.ceil(max / st) * st };
  });
  const grid = $derived(Array.from({ length: Math.round(step.top / step.step) + 1 }, (_, i) => i * step.step));
  const slot = $derived(PW / s.buckets.length);
  const bw = $derived(Math.min(54, slot * 0.64));
  const bars = $derived(
    s.buckets.map((b, i) => {
      let y = BASE;
      const segs = s.series
        .filter((x) => b.parts.get(x.id))
        .map((x) => {
          const h = (b.parts.get(x.id)! / step.top) * PH;
          y -= h;
          return { id: x.id, y: y + 1, h: Math.max(0, h - 2), color: x.color };
        });
      const x = X0 + i * slot + (slot - bw) / 2;
      return { ...b, i, x, segs };
    })
  );
  const readout = $derived.by(() => {
    if (hoverB === null) return null;
    const b = s.buckets[hoverB];
    if (!b.total) return `${b.long} · nothing tracked`;
    const parts = s.series.filter((x) => b.parts.get(x.id)).map((x) => `${x.name} ${fmtDur(b.parts.get(x.id)!)}`);
    return `${b.long} · ${fmtDur(b.total)} — ${parts.join(' · ')}`;
  });

  // ----- hour of day -----
  const hourRange = $derived.by(() => {
    const idx = s.hourAvg.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    const lo = Math.min(7, ...idx);
    const hi = Math.max(19, ...idx);
    return Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  });
  const hourMax = $derived(Math.max(1, ...s.hourAvg));
  const peak = $derived.by(() => {
    const best = s.hourAvg.reduce((m, v, i) => (v > s.hourAvg[m] ? i : m), 0);
    return s.hourAvg[best] ? `Your most active hour is ${best}:00–${best + 1}:00, about ${fmtDur(s.hourAvg[best])} on an active day.` : '';
  });

  const estMax = $derived(Math.max(1, ...s.estimateRows.map((r) => Math.max(r.actual, r.estimate))) * 1.06);

  // ----- words -----
  const unit = $derived(period === 'year' ? 'month' : 'day');
  const avg = $derived(s.total / Math.max(1, period === 'year' ? s.activeBuckets : s.activeDays));
  const review = $derived.by(() => {
    const lines: string[] = [];
    if (!s.total) return ['Nothing tracked in this period yet. Press play on a task and it will show up here.'];
    const top = s.series[0];
    lines.push(`${top.name} took ${pct(top.total / s.total)} of your time (${fmtHours(top.total)}).`);
    if (s.best?.total) lines.push(`Your biggest ${unit} was ${s.best.long}, with ${fmtDur(s.best.total)} tracked.`);
    if (s.prevTotal) {
      const d = s.total / s.prevTotal - 1;
      lines.push(`That's ${signedPct(d)} compared with the ${period === 'year' ? 'previous year' : `previous ${period}`} (${fmtHours(s.prevTotal)}).`);
    }
    if (s.done.length) lines.push(`You finished ${s.done.length} task${s.done.length === 1 ? '' : 's'}.` + (s.accuracy !== null ? ` On average they took ${signedPct(s.accuracy)} versus your estimates.` : ''));
    if (s.series.length > 1) {
      const low = s.series[s.series.length - 1];
      if (low.id !== OTHER.id) lines.push(`${low.name} got the least attention (${fmtHours(low.total)}).`);
    }
    return lines;
  });

  const title = $derived(period === 'week' ? (offset === 0 ? 'This week' : offset === -1 ? 'Last week' : 'Week') : period === 'month' ? (offset === 0 ? 'This month' : 'Month') : offset === 0 ? 'This year' : 'Year');

  function setPeriod(p: Period) {
    period = p;
    offset = 0;
    hoverB = null;
    hoverS = null;
  }

  async function exportCsv() {
    const rows = [['date', 'start', 'end', 'minutes', 'project', 'task']];
    for (const e of [...db.entries].filter((x) => x.end).sort((a, b) => a.start - b.start)) {
      const t = db.tasks.find((x) => x.id === e.taskId);
      const p = db.projects.find((x) => x.id === e.projectId);
      const d = new Date(e.start);
      const iso = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
      rows.push([iso(e.start).slice(0, 10), iso(e.start).slice(11), iso(e.end!).slice(11), String(Math.round((e.end! - e.start) / 60000)), p?.name ?? '', t?.title ?? '']);
      void d;
    }
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    const where = await exportFile(`tempo-time-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(`Saved to ${where}`);
  }
</script>

<div class="page">
  <header>
    <div>
      <span class="muted small">{title} · {s.range.label}</span>
      <h1 class="display">Where your time went</h1>
    </div>
    <div class="tools">
      <div class="seg">
        {#each [['week', 'Week'], ['month', 'Month'], ['year', 'Year']] as [id, name]}
          <button class:on={period === id} onclick={() => setPeriod(id as Period)}>{name}</button>
        {/each}
      </div>
      <button class="btn square" aria-label="Previous" onclick={() => offset--}><Icon name="left" /></button>
      <button class="btn" disabled={offset === 0} onclick={() => (offset = 0)}>Now</button>
      <button class="btn square" aria-label="Next" disabled={offset >= 0} onclick={() => offset++}><Icon name="right" /></button>
    </div>
  </header>

  <div class="kpis">
    <div class="kpi"><span class="kl">Total tracked</span><span class="kv display num">{fmtHours(s.total)}</span><span class="kn">{s.prevTotal ? `${signedPct(s.total / s.prevTotal - 1)} vs previous ${period}` : `across ${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`}</span></div>
    <div class="kpi"><span class="kl">Average per active {unit}</span><span class="kv display num">{fmtDur(avg)}</span><span class="kn">{period === 'year' ? `${s.activeBuckets} active month${s.activeBuckets === 1 ? '' : 's'}` : `${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`}</span></div>
    <div class="kpi"><span class="kl">Tasks completed</span><span class="kv display num">{s.done.length}</span><span class="kn">{s.done.filter((t) => t.priority === 1).length} high priority</span></div>
    <div class="kpi"><span class="kl">Estimate accuracy</span><span class="kv display num">{signedPct(s.accuracy)}</span><span class="kn">{s.accuracy === null ? 'finish tasks with estimates to see this' : s.accuracy > 0.05 ? 'you take longer than planned' : s.accuracy < -0.05 ? 'you finish faster than planned' : 'spot on'}</span></div>
  </div>

  {#if !s.total}
    <div class="card empty">
      <Mascot kind="owl" color="var(--ink-3)" size={40} />
      <p>No time tracked in this period yet. Press play on a task and it will show up here.</p>
    </div>
  {:else}
    <div class="row">
      <section class="card donut-card">
        <h2>Time per project</h2>
        <svg viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Doughnut chart of time per project: {s.series.map((x) => `${x.name} ${pct(x.total / s.total)}`).join(', ')}">
          {#each donut as d (d.id)}
            <circle
              cx="110" cy="110" r={R} fill="none" stroke={d.color}
              stroke-width={hoverS === d.id ? 34 : 26}
              stroke-dasharray={d.dash} stroke-dashoffset={d.offset}
              transform="rotate(-90 110 110)"
              opacity={hoverS && hoverS !== d.id ? 0.3 : 1}
              class="seg-arc"
              role="presentation"
              onmouseenter={() => (hoverS = d.id)}
              onmouseleave={() => (hoverS = null)}
            />
          {/each}
          <text x="110" y="103" text-anchor="middle" class="c-label">{center ? center.name : 'Total'}</text>
          <text x="110" y="131" text-anchor="middle" class="c-value display">{fmtHours(center ? center.total : s.total)}</text>
          {#if center}<text x="110" y="150" text-anchor="middle" class="c-label">{pct(center.total / s.total)}</text>{/if}
        </svg>
        <div class="legend">
          {#each s.series as x (x.id)}
            <div class="li" class:hl={hoverS === x.id} role="presentation" onmouseenter={() => (hoverS = x.id)} onmouseleave={() => (hoverS = null)}>
              {#if x.mascot}<Mascot kind={x.mascot} color={x.color} size={18} />{:else}<span class="sw" style:background={x.color}></span>{/if}
              <span class="ln">{x.name}{x.members ? ` (${x.members.length})` : ''}</span>
              <span class="num">{fmtHours(x.total)}</span>
              <span class="num muted lp">{pct(x.total / s.total)}</span>
            </div>
          {/each}
        </div>
      </section>

      <section class="card bars-card">
        <div class="bh">
          <h2>{period === 'year' ? 'Hours per month' : 'Hours per day'}</h2>
          <div class="keys">{#each s.series as x (x.id)}<span><span class="sw" style:background={x.color}></span>{x.name}</span>{/each}</div>
        </div>
        <div class="readout num">{readout ?? 'Hover a bar to see the split.'}</div>
        <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="{period === 'year' ? 'Hours per month' : 'Hours per day'}, stacked by project">
          {#each grid as g}
            {@const y = BASE - (g / step.top) * PH}
            <line x1={X0 - 4} x2={W - 4} y1={y} y2={y} stroke={g === 0 ? '#C9CED6' : '#EEF0F3'} />
            <text x={X0 - 10} y={y + 4} text-anchor="end" class="ax">{g / HOUR}h</text>
          {/each}
          {#each bars as b (b.i + period + offset)}
            <g opacity={hoverB !== null && hoverB !== b.i ? 0.4 : 1}>
              {#each b.segs as sg (sg.id)}
                <rect class="grow" x={b.x} y={sg.y} width={bw} height={sg.h} rx="3" fill={hoverS && hoverS !== sg.id ? '#D9DDE3' : sg.color} />
              {/each}
              {#if b.label}<text x={b.x + bw / 2} y={H - 6} text-anchor="middle" class="ax" class:future={b.future}>{b.label}</text>{/if}
              <rect x={X0 + b.i * slot} y="0" width={slot} height={BASE} fill="transparent" role="presentation" onmouseenter={() => (hoverB = b.i)} onmouseleave={() => (hoverB = null)} />
            </g>
          {/each}
        </svg>
      </section>
    </div>

    <div class="row">
      <section class="card est-card">
        <div class="bh">
          <h2>Estimated vs actual</h2>
          <div class="keys"><span><span class="sw" style:background="var(--ink-2)"></span>Actual</span><span><span class="tick-key"></span>Estimate</span></div>
        </div>
        {#if !s.estimateRows.length}<p class="muted small">Give tasks a time estimate to compare it with reality here.</p>{/if}
        {#each s.estimateRows as r (r.task.id)}
          <div class="er">
            <span class="en"><span class="dot" style:background={r.project?.color}></span><span class="et">{r.task.title}</span></span>
            <span class="track">
              <span class="fill" style:width="{(r.actual / estMax) * 100}%" style:background={r.project?.color}></span>
              <span class="mark" style:left="{(r.estimate / estMax) * 100}%"></span>
            </span>
            <span class="num small ev" class:over={r.actual > r.estimate}>{fmtDur(r.actual)} / {fmtDur(r.estimate)}</span>
          </div>
        {/each}
      </section>

      <section class="card hours-card">
        <h2>When you work</h2>
        <svg viewBox="0 0 {hourRange.length * 22} 150" width="100%" role="img" aria-label="Average time tracked per hour of the day">
          {#each hourRange as h, i}
            {@const v = s.hourAvg[h]}
            {@const bh = (v / hourMax) * 118}
            <rect class="grow" x={i * 22 + 3} y={126 - bh} width="16" height={Math.max(0, bh)} rx="3" fill="var(--ink-2)" opacity={0.3 + 0.7 * (v / hourMax)}><title>{h}:00 · {fmtDur(v)} on average</title></rect>
            {#if h % 2 === 0}<text x={i * 22 + 11} y="146" text-anchor="middle" class="ax">{h}</text>{/if}
          {/each}
        </svg>
        <p class="small muted">{peak}</p>
      </section>
    </div>
  {/if}

  <div class="row">
    <section class="card table-card">
      <div class="bh">
        <h2>Projects</h2>
        <div class="tools">
          <button class="btn small ghost" onclick={() => (showTable = !showTable)}>{showTable ? 'Hide' : 'Show'} day-by-day table</button>
          <button class="btn small" onclick={exportCsv}><Icon name="download" size={13} />Export CSV</button>
        </div>
      </div>
      <div class="tscroll">
        <table>
          <thead><tr><th>Project</th><th>Time</th><th>Share</th><th>vs previous</th><th>Tasks done</th><th>Over estimate</th></tr></thead>
          <tbody>
            {#each s.table as r (r.project.id)}
              <tr>
                <td><span class="tp"><Mascot kind={r.project.mascot} color={r.project.color} size={16} />{r.project.name}{r.project.archived ? ' (archived)' : ''}</span></td>
                <td class="num">{fmtHours(r.ms)}</td>
                <td class="num">{pct(r.share)}</td>
                <td class="num">{r.delta === null ? (r.ms ? 'new' : '—') : signedPct(r.delta)}</td>
                <td class="num">{r.done}</td>
                <td class="num">{signedPct(r.over)}</td>
              </tr>
            {/each}
            {#if !s.table.length}<tr><td colspan="6" class="muted">Nothing yet for this period.</td></tr>{/if}
          </tbody>
        </table>
        {#if showTable}
          <table class="daily">
            <thead><tr><th>{period === 'year' ? 'Month' : 'Day'}</th>{#each s.series as x (x.id)}<th>{x.name}</th>{/each}<th>Total</th></tr></thead>
            <tbody>
              {#each s.buckets.filter((b) => !b.future) as b}
                <tr><td>{b.long}</td>{#each s.series as x (x.id)}<td class="num">{b.parts.get(x.id) ? fmtDur(b.parts.get(x.id)!) : '—'}</td>{/each}<td class="num strong">{b.total ? fmtDur(b.total) : '—'}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </section>

    <section class="card review">
      <div class="rh"><span class="rb"><Mascot kind={s.series[0]?.mascot || 'owl'} color="#8FB4E3" size={24} /></span><h2 class="display">{title} in review</h2></div>
      {#each review as line}<p>{line}</p>{/each}
    </section>
  </div>
</div>

<style>
  .page { padding: 26px 30px 40px; display: flex; flex-direction: column; gap: 16px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .small { font-size: 12px; }
  .tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .square { width: 38px; padding: 0; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .kpi { background: var(--surface); border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
  .kl { font-size: 12px; color: var(--ink-3); font-weight: 500; }
  .kv { font-size: 30px; font-weight: 700; }
  .kn { font-size: 12px; color: var(--ink-2); }
  .row { display: flex; gap: 14px; flex-wrap: wrap; }
  .card { display: flex; flex-direction: column; gap: 12px; }
  .empty { align-items: center; text-align: center; padding: 40px; color: var(--ink-2); }
  .donut-card { flex: 1 1 300px; align-items: stretch; }
  .donut-card svg { align-self: center; }
  .seg-arc { cursor: pointer; transition: stroke-width 0.2s, opacity 0.2s; }
  .c-label { font-size: 13px; fill: var(--ink-3); }
  .c-value { font-size: 28px; font-weight: 700; fill: var(--ink); }
  .legend { display: flex; flex-direction: column; gap: 2px; }
  .li { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; font-size: 13px; }
  .li.hl { background: var(--sunken); }
  .ln { flex: 1; font-weight: 500; }
  .lp { width: 40px; text-align: right; font-size: 12px; }
  .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; }
  .bars-card { flex: 999 1 500px; min-width: 0; }
  .bh { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .keys { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--ink-2); }
  .keys > span { display: inline-flex; align-items: center; gap: 6px; }
  .tick-key { width: 2px; height: 12px; background: var(--ink); display: inline-block; }
  .readout { font-size: 13px; color: var(--ink-2); min-height: 18px; }
  .ax { font-size: 11px; fill: var(--ink-3); }
  .ax.future { fill: #c3c8d0; }
  .est-card { flex: 999 1 440px; min-width: 0; }
  .er { display: grid; grid-template-columns: minmax(120px, 220px) minmax(0, 1fr) 136px; gap: 12px; align-items: center; }
  .en { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; }
  .et { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 8px; height: 8px; border-radius: 4px; flex: none; }
  .track { position: relative; height: 14px; border-radius: 4px; background: #f1f2f5; }
  .fill { position: absolute; left: 0; top: 0; height: 14px; border-radius: 4px; transition: width 0.6s var(--spring); }
  .mark { position: absolute; top: -3px; width: 2px; height: 20px; background: var(--ink); }
  .ev { text-align: right; color: var(--ink-2); white-space: nowrap; }
  .ev.over { color: #b42318; }
  .hours-card { flex: 1 1 280px; }
  .table-card { flex: 999 1 520px; min-width: 0; }
  .tscroll { overflow-x: auto; display: flex; flex-direction: column; gap: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 480px; }
  th { text-align: right; font-weight: 500; font-size: 12px; color: var(--ink-3); padding: 8px 6px; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 9px 6px; border-top: 1px solid #eef0f3; text-align: right; }
  .tp { display: inline-flex; align-items: center; gap: 8px; font-weight: 500; }
  .strong { font-weight: 600; }
  .daily td, .daily th { padding: 6px; font-size: 12px; }
  .review { flex: 1 1 300px; background: var(--ink); color: #fff; }
  .rh { display: flex; align-items: center; gap: 10px; }
  .rh h2 { font-size: 18px; font-weight: 700; }
  .rb { width: 34px; height: 34px; border-radius: 10px; background: #2b2f37; display: inline-flex; align-items: center; justify-content: center; }
  .review p { margin: 0; font-size: 13px; line-height: 1.55; color: #d9dce2; }
</style>
