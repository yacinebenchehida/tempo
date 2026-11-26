<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { ui, taskById } from '../lib/store.svelte';
  import { resolveIdle, running } from '../lib/timer.svelte';
  import { fmtDur, fmtTime } from '../lib/time';

  const p = ui.idlePrompt!;
  const task = taskById(running()?.taskId);
  const away = p.until - p.since;
</script>

<div class="scrim" transition:fade={{ duration: 150 }} role="presentation"></div>
<div class="modal" role="alertdialog" aria-modal="true" aria-label="You were away" transition:scale={{ start: 0.94, duration: 220 }}>
  <h2 class="display">You were away for {fmtDur(away)}</h2>
  <p>From {fmtTime(p.since)} to {fmtTime(p.until)}, while the timer was running{task ? ` on “${task.title}”` : ''}. What should happen to that time?</p>
  <div class="actions">
    <button class="btn primary" onclick={() => resolveIdle('remove')}>Remove it, keep timing</button>
    <button class="btn" onclick={() => resolveIdle('stop')}>Remove it and stop</button>
    <button class="btn ghost" onclick={() => resolveIdle('keep')}>Keep it, I was working</button>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(22, 24, 29, 0.3); z-index: 50; }
  .modal { position: fixed; left: 50%; top: 50%; translate: -50% -50%; width: min(460px, calc(100vw - 40px)); background: var(--surface); border-radius: 20px; box-shadow: var(--shadow-pop); z-index: 51; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; font-size: 22px; }
  p { margin: 0; color: var(--ink-2); line-height: 1.5; }
  .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
</style>
