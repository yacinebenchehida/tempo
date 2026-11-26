<script lang="ts">
  import { onMount } from 'svelte';
  import { db, ui, clock, init } from './lib/store.svelte';
  import { startClock, timerView } from './lib/timer.svelte';
  import { tint } from './lib/palette';
  import { isApp } from './lib/native';
  import { lang, resolveLang } from './lib/i18n.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Board from './components/Board.svelte';
  import Calendar from './components/Calendar.svelte';
  import Summaries from './components/Summaries.svelte';
  import Settings from './components/Settings.svelte';
  import TaskDrawer from './components/TaskDrawer.svelte';
  import ProjectEditor from './components/ProjectEditor.svelte';
  import EntryEditor from './components/EntryEditor.svelte';
  import IdlePrompt from './components/IdlePrompt.svelte';
  import Celebrate from './components/Celebrate.svelte';
  import Toast from './components/Toast.svelte';

  onMount(async () => {
    await init();
    startClock();
  });

  $effect(() => {
    lang.code = resolveLang(db.settings.language);
    document.documentElement.lang = lang.code;
  });

  const tv = $derived(timerView(clock.now));
  const wash = $derived(tv.isRunning && tv.project ? tint(tv.project.color, 0.06) : 'var(--ground)');

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (ui.entryEditor) ui.entryEditor = null;
    else if (ui.projectEditor) ui.projectEditor = null;
    else if (ui.openTaskId) ui.openTaskId = null;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if ui.loaded}
  <div class="shell" class:app={isApp}>
    {#if isApp}<div class="drag" data-tauri-drag-region></div>{/if}
    <Sidebar />
    <main style:background={wash}>
      {#if ui.saveError}<div class="save-error">{ui.saveError}</div>{/if}
      {#if ui.view === 'board'}<Board />
      {:else if ui.view === 'calendar'}<Calendar />
      {:else if ui.view === 'summaries'}<Summaries />
      {:else}<Settings />{/if}
    </main>
  </div>
  {#if ui.openTaskId}<TaskDrawer />{/if}
  {#if ui.projectEditor}<ProjectEditor />{/if}
  {#if ui.entryEditor}<EntryEditor />{/if}
  {#if ui.idlePrompt}<IdlePrompt />{/if}
  <Celebrate />
  <Toast />
{/if}

<style>
  .shell { display: flex; height: 100%; position: relative; }
  .drag { position: fixed; top: 0; left: 0; right: 0; height: 28px; z-index: 5; }
  main { flex: 1; min-width: 0; overflow: auto; transition: background 0.8s ease; position: relative; }
  .app main { padding-top: 10px; }
  .save-error { margin: 12px 32px 0; padding: 10px 14px; border-radius: 10px; background: #fdecea; color: #8a1c12; font-size: 13px; }
</style>
