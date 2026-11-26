import { db, ui, clock, taskById, projectById, toast } from './store.svelte';
import type { TimerMode } from './types';
import { MIN, dayKey, addDays, fmtClock, startOfDay, uid } from './time';
import { setTray, onTray, idleSeconds, notify, warmUpNotifications } from './native';
import { t as tr, tp } from './i18n.svelte';

export const running = () => db.entries.find((e) => e.end === null) ?? null;

/** Everything the timer widgets need, derived from the stored state. */
export function timerView(now: number) {
  const t = db.timer;
  const entry = running();
  const task = taskById(t.taskId);
  const project = task ? projectById(task.projectId) : null;
  const work = db.settings.pomodoroWork * MIN;
  const session = entry ? now - entry.start : 0;
  let display = 0;
  let progress = 0;
  let label = tr('No timer running');

  if (t.phase === 'break' && t.breakStart) {
    const len = t.breakLength * MIN;
    const left = Math.max(0, t.breakStart + len - now);
    display = left;
    progress = 1 - left / len;
    label = tr(t.breakLength >= db.settings.pomodoroLong ? 'Long break' : 'Short break');
  } else if (t.mode === 'pomodoro' && (t.phase === 'work' || t.phase === 'paused')) {
    const done = t.pomoWorked + session;
    display = Math.max(0, work - done);
    progress = Math.min(1, done / work);
    label = tr(t.phase === 'paused' ? 'Paused · {i} of {n}' : 'Focus · {i} of {n}', { i: (t.pomoDone % db.settings.pomodoroLongEvery) + 1, n: db.settings.pomodoroLongEvery });
  } else if (t.phase === 'work' || t.phase === 'paused') {
    display = session;
    progress = (session % (60 * MIN)) / (60 * MIN);
    label = tr(t.phase === 'paused' ? 'Paused' : 'Tracking');
  }
  return {
    phase: t.phase,
    mode: t.mode,
    entry,
    task,
    project,
    display,
    progress,
    label,
    isRunning: t.phase === 'work' && !!entry,
    clock: fmtClock(display)
  };
}

// ---------- actions ----------

function closeOpen(now: number) {
  const e = running();
  if (!e) return;
  e.end = now;
  // Drop accidental clicks under 5 seconds.
  if (e.end - e.start < 5000) db.entries = db.entries.filter((x) => x !== e);
}

export function start(taskId: string) {
  const now = Date.now();
  const task = taskById(taskId);
  if (!task) return;
  const t = db.timer;
  const cur = running();
  if (cur && cur.taskId === taskId) return;
  if (cur && t.mode === 'pomodoro') t.pomoWorked += now - cur.start;
  closeOpen(now);
  if (t.phase === 'break' || t.phase === 'idle') t.pomoWorked = 0;
  db.entries.push({ id: uid(), taskId, projectId: task.projectId, start: now, end: null, kind: t.mode });
  t.taskId = taskId;
  t.phase = 'work';
  t.breakStart = null;
  if (task.column === 'todo' || task.column === 'week') task.column = 'doing';
  warmUpNotifications();
}

export function pause() {
  const now = Date.now();
  const cur = running();
  if (cur && db.timer.mode === 'pomodoro') db.timer.pomoWorked += now - cur.start;
  closeOpen(now);
  if (db.timer.taskId) db.timer.phase = 'paused';
}

export function resume() {
  if (db.timer.taskId) start(db.timer.taskId);
}

export function toggle(taskId?: string) {
  if (taskId && taskId !== db.timer.taskId) return start(taskId);
  if (db.timer.phase === 'work') pause();
  else if (db.timer.taskId) resume();
}

export function stop() {
  closeOpen(Date.now());
  Object.assign(db.timer, { phase: 'idle', pomoWorked: 0, breakStart: null });
}

export function skipBreak() {
  if (db.timer.phase !== 'break') return;
  db.timer.breakStart = null;
  db.timer.phase = db.timer.taskId ? 'paused' : 'idle';
}

export function setMode(mode: TimerMode) {
  if (db.timer.mode === mode) return;
  const wasRunning = db.timer.phase === 'work';
  const taskId = db.timer.taskId;
  if (wasRunning) closeOpen(Date.now());
  if (db.timer.phase === 'break') db.timer.phase = taskId ? 'paused' : 'idle';
  db.timer.mode = mode;
  db.timer.pomoWorked = 0;
  db.timer.pomoDone = 0;
  if (wasRunning && taskId) {
    db.timer.phase = 'idle';
    start(taskId);
  }
}

// ---------- the clock ----------

let idleSince: number | null = null;
let tick = 0;

