import type { Column, Data, Level, Project, Task, TimeEntry } from './types';
import { PALETTE, MASCOT_KEYS } from './palette';
import { uid } from './time';
import { loadData, saveData } from './native';
import { t as tr } from './i18n.svelte';

export function emptyData(): Data {
  return {
    version: 1,
    projects: [],
    tasks: [],
    entries: [],
    settings: {
      pomodoroWork: 25,
      pomodoroShort: 5,
      pomodoroLong: 15,
      pomodoroLongEvery: 4,
      idleMinutes: 10,
      dueReminders: true,
      language: 'auto',
      hideDoneAfterDays: 14
    },
    timer: { mode: 'stopwatch', phase: 'idle', taskId: null, pomoWorked: 0, pomoDone: 0, breakStart: null, breakLength: 5 },
    meta: { lastDueReminder: null }
  };
}

export const db: Data = $state(emptyData());

export type View = 'board' | 'calendar' | 'summaries' | 'settings';

export const ui = $state({
  loaded: false,
  view: 'board' as View,
  filter: 'all' as string, // project id or 'all'
  openTaskId: null as string | null,
  projectEditor: null as string | null, // project id or 'new'
  entryEditor: null as null | { id: string | null; taskId: string | null; day: string },
  idlePrompt: null as null | { since: number; until: number },
  celebrate: null as null | { x: number; y: number; color: string; key: number },
  toast: null as null | { text: string; key: number },
  saveError: null as string | null
});

export const clock = $state({ now: Date.now() });

// ---------- loading & saving ----------

function migrate(raw: any): Data {
  const base = emptyData();
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    timer: { ...base.timer, ...(raw.timer ?? {}) },
    meta: { ...base.meta, ...(raw.meta ?? {}) }
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved = '';

export async function init() {
  try {
    const text = await loadData();
    if (text) Object.assign(db, migrate(JSON.parse(text)));
  } catch (e) {
    ui.saveError = tr('Could not read your data file: {e}', { e: String(e) });
  }
  lastSaved = JSON.stringify(db);
  ui.loaded = true;

  $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify(db);
      if (json === lastSaved) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => flush(json), 400);
    });
  });
  window.addEventListener('beforeunload', () => {
    const json = JSON.stringify(db);
    if (json !== lastSaved) saveData(json);
  });
}

async function flush(json: string) {
  try {
    await saveData(json);
    lastSaved = json;
    ui.saveError = null;
  } catch (e) {
    ui.saveError = tr('Saving failed: {e}', { e: String(e) });
  }
}

export function toast(text: string) {
  ui.toast = { text, key: Date.now() };
}

// ---------- lookups ----------

export const projectById = (id: string | null | undefined) => db.projects.find((p) => p.id === id);
export const taskById = (id: string | null | undefined) => db.tasks.find((t) => t.id === id);
export const activeProjects = () => db.projects.filter((p) => !p.archived).sort((a, b) => a.order - b.order);

// ---------- projects ----------

export function nextColor(): string {
  const used = new Set(db.projects.filter((p) => !p.archived).map((p) => p.color));
  return (PALETTE.find((c) => !used.has(c.hex)) ?? PALETTE[db.projects.length % PALETTE.length]).hex;
}

export function nextMascot(): string {
  const used = new Set(db.projects.map((p) => p.mascot));
  const free = MASCOT_KEYS.filter((k) => !used.has(k));
  const pool = free.length ? free : MASCOT_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createProject(fields: Pick<Project, 'name' | 'color' | 'mascot'>): Project {
  const p: Project = {
    id: uid(),
    archived: false,
    createdAt: Date.now(),
    order: Math.max(0, ...db.projects.map((x) => x.order)) + 1,
    ...fields
  };
  db.projects.push(p);
  return p;
}

export function updateProject(id: string, fields: Partial<Project>) {
  const p = projectById(id);
  if (p) Object.assign(p, fields);
}

export function deleteProject(id: string) {
  const taskIds = new Set(db.tasks.filter((t) => t.projectId === id).map((t) => t.id));
  if (db.timer.taskId && taskIds.has(db.timer.taskId)) {
    db.timer.phase = 'idle';
    db.timer.taskId = null;
  }
  db.entries = db.entries.filter((e) => e.projectId !== id);
  db.tasks = db.tasks.filter((t) => t.projectId !== id);
  db.projects = db.projects.filter((p) => p.id !== id);
  if (ui.filter === id) ui.filter = 'all';
}

// ---------- tasks ----------

export function createTask(projectId: string, column: Column, title: string, extra: Partial<Task> = {}): Task {
  const t: Task = {
    id: uid(),
    projectId,
    title: title.trim() || tr('Untitled task'),
    column,
    priority: 2 as Level,
    difficulty: 2 as Level,
    due: null,
    estimate: 0,
    subtasks: [],
    notes: '',
    order: Math.max(0, ...db.tasks.filter((x) => x.column === column).map((x) => x.order)) + 1,
    createdAt: Date.now(),
    completedAt: column === 'done' ? Date.now() : null,
    ...extra
  };
  db.tasks.push(t);
  return t;
}

export function updateTask(id: string, fields: Partial<Task>) {
  const t = taskById(id);
  if (!t) return;
  if (fields.column && fields.column !== t.column) {
    setColumn(t, fields.column);
    delete fields.column;
  }
  if (fields.projectId && fields.projectId !== t.projectId) {
    for (const e of db.entries) if (e.taskId === id) e.projectId = fields.projectId;
  }
  Object.assign(t, fields);
}

function setColumn(t: Task, column: Column) {
  t.column = column;
  t.completedAt = column === 'done' ? Date.now() : null;
}

/** Move a task to a column, placing it before `beforeId` (or at the end). */
export function moveTask(id: string, column: Column, beforeId: string | null) {
  const t = taskById(id);
  if (!t) return;
  const list = db.tasks.filter((x) => x.column === column && x.id !== id).sort((a, b) => a.order - b.order);
  const idx = beforeId ? list.findIndex((x) => x.id === beforeId) : -1;
  list.splice(idx < 0 ? list.length : idx, 0, t);
  list.forEach((x, i) => (x.order = i + 1));
  if (t.column !== column) setColumn(t, column);
}

export function deleteTask(id: string) {
  db.entries = db.entries.filter((e) => e.taskId !== id);
  db.tasks = db.tasks.filter((t) => t.id !== id);
  if (db.timer.taskId === id) {
    db.timer.phase = 'idle';
    db.timer.taskId = null;
  }
  if (ui.openTaskId === id) ui.openTaskId = null;
}

// ---------- time entries ----------

export function taskTime(taskId: string, now: number): number {
  let ms = 0;
  for (const e of db.entries) if (e.taskId === taskId) ms += (e.end ?? now) - e.start;
  return ms;
}

export function addEntry(taskId: string, start: number, end: number): TimeEntry | null {
  const t = taskById(taskId);
  if (!t || end <= start) return null;
  const e: TimeEntry = { id: uid(), taskId, projectId: t.projectId, start, end, kind: 'manual' };
  db.entries.push(e);
  return e;
}

export function updateEntry(id: string, fields: Partial<TimeEntry>) {
  const e = db.entries.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, fields);
  if (fields.taskId) {
    const t = taskById(fields.taskId);
    if (t) e.projectId = t.projectId;
  }
}

export function deleteEntry(id: string) {
  db.entries = db.entries.filter((e) => e.id !== id);
}
