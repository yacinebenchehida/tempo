// Bridges to the Mac app. In a plain browser (used for development and
// testing) each call falls back to something harmless.

import { t } from './i18n.svelte';

export const isApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

const LS_KEY = 'tempo-data';

export async function loadData(): Promise<string | null> {
  if (isApp) return call<string | null>('load_data');
  return localStorage.getItem(LS_KEY);
}

export async function saveData(json: string): Promise<void> {
  if (isApp) return call('save_data', { json });
  localStorage.setItem(LS_KEY, json);
}

export async function dataLocation(): Promise<string> {
  if (isApp) return call<string>('data_location');
  return t('Browser storage (development mode)');
}

export async function exportFile(name: string, contents: string): Promise<string> {
  if (isApp) return call<string>('export_file', { name, contents });
  const blob = new Blob([contents], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  return t('your Downloads folder');
}

export async function idleSeconds(): Promise<number> {
  if (isApp) return call<number>('idle_seconds');
  return 0;
}

export async function setTray(args: { title: string; color: string | null; task: string; toggle: string; stop: string; open: string; quit: string; canStop: boolean }) {
  if (!isApp) return;
  try {
    await call('set_tray', args);
  } catch {
    /* menu bar not ready yet */
  }
}

export async function onTray(handler: (action: string) => void) {
  if (!isApp) return;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<string>('tray', (e) => handler(e.payload));
}

let notifyReady: Promise<boolean> | null = null;

async function canNotify(): Promise<boolean> {
  if (!isApp) {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  }
  const n = await import('@tauri-apps/plugin-notification');
  if (await n.isPermissionGranted()) return true;
  return (await n.requestPermission()) === 'granted';
}

export async function notify(title: string, body: string) {
  try {
    notifyReady ??= canNotify();
    if (!(await notifyReady)) return;
    if (isApp) {
      const n = await import('@tauri-apps/plugin-notification');
      n.sendNotification({ title, body });
    } else {
      new Notification(title, { body });
    }
  } catch {
    /* notifications are a nicety; never break the app over them */
  }
}

export function warmUpNotifications() {
  notifyReady ??= canNotify();
}