function checkPomodoro(now: number) {
  const t = db.timer;
  const s = db.settings;
  if (t.mode === 'pomodoro' && t.phase === 'work') {
    const cur = running();
    const done = t.pomoWorked + (cur ? now - cur.start : 0);
    if (done >= s.pomodoroWork * MIN) {
      closeOpen(now);
      t.pomoDone += 1;
      t.pomoWorked = 0;
      const long = t.pomoDone % s.pomodoroLongEvery === 0;
      t.breakLength = long ? s.pomodoroLong : s.pomodoroShort;
      t.breakStart = now;
      t.phase = 'break';
      notify(tr('Focus block done'), tr('{i} of {n} complete. Time for a {m}-minute break.', { i: t.pomoDone % s.pomodoroLongEvery || s.pomodoroLongEvery, n: s.pomodoroLongEvery, m: t.breakLength }));
    }
  }
  if (t.phase === 'break' && t.breakStart && now >= t.breakStart + t.breakLength * MIN) {
    t.phase = t.taskId ? 'paused' : 'idle';
    t.breakStart = null;
    const task = taskById(t.taskId);
    notify(tr('Break is over'), task ? tr('Ready for the next focus block on “{task}”?', { task: task.title }) : tr('Ready for the next focus block?'));
  }
}

async function checkIdle(now: number) {
  const mins = db.settings.idleMinutes;
  if (!mins || db.timer.phase !== 'work') {
    idleSince = null;
    return;
  }
  const idle = await idleSeconds();
  if (idleSince === null && idle >= mins * 60) {
    idleSince = now - idle * 1000;
    const task = taskById(db.timer.taskId);
    notify(tr('Still working?'), tr("You've been away for {m} minutes while timing “{task}”.", { m: Math.round(idle / 60), task: task?.title ?? tr('a task') }));
  } else if (idleSince !== null && idle < 10) {
    ui.idlePrompt = { since: idleSince, until: now - idle * 1000 };
    idleSince = null;
  }
}

/** Resolve the "you were away" question. */
export function resolveIdle(choice: 'keep' | 'remove' | 'stop') {
  const p = ui.idlePrompt;
  ui.idlePrompt = null;
  if (!p || choice === 'keep') return;
  const cur = running();
  if (!cur) return;
  const taskId = cur.taskId;
  if (cur.start >= p.since) {
    db.entries = db.entries.filter((e) => e !== cur);
  } else {
    cur.end = p.since;
  }
  if (choice === 'remove') {
    db.entries.push({ id: uid(), taskId, projectId: cur.projectId, start: p.until, end: null, kind: cur.kind });
  } else {
    Object.assign(db.timer, { phase: 'paused', pomoWorked: 0 });
  }
  toast(tr(choice === 'remove' ? 'Away time removed' : 'Away time removed and timer stopped'));
}

function checkDue(now: number) {
  if (!db.settings.dueReminders) return;
  const today = dayKey(now);
  if (db.meta.lastDueReminder === today || new Date(now).getHours() < 9) return;
  db.meta.lastDueReminder = today;
  const tomorrow = dayKey(addDays(startOfDay(now), 1));
  const open = db.tasks.filter((t) => t.column !== 'done' && t.due);
  const dueTomorrow = open.filter((t) => t.due === tomorrow);
  const overdue = open.filter((t) => t.due! < today);
  const dueToday = open.filter((t) => t.due === today);
  const parts: string[] = [];
  if (dueToday.length) parts.push(tp(dueToday.length, '{n} task due today', '{n} tasks due today'));
  if (dueTomorrow.length) parts.push(tp(dueTomorrow.length, '{n} task due tomorrow', '{n} tasks due tomorrow'));
  if (overdue.length) parts.push(tp(overdue.length, '{n} overdue task', '{n} overdue tasks'));
  if (!parts.length) return;
  const first = (dueToday[0] ?? dueTomorrow[0] ?? overdue[0]).title;
  notify(parts.join(', '), tr('Including “{task}”.', { task: first }));
}

function syncTray(now: number) {
  const v = timerView(now);
  let title = '';
  if (v.phase === 'work') title = v.clock;
  else if (v.phase === 'break') title = tr('Break') + ' ' + v.clock;
  else if (v.phase === 'paused') title = tr('Paused');
  setTray({
    title,
    color: v.phase === 'work' && v.project ? v.project.color : null,
    task: v.task ? `${v.project?.name ?? ''} · ${v.task.title}` : tr('No timer running'),
    toggle: tr(v.phase === 'work' ? 'Pause' : v.task ? 'Resume' : 'Start'),
    stop: tr('Stop & save'),
    open: tr('Open Tempo'),
    quit: tr('Quit Tempo'),
    canStop: v.phase === 'work' || v.phase === 'paused'
  });
}

export function startClock() {
  onTray((action) => {
    if (action === 'toggle') {
      if (db.timer.taskId) toggle();
      else {
        const t = db.tasks.find((x) => x.column === 'doing') ?? db.tasks.find((x) => x.column !== 'done');
        if (t) start(t.id);
      }
    } else if (action === 'stop') stop();
  });
  const step = () => {
    const now = Date.now();
    clock.now = now;
    checkPomodoro(now);
    syncTray(now);
    tick++;
    if (tick % 15 === 0) checkIdle(now);
    if (tick % 60 === 1) checkDue(now);
  };
  step();
  setInterval(step, 1000);
}
