<script lang="ts">
  import { db, ui, clock, taskTime } from '../lib/store.svelte';
  import { timerView, toggle, stop, setMode, skipBreak } from '../lib/timer.svelte';
  import { tint } from '../lib/palette';
  import { fmtDur } from '../lib/time';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';

  const tv = $derived(timerView(clock.now));
  const C = 2 * Math.PI * 32;
  const color = $derived(tv.phase === 'break' ? '#1E9E8A' : tv.project?.color ?? '#AEB4BE');
  const bg = $derived(tv.phase === 'break' ? '#1E2A26' : tv.project ? tint(tv.project.color, 0.13) : 'var(--sunken)');
  const total = $derived(tv.task ? taskTime(tv.task.id, clock.now) : 0);
</script>

<section class="timer" class:dark={tv.phase === 'break'} style:background={bg}>
  <div class="seg modes">
    <button class:on={db.timer.mode === 'stopwatch'} onclick={() => setMode('stopwatch')}>Stopwatch</button>
    <button class:on={db.timer.mode === 'pomodoro'} onclick={() => setMode('pomodoro')}>Pomodoro</button>
  </div>
  <div class="row">
    <svg width="72" height="72" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r="32" fill={tv.phase === 'break' ? '#26362F' : '#FFFFFF'} stroke={tv.phase === 'break' ? '#26362F' : '#FFFFFF'} stroke-width="6" />
      <g class:breathe={tv.isRunning || tv.phase === 'break'}>
        <circle cx="38" cy="38" r="32" fill="none" stroke={color} stroke-width="6" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - tv.progress)} transform="rotate(-90 38 38)" style="transition: stroke-dashoffset 1s linear" />
      </g>
    </svg>
    <div class="read">
      <span class="label">{tv.label}</span>
      <span class="clock display num">{tv.phase === 'idle' ? '00:00' : tv.clock}</span>
    </div>
  </div>
  {#if tv.task}
    <button class="task" onclick={() => (ui.openTaskId = tv.task!.id)}>
      {#if tv.project}<Mascot kind={tv.project.mascot} color={tv.phase === 'break' ? '#8FD3C3' : tv.project.color} size={16} />{/if}
      <span>{tv.task.title}</span>
    </button>
    <span class="total num">Total on this task: {fmtDur(total)}</span>
  {:else}
    <span class="hint">Press play on any task to start timing it.</span>
  {/if}
  {#if tv.phase === 'break'}
    <div class="actions"><button class="btn primary grow-1" onclick={skipBreak}><Icon name="skip" size={14} />Skip break</button></div>
  {:else if tv.task}
    <div class="actions">
      <button class="btn primary grow-1" onclick={() => toggle()}><Icon name={tv.isRunning ? 'pause' : 'play'} size={13} />{tv.isRunning ? 'Pause' : 'Resume'}</button>
      <button class="btn square" aria-label="Stop and save" title="Stop and save" onclick={stop} disabled={tv.phase === 'idle'}><Icon name="stop" size={13} /></button>
    </div>
  {/if}
</section>

<style>
  .timer { margin-top: auto; border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 11px; transition: background 0.8s ease; }
  .timer.dark { color: #fff; }
  .modes { width: 100%; border: 0; }
  .modes button { flex: 1; }
  .dark .modes { background: #2b3a34; }
  .dark .modes button { color: #c8d6d1; }
  .dark .modes button.on { background: #8fd3c3; color: #10201b; }
  .row { display: flex; align-items: center; gap: 12px; }
  .read { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .label { font-size: 12px; color: var(--ink-2); }
  .dark .label { color: #c8d6d1; }
  .clock { font-size: 27px; font-weight: 700; }
  .task { display: flex; align-items: flex-start; gap: 7px; border: 0; background: transparent; padding: 0; text-align: left; font-size: 13px; font-weight: 600; line-height: 1.35; }
  .task span:hover { text-decoration: underline; }
  .total, .hint { font-size: 12px; color: var(--ink-3); margin-top: -6px; }
  .hint { margin-top: 0; line-height: 1.4; }
  .dark .total { color: #c8d6d1; }
  .actions { display: flex; gap: 8px; }
  .grow-1 { flex: 1; min-height: 38px; }
  .square { width: 40px; padding: 0; min-height: 38px; }
  .square:disabled { opacity: 0.4; cursor: default; }
  .dark .btn.primary { background: #8fd3c3; color: #10201b; border-color: #8fd3c3; }
</style>
