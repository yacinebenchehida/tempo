<script lang="ts">
  import { onMount } from 'svelte';
  import { db, toast } from '../lib/store.svelte';
  import { dataLocation, exportFile, notify, isApp } from '../lib/native';
  import { loadSample, hasSample, removeSample } from '../lib/sample';
  import Icon from './Icon.svelte';

  let location = $state('');
  onMount(async () => (location = await dataLocation()));

  const s = db.settings;

  async function backup() {
    const where = await exportFile(`tempo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2));
    toast(`Backup saved to ${where}`);
  }
</script>

<div class="page">
  <h1 class="display">Settings</h1>

  <section class="card">
    <h2>Pomodoro</h2>
    <div class="grid">
      <label class="field"><span>Focus length (minutes)</span><input class="input num" type="number" min="1" max="180" bind:value={s.pomodoroWork} /></label>
      <label class="field"><span>Short break</span><input class="input num" type="number" min="1" max="60" bind:value={s.pomodoroShort} /></label>
      <label class="field"><span>Long break</span><input class="input num" type="number" min="1" max="120" bind:value={s.pomodoroLong} /></label>
      <label class="field"><span>Long break after every</span><input class="input num" type="number" min="2" max="12" bind:value={s.pomodoroLongEvery} /></label>
    </div>
  </section>

  <section class="card">
    <h2>Timer and reminders</h2>
    <label class="field narrow"><span>Ask about away time after (minutes, 0 = never)</span><input class="input num" type="number" min="0" max="240" bind:value={s.idleMinutes} /></label>
    <label class="toggle"><input type="checkbox" bind:checked={s.dueReminders} /> Morning reminder of tasks due today, due tomorrow or overdue</label>
    <label class="field narrow"><span>Hide finished tasks from the board after (days)</span><input class="input num" type="number" min="1" max="365" bind:value={s.hideDoneAfterDays} /></label>
    <div><button class="btn small" onclick={() => notify('Tempo', 'Notifications are working.')}>Send a test notification</button></div>
    {#if !isApp}<p class="muted small">Running in a browser: the menu bar timer and away detection only work in the Mac app.</p>{/if}
  </section>

  <section class="card">
    <h2>Your data</h2>
    <p class="small">Everything is stored in one file on this Mac, with a daily backup of the last 30 days kept next to it.</p>
    <code>{location}</code>
    <div class="row">
      <button class="btn small" onclick={backup}><Icon name="download" size={13} />Save a backup copy to Downloads</button>
    </div>
    <div class="row">
      {#if hasSample()}
        <button class="btn small danger" onclick={() => { removeSample(); toast('Sample data removed'); }}>Remove sample data</button>
      {:else}
        <button class="btn small" onclick={() => { loadSample(); toast('Sample projects added'); }}>Add sample data to explore</button>
      {/if}
    </div>
  </section>
</div>

<style>
  .page { padding: 26px 30px 40px; display: flex; flex-direction: column; gap: 16px; max-width: 820px; }
  h1 { margin: 2px 0 6px; font-size: 34px; font-weight: 700; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .card { display: flex; flex-direction: column; gap: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .narrow { max-width: 360px; }
  .toggle { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .toggle input { width: 18px; height: 18px; accent-color: var(--ink); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .small { font-size: 12px; margin: 0; }
  code { font-size: 12px; background: var(--sunken); padding: 8px 10px; border-radius: 8px; user-select: text; -webkit-user-select: text; overflow-wrap: anywhere; }
</style>
