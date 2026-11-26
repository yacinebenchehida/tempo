<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { db, ui, clock, projectById, addEntry, updateEntry, deleteEntry, toast } from '../lib/store.svelte';
  import { dayKey, atTime, hhmm, fmtDur, DAY } from '../lib/time';
  import { t } from '../lib/i18n.svelte';

  const ed = ui.entryEditor!;
  const existing = ed.id ? db.entries.find((e) => e.id === ed.id) : null;

  const defaultEnd = Math.floor(clock.now / 300000) * 300000;
  let taskId = $state(existing?.taskId ?? ed.taskId ?? '');
  let day = $state(existing ? dayKey(existing.start) : ed.day || dayKey(clock.now));
  let from = $state(existing ? hhmm(existing.start) : hhmm(defaultEnd - 3600000));
  let to = $state(existing?.end ? hhmm(existing.end) : hhmm(defaultEnd));

  const startMs = $derived(atTime(day, from));
  // An end time earlier than the start means the entry ran past midnight.
  const endMs = $derived.by(() => {
    const e = atTime(day, to);
    return e <= startMs ? e + DAY : e;
  });
  const valid = $derived(!!taskId && endMs > startMs && endMs - startMs < DAY);

  const tasks = $derived(
    db.tasks
      .filter((t) => !projectById(t.projectId)?.archived || t.id === taskId)
      .map((t) => ({ t, p: projectById(t.projectId) }))
      .sort((a, b) => (a.p?.name ?? '').localeCompare(b.p?.name ?? '') || a.t.title.localeCompare(b.t.title))
  );

  function save() {
    if (!valid) return;
    if (existing) {
      updateEntry(existing.id, { taskId, start: startMs, end: endMs });
      toast(t('Entry updated'));
    } else {
      addEntry(taskId, startMs, endMs);
      toast(t('Added {d}', { d: fmtDur(endMs - startMs) }));
    }
    ui.entryEditor = null;
  }
  function remove() {
    if (existing) deleteEntry(existing.id);
    ui.entryEditor = null;
  }
</script>

<div class="scrim" transition:fade={{ duration: 150 }} onclick={() => (ui.entryEditor = null)} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true" aria-label={t(existing ? 'Edit time' : 'Add time manually')} transition:scale={{ start: 0.94, duration: 200 }}>
  <h2 class="display">{t(existing ? 'Edit time' : 'Add time manually')}</h2>
  <label class="field"><span>{t('Task')}</span>
    <select class="input" bind:value={taskId}>
      <option value="" disabled>{t('Choose a task')}</option>
      {#each tasks as { t: tk, p } (tk.id)}<option value={tk.id}>{p?.name} · {tk.title}</option>{/each}
    </select>
  </label>
  <div class="row">
    <label class="field"><span>{t('Day')}</span><input class="input" type="date" bind:value={day} /></label>
    <label class="field"><span>{t('From')}</span><input class="input" type="time" bind:value={from} /></label>
    <label class="field"><span>{t('To')}</span><input class="input" type="time" bind:value={to} /></label>
  </div>
  <p class="sum">{valid ? fmtDur(endMs - startMs) : t('Pick a task and a time range')}</p>
  <div class="actions">
    {#if existing}<button class="btn small ghost danger" onclick={remove}>{t('Delete entry')}</button>{/if}
    <span class="spacer"></span>
    <button class="btn ghost" onclick={() => (ui.entryEditor = null)}>{t('Cancel')}</button>
    <button class="btn primary" onclick={save} disabled={!valid}>{t('Save')}</button>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(22, 24, 29, 0.25); z-index: 40; }
  .modal { position: fixed; left: 50%; top: 50%; translate: -50% -50%; width: min(460px, calc(100vw - 40px)); background: var(--surface); border-radius: 20px; box-shadow: var(--shadow-pop); z-index: 41; padding: 22px; display: flex; flex-direction: column; gap: 14px; }
  h2 { margin: 0; font-size: 22px; }
  .row { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; }
  .sum { margin: 0; font-size: 13px; color: var(--ink-2); font-weight: 600; }
  .actions { display: flex; gap: 8px; align-items: center; }
  .spacer { flex: 1; }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
