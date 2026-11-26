import type { Data, Project } from './types';
import { addDays, addMonths, daysInMonth, overlap, startOfMonth, startOfWeek, MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, HOUR, startOfDay, fmtDayShort } from './time';

export type Period = 'week' | 'month' | 'year';
export const MAX_SERIES = 7;
export const OTHER = { id: '__other', name: 'Other', color: '#8A909C', mascot: '' };

export interface Range {
  from: number;
  to: number;
  label: string;
  buckets: { from: number; to: number; label: string; long: string }[];
  bucketUnit: 'day' | 'month';
}

export function periodRange(period: Period, offset: number, now: number): Range {
  const buckets: Range['buckets'] = [];
  if (period === 'week') {
    const s = addDays(startOfWeek(now), offset * 7);
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i);
      buckets.push({ from: d.getTime(), to: addDays(d, 1).getTime(), label: `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`, long: fmtDayShort(d) });
    }
    const e = addDays(s, 6);
    const same = s.getMonth() === e.getMonth();
    const label = `${s.getDate()}${same ? '' : ' ' + MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
    return { from: s.getTime(), to: addDays(s, 7).getTime(), label, buckets, bucketUnit: 'day' };
  }
  if (period === 'month') {
    const s = addMonths(startOfMonth(now), offset);
    const n = daysInMonth(s);
    for (let i = 0; i < n; i++) {
      const d = addDays(s, i);
      buckets.push({ from: d.getTime(), to: addDays(d, 1).getTime(), label: i % 5 === 0 ? String(i + 1) : '', long: fmtDayShort(d) });
    }
    return { from: s.getTime(), to: addMonths(s, 1).getTime(), label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}`, buckets, bucketUnit: 'day' };
  }
  const y = new Date(now).getFullYear() + offset;
  for (let m = 0; m < 12; m++) {
    const d = new Date(y, m, 1);
    buckets.push({ from: d.getTime(), to: new Date(y, m + 1, 1).getTime(), label: MONTHS_SHORT[m], long: `${MONTHS[m]} ${y}` });
  }
  return { from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), label: String(y), buckets, bucketUnit: 'month' };
}

export interface Series {
  id: string;
  name: string;
  color: string;
  mascot: string;
  total: number;
  members?: Project[];
}

