import { lang, t } from './i18n.svelte';

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const p2 = (n: number) => String(n).padStart(2, '0');

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const WEEKDAYS_SHORT_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

const fr = () => lang.code === 'fr';
export const months = () => (fr() ? MONTHS_FR : MONTHS_EN);
export const monthsShort = () => (fr() ? MONTHS_SHORT_FR : MONTHS_EN.map((m) => m.slice(0, 3)));
export const weekdays = () => (fr() ? WEEKDAYS_FR : WEEKDAYS_EN);
export const weekdaysShort = () => (fr() ? WEEKDAYS_SHORT_FR : WEEKDAYS_EN.map((d) => d.slice(0, 3)));
/** Short weekday names starting on Monday. */
export const weekHeader = () => {
  const w = weekdaysShort();
  return [...w.slice(1), w[0]];
};

export function dayKey(d: Date | number): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date | number, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date | number, n: number): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Monday of the week containing d. */
export function startOfWeek(d: Date | number): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

export function startOfMonth(d: Date | number): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function daysInMonth(d: Date | number): number {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
}

/** "2h 05m", "45m", "0m" */
export function fmtDur(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (fr()) return h ? `${h} h ${p2(r)}` : `${r} min`;
  return h ? `${h}h ${p2(r)}m` : `${r}m`;
}

/** Short form for big numbers: "142h" past 100 hours. */
export function fmtHours(ms: number): string {
  return ms >= 100 * HOUR ? `${Math.round(ms / HOUR)}${fr() ? ' h' : 'h'}` : fmtDur(ms);
}

/** "1:02:03" or "02:03" */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h ? `${h}:${p2(m)}:${p2(x)}` : `${p2(m)}:${p2(x)}`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fmtDayLong(d: Date | number): string {
  const x = new Date(d);
  return `${weekdays()[x.getDay()]} ${x.getDate()} ${months()[x.getMonth()]}`;
}

export function fmtDayShort(d: Date | number): string {
  const x = new Date(d);
  return `${weekdaysShort()[x.getDay()]} ${x.getDate()} ${monthsShort()[x.getMonth()]}`;
}

/** Friendly due date relative to today. */
export function fmtDue(key: string, now: number): { text: string; overdue: boolean; soon: boolean } {
  const d = parseDay(key).getTime();
  const today = startOfDay(now).getTime();
  const diff = Math.round((d - today) / DAY);
  if (diff === 0) return { text: t('Today'), overdue: false, soon: true };
  if (diff === 1) return { text: t('Tomorrow'), overdue: false, soon: true };
  if (diff === -1) return { text: t('Yesterday'), overdue: true, soon: false };
  if (diff < 0) return { text: fmtDayShort(d), overdue: true, soon: false };
  if (diff < 7) return { text: weekdays()[new Date(d).getDay()], overdue: false, soon: false };
  return { text: fmtDayShort(d), overdue: false, soon: false };
}

export function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** "HH:MM" from a timestamp, and back onto a given day. */
export function hhmm(ms: number): string {
  return fmtTime(ms);
}
export function atTime(day: string, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = parseDay(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
