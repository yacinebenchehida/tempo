<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Subtask, Task } from '../lib/types';
  import { db, clock, subtaskTime, deleteSubtask, toast } from '../lib/store.svelte';
  import { toggle, pause } from '../lib/timer.svelte';
  import { fmtDur, fmtDue } from '../lib/time';
  import { t } from '../lib/i18n.svelte';
  import Icon from './Icon.svelte';

  let { task, sub }: { task: Task; sub: Subtask } = $props();
  let open = $state(false);

  const isCurrent = $derived(db.timer.taskId === task.id && db.timer.subtaskId === sub.id && db.timer.phase !== 'idle');
  const isRunning = $derived(isCurrent && db.timer.phase === 'work');
  const spent = $derived(subtaskTime(task.id, sub.id, clock.now));
  const est = $derived(sub.estimate ?? 0);
  const due = $derived(sub.due ? fmtDue(sub.due, clock.now) : null);
  const estH = $derived(Math.floor(est / 60));
  const estM = $derived(est % 60);

  function setEstimate(h: number, m: number) {
    sub.estimate = Math.max(0, Math.round((h || 0) * 60 + (m || 0)));
  }
  function check() {
    sub.done = !sub.done;
    if (sub.done && isRunning) {
      pause();
      toast(t('Timer paused'));
    }
  }
</script>

<li class:current={isCurrent}>
  <div class="row">
    <button class="check" class:on={sub.done} onclick={check} aria-label={t(sub.done ? 'Mark not done' : 'Mark done')}>{#if sub.done}<Icon name="check" size={12} stroke={3} />{/if}</button>
    <input class="sub-input" class:done={sub.done} bind:value={sub.title} aria-label={t('Subtask')} />
    {#if spent || est}
      <span class="time num" class:over={est > 0 && spent > est * 60000}>{fmtDur(spent)}{est ? ` / ${fmtDur(est * 60000)}` : ''}</span>
    {/if}
    {#if due && !sub.done}<span class="due" class:overdue={due.overdue}>{due.text}</span>{/if}
    {#if !sub.done}
      <button class="play" class:on={isCurrent} onclick={() => toggle(task.id, sub.id)} aria-label={t(isRunning ? 'Pause timer' : 'Start timer')} title={t(isRunning ? 'Pause timer' : 'Start timer')}>
        <Icon name={isRunning ? 'pause' : 'play'} size={10} />
      </button>
    {/if}
    <button class="icon-btn more" class:on={open} onclick={() => (open = !open)} aria-label={t('Due date and estimate')} title={t('Due date and estimate')} aria-expanded={open}><Icon name="clock" size={14} /></button>
    <button class="icon-btn del" aria-label={t('Delete subtask')} onclick={() => deleteSubtask(task, sub.id)}><Icon name="x" size={13} /></button>
  </div>
  {#if open}
    <div class="details" transition:slide={{ duration: 160 }}>
      <label class="field"><span>{t('Due date')}</span>
        <div class="inline">
          <input class="input" type="date" value={sub.due ?? ''} onchange={(e) => (sub.due = (e.currentTarget as HTMLInputElement).value || null)} />
          {#if sub.due}<button class="icon-btn" aria-label={t('Clear due date')} onclick={() => (sub.due = null)}><Icon name="x" size={13} /></button>{/if}
        </div>
      </label>
      <div class="field"><span>{t('Time estimate')}</span>
        <div class="inline">
          <input class="input num small" type="number" min="0" value={estH} oninput={(e) => setEstimate(+(e.currentTarget as HTMLInputElement).value, estM)} aria-label={t('Hours')} /><span class="muted">{t('h')}</span>
          <input class="input num small" type="number" min="0" max="59" step="5" value={estM} oninput={(e) => setEstimate(estH, +(e.currentTarget as HTMLInputElement).value)} aria-label={t('Minutes')} /><span class="muted">{t('m')}</span>
        </div>
      </div>
    </div>
  {/if}
</li>

<style>
  li { border-radius: 10px; padding: 2px 4px; margin: 0 -4px; transition: background 0.2s; }
  li.current { background: var(--c-soft); }
  .row { display: flex; align-items: center; gap: 7px; min-height: 34px; }
  .check { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--line-strong); background: var(--surface); display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 0; }
  .check.on { background: var(--c); border-color: var(--c); color: #fff; }
  .sub-input { flex: 1; min-width: 60px; border: 0; outline: none; background: transparent; font-size: 14px; padding: 4px 0; }
  .sub-input.done { text-decoration: line-through; color: var(--ink-3); }
  .time { font-size: 12px; color: var(--ink-2); white-space: nowrap; }
  .time.over { color: #b42318; }
  .due { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 6px; background: var(--sunken); white-space: nowrap; }
  .due.overdue { color: #b42318; }
  .play { width: 26px; height: 26px; border-radius: 13px; border: 0; background: var(--sunken); display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .play.on { background: var(--c); color: #fff; }
  .more, .del { width: 26px; height: 26px; color: var(--ink-3); }
  .del { opacity: 0; }
  .more { opacity: 0.5; }
  li:hover .del, li:hover .more, .more.on { opacity: 1; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 6px 0 10px 28px; }
  .inline { display: flex; align-items: center; gap: 5px; }
  .input.small { width: 58px; }
</style>