export function summarize(db: Data, period: Period, offset: number, now: number) {
  const range = periodRange(period, offset, now);
  const prev = periodRange(period, offset - 1, now);
  const entries = db.entries.filter((e) => e.start < range.to && (e.end ?? now) > range.from);

  // Totals per project in this and the previous period.
  const perProject = new Map<string, number>();
  for (const e of entries) {
    const ms = overlap(e.start, e.end ?? now, range.from, range.to);
    perProject.set(e.projectId, (perProject.get(e.projectId) ?? 0) + ms);
  }
  const prevPerProject = new Map<string, number>();
  for (const e of db.entries) {
    const ms = overlap(e.start, e.end ?? now, prev.from, prev.to);
    if (ms) prevPerProject.set(e.projectId, (prevPerProject.get(e.projectId) ?? 0) + ms);
  }
  const total = [...perProject.values()].reduce((a, b) => a + b, 0);
  const prevTotal = [...prevPerProject.values()].reduce((a, b) => a + b, 0);

  // Series: the biggest projects keep their colour, the rest fold into "Other".
  const ranked = db.projects
    .map((p) => ({ p, ms: perProject.get(p.id) ?? 0 }))
    .filter((x) => x.ms > 0)
    .sort((a, b) => b.ms - a.ms);
  const shown = ranked.length > MAX_SERIES ? ranked.slice(0, MAX_SERIES - 1) : ranked;
  const folded = ranked.length > MAX_SERIES ? ranked.slice(MAX_SERIES - 1) : [];
  const series: Series[] = shown.map(({ p, ms }) => ({ id: p.id, name: p.name, color: p.color, mascot: p.mascot, total: ms }));
  if (folded.length) series.push({ ...OTHER, total: folded.reduce((a, b) => a + b.ms, 0), members: folded.map((f) => f.p) });
  const seriesOf = (projectId: string) => (shown.some((s) => s.p.id === projectId) ? projectId : OTHER.id);

  // Stacked buckets.
  const buckets = range.buckets.map((b) => {
    const parts = new Map<string, number>();
    for (const e of entries) {
      const ms = overlap(e.start, e.end ?? now, b.from, b.to);
      if (ms) parts.set(seriesOf(e.projectId), (parts.get(seriesOf(e.projectId)) ?? 0) + ms);
    }
    const sum = [...parts.values()].reduce((a, c) => a + c, 0);
    return { ...b, parts, total: sum, future: b.from > now };
  });

  // Hour of day (average minutes per active day).
  const hours = new Array(24).fill(0);
  const activeDays = new Set<number>();
  for (const e of entries) {
    let t = Math.max(e.start, range.from);
    const end = Math.min(e.end ?? now, range.to);
    while (t < end) {
      const hStart = new Date(t);
      hStart.setMinutes(0, 0, 0);
      const hEnd = hStart.getTime() + HOUR;
      const ms = Math.min(end, hEnd) - t;
      hours[hStart.getHours()] += ms;
      activeDays.add(startOfDay(t).getTime());
      t = hEnd;
    }
  }
  const nDays = Math.max(1, activeDays.size);
  const hourAvg = hours.map((ms) => ms / nDays);

  // Tasks completed, estimates.
  const done = db.tasks.filter((t) => t.completedAt && t.completedAt >= range.from && t.completedAt < range.to);
  const taskTotal = (id: string) => db.entries.filter((e) => e.taskId === id).reduce((a, e) => a + ((e.end ?? now) - e.start), 0);
  const estimated = done.filter((t) => t.estimate > 0);
  const estSum = estimated.reduce((a, t) => a + t.estimate * 60000, 0);
  const actSum = estimated.reduce((a, t) => a + taskTotal(t.id), 0);
  const accuracy = estSum ? actSum / estSum - 1 : null;

  const touchedTaskIds = new Set(entries.map((e) => e.taskId));
  const estimateRows = db.tasks
    .filter((t) => t.estimate > 0 && touchedTaskIds.has(t.id))
    .map((t) => ({ task: t, project: db.projects.find((p) => p.id === t.projectId), actual: taskTotal(t.id), estimate: t.estimate * 60000 }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 8);

  // Per-project table (every project with time in either period or done tasks).
  const table = db.projects
    .map((p) => {
      const ms = perProject.get(p.id) ?? 0;
      const before = prevPerProject.get(p.id) ?? 0;
      const pDone = done.filter((t) => t.projectId === p.id);
      const pEst = pDone.filter((t) => t.estimate > 0);
      const e = pEst.reduce((a, t) => a + t.estimate * 60000, 0);
      const a = pEst.reduce((x, t) => x + taskTotal(t.id), 0);
      return { project: p, ms, share: total ? ms / total : 0, delta: before ? ms / before - 1 : null, done: pDone.length, over: e ? a / e - 1 : null };
    })
    .filter((r) => r.ms > 0 || r.done > 0)
    .sort((a, b) => b.ms - a.ms);

  const best = buckets.reduce((m, b) => (b.total > m.total ? b : m), buckets[0]);
  const activeBuckets = buckets.filter((b) => b.total > 0).length;

  return { range, prev, total, prevTotal, series, buckets, hourAvg, activeDays: activeDays.size, done, accuracy, estimateRows, table, best, activeBuckets };
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function signedPct(x: number | null): string {
  if (x === null || !isFinite(x)) return '—';
  const v = Math.round(x * 100);
  return v === 0 ? '±0%' : (v > 0 ? '+' : '−') + Math.abs(v) + '%';
}
