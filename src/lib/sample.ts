import { db } from './store.svelte';
import type { Column, Level, Project, Task, TimeEntry } from './types';
import { addDays, dayKey, startOfDay, uid, MIN, HOUR } from './time';
import { t } from './i18n.svelte';

/** A few weeks of made-up history so every screen has something to show. */
export function loadSample() {
  const now = Date.now();
  const today = startOfDay(now);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const projects: Project[] = [
    { id: uid(), name: 'Porpoise', color: '#2F6DB5', mascot: 'porpoise', archived: false, createdAt: now, order: 1, sample: true },
    { id: uid(), name: 'Virus', color: '#E0663F', mascot: 'hedgehog', archived: false, createdAt: now, order: 2, sample: true },
    { id: uid(), name: 'Pollagen', color: '#1E9E8A', mascot: 'bee', archived: false, createdAt: now, order: 3, sample: true }
  ];
  const [po, vi, pg] = projects;
  const d = (n: number) => dayKey(addDays(today, n));
  const spec: [Project, string, Column, Level, Level, number, number | null, number, number][] = [
    // project, title, column, priority, difficulty, estimate (min), due (days from today), subtasks, done subtasks
    [po, 'Annotate recordings, batch 4', 'doing', 1, 3, 720, 9, 10, 4],
    [vi, 'Run qPCR on new samples', 'doing', 1, 2, 240, 1, 5, 3],
    [pg, 'Clean the field dataset', 'week', 1, 2, 180, 2, 3, 1],
    [po, 'Literature review', 'week', 3, 2, 480, 14, 6, 2],
    [vi, 'Write methods section', 'todo', 2, 3, 360, 7, 4, 0],
    [pg, 'Plot seasonal curves', 'todo', 2, 2, 120, 5, 2, 0],
    [po, 'Fix audio import script', 'todo', 2, 1, 90, 6, 3, 0],
    [vi, 'Extract RNA', 'done', 2, 2, 180, -10, 3, 3],
    [pg, 'Count slides', 'done', 3, 1, 120, -6, 2, 2],
    [po, 'Annotate recordings, batch 3', 'done', 1, 3, 600, -5, 8, 8],
    [vi, 'Order primers', 'done', 3, 1, 30, -2, 2, 2],
    [pg, 'Prepare supervisor meeting', 'done', 2, 1, 60, -1, 3, 3],
    [po, 'Annotate recordings, batch 2', 'done', 1, 3, 600, -19, 8, 8],
    [po, 'Annotate recordings, batch 1', 'done', 1, 3, 540, -33, 8, 8],
    [po, 'Draft abstract', 'done', 2, 2, 240, -27, 3, 3],
    [po, 'Set up analysis pipeline', 'done', 2, 3, 720, -45, 5, 5],
    [vi, 'Plan experiment', 'done', 1, 2, 300, -24, 4, 4],
    [vi, 'Grow cultures', 'done', 2, 2, 420, -38, 3, 3],
    [vi, 'Back up raw data', 'done', 3, 1, 60, -15, 2, 2],
    [pg, 'Collect samples, site A', 'done', 1, 2, 480, -30, 4, 4],
    [pg, 'Collect samples, site B', 'done', 1, 2, 480, -16, 4, 4],
    [pg, 'Draft field report', 'done', 2, 2, 300, -48, 3, 3]
  ];
  const tasks: Task[] = spec.map(([p, title, column, priority, difficulty, estimate, due, nSub, nDone], i) => ({
    id: uid(),
    projectId: p.id,
    title: t(title),
    column,
    priority,
    difficulty,
    estimate,
    due: due === null ? null : d(due),
    subtasks: Array.from({ length: nSub }, (_, k) => ({ id: uid(), title: t('Step {n}', { n: k + 1 }), done: k < nDone })),
    notes: '',
    order: i,
    createdAt: now - 40 * 24 * HOUR,
    completedAt: column === 'done' ? addDays(today, (due ?? 0)).getTime() + 17 * HOUR : null,
    sample: true
  }));

  const budget = new Map(tasks.map((t) => [t.id, t.estimate * MIN * (t.column === 'done' ? 0.75 + rnd() * 0.6 : 0.3 + rnd() * 0.4)]));
  const entries: TimeEntry[] = [];
  for (let back = 0; back <= 60; back++) {
    const day = addDays(today, -back);
    const dow = day.getDay();
    if ((dow === 0 || dow === 6) && rnd() > 0.25) continue;
    let t = day.getTime() + 9 * HOUR + Math.round(rnd() * 40) * MIN;
    const blocks = 3 + Math.floor(rnd() * 3);
    for (let b = 0; b < blocks; b++) {
      // Work on tasks that are still open on that day and have budget left (roughly their estimate).
      const pool = tasks.filter(
        (x) => x.column !== 'todo' && (x.column === 'done' ? x.completedAt! > day.getTime() && x.completedAt! - day.getTime() < 21 * 24 * HOUR : back < 28) && (budget.get(x.id) ?? 0) > 0
      );
      if (!pool.length) break;
      const task = pool[Math.floor(rnd() * pool.length)];
      const len = Math.min(budget.get(task.id)!, (35 + Math.round(rnd() * 95)) * MIN);
      budget.set(task.id, budget.get(task.id)! - len);
      const end = Math.min(t + len, back === 0 ? now - 2 * MIN : Infinity);
      if (end <= t) break;
      entries.push({ id: uid(), taskId: task.id, projectId: task.projectId, start: t, end, kind: 'stopwatch', sample: true });
      t = end + (b === 1 ? 55 : 10 + Math.round(rnd() * 20)) * MIN;
      if (b === 1 && t < day.getTime() + 12 * HOUR) t = day.getTime() + 13 * HOUR + 30 * MIN;
    }
  }

  db.projects.push(...projects);
  db.tasks.push(...tasks);
  db.entries.push(...entries);
}

export function hasSample() {
  return db.projects.some((p) => p.sample);
}

export function removeSample() {
  const ids = new Set(db.projects.filter((p) => p.sample).map((p) => p.id));
  db.entries = db.entries.filter((e) => !ids.has(e.projectId));
  db.tasks = db.tasks.filter((t) => !ids.has(t.projectId));
  db.projects = db.projects.filter((p) => !ids.has(p.id));
  if (db.timer.taskId && !db.tasks.some((t) => t.id === db.timer.taskId)) Object.assign(db.timer, { phase: 'idle', taskId: null });
}
