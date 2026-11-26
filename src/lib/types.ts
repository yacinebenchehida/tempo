export type Column = 'todo' | 'week' | 'doing' | 'done';
export type Level = 1 | 2 | 3;
export type TimerMode = 'stopwatch' | 'pomodoro';

export interface Project {
  id: string;
  name: string;
  color: string;
  mascot: string;
  archived: boolean;
  createdAt: number;
  order: number;
  sample?: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  column: Column;
  priority: Level; // 1 = high
  difficulty: Level; // 3 = hard
  due: string | null; // YYYY-MM-DD
  estimate: number; // minutes, 0 = none
  subtasks: Subtask[];
  notes: string;
  order: number;
  createdAt: number;
  completedAt: number | null;
  sample?: boolean;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  projectId: string;
  start: number; // ms
  end: number | null; // null = running
  kind: 'stopwatch' | 'pomodoro' | 'manual';
  sample?: boolean;
}

export interface Settings {
  pomodoroWork: number;
  pomodoroShort: number;
  pomodoroLong: number;
  pomodoroLongEvery: number;
  idleMinutes: number; // 0 = off
  dueReminders: boolean;
  hideDoneAfterDays: number;
  language: 'auto' | 'en' | 'fr';
}

export interface TimerState {
  mode: TimerMode;
  phase: 'idle' | 'work' | 'paused' | 'break';
  taskId: string | null; // current or last task (for resume)
  pomoWorked: number; // ms worked in the current focus block before the open entry
  pomoDone: number; // completed focus blocks in this cycle
  breakStart: number | null;
  breakLength: number; // minutes
}

export interface Data {
  version: 1;
  projects: Project[];
  tasks: Task[];
  entries: TimeEntry[];
  settings: Settings;
  timer: TimerState;
  meta: { lastDueReminder: string | null };
}

export const COLUMNS: { id: Column; name: string }[] = [
  { id: 'todo', name: 'To do' },
  { id: 'week', name: 'This week' },
  { id: 'doing', name: 'In progress' },
  { id: 'done', name: 'Done' }
];
