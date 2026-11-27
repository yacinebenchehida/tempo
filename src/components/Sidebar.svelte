<script lang="ts">
  import { db, ui, clock, activeProjects } from '../lib/store.svelte';
  import { tint } from '../lib/palette';
  import { startOfWeek, overlap, fmtDur } from '../lib/time';
  import { isApp, isMac } from '../lib/native';
  import { timerView } from '../lib/timer.svelte';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';
  import TimerWidget from './TimerWidget.svelte';
  import { SOUNDS, player, togglePlay, anySelected } from '../lib/sound.svelte';
  import { t } from '../lib/i18n.svelte';

  const nav = [
    { id: 'board', name: 'Board', icon: 'board' },
    { id: 'calendar', name: 'Calendar', icon: 'calendar' },
    { id: 'summaries', name: 'Summaries', icon: 'chart' },
    { id: 'history', name: 'History', icon: 'history' },
    { id: 'sounds', name: 'Sounds', icon: 'sound' },
    { id: 'settings', name: 'Settings', icon: 'settings' }
  ] as const;

  const projects = $derived(activeProjects());
  const archivedCount = $derived(db.projects.filter((p) => p.archived).length);
  let showArchived = $state(false);

  const weekTime = $derived.by(() => {
    const from = startOfWeek(clock.now).getTime();
    const to = from + 7 * 86400000;
    const m = new Map<string, number>();
    for (const e of db.entries) {
      const ms = overlap(e.start, e.end ?? clock.now, from, to);
      if (ms) m.set(e.projectId, (m.get(e.projectId) ?? 0) + ms);
    }
    return m;
  });

  const tv = $derived(timerView(clock.now));

  function pick(id: string) {
    ui.filter = ui.filter === id ? 'all' : id;
    if (ui.view === 'settings' || ui.view === 'summaries') ui.view = 'board';
  }
</script>

<aside class:app={isApp && isMac}>
  <div class="logo">
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="10" fill="none" stroke="var(--line)" stroke-width="3.5" />
      <circle class:breathe={tv.isRunning} cx="13" cy="13" r="10" fill="none" stroke={tv.isRunning && tv.project ? tv.project.color : 'var(--ink)'} stroke-width="3.5" stroke-linecap="round" stroke-dasharray="44 63" transform="rotate(-90 13 13)" />
    </svg>
    <span class="display">Tempo</span>
  </div>

  <nav>
    {#each nav as n}
      <button class="nav" class:on={ui.view === n.id} onclick={() => (ui.view = n.id)}><Icon name={n.icon} size={18} stroke={1.8} />{t(n.name)}</button>
    {/each}
  </nav>

  <div class="projects">
    <div class="head"><span class="eyebrow">{t('Projects')}</span><span class="eyebrow muted">{t('this week')}</span></div>
    {#each projects as p (p.id)}
      <div class="proj" class:on={ui.filter === p.id}>
        <button class="pick" onclick={() => pick(p.id)} title={t('Show only {name}', { name: p.name })}>
          <span class="badge" style:background={tint(p.color, 0.14)}><Mascot kind={p.mascot} color={p.color} size={19} /></span>
          <span class="name">{p.name}</span>
          <span class="time num">{(weekTime.get(p.id) ?? 0) >= 60000 ? fmtDur(weekTime.get(p.id)!) : ''}</span>
        </button>
        <button class="icon-btn edit" aria-label={t('Edit {name}', { name: p.name })} onclick={() => (ui.projectEditor = p.id)}><Icon name="edit" size={14} /></button>
      </div>
    {/each}
    <button class="nav add" onclick={() => (ui.projectEditor = 'new')}><Icon name="plus" size={16} />{t('New project')}</button>
    {#if archivedCount}
      <button class="nav add" onclick={() => (showArchived = !showArchived)}><Icon name="archive" size={15} />{t(showArchived ? 'Hide archived ({n})' : 'Show archived ({n})', { n: archivedCount })}</button>
      {#if showArchived}
        {#each db.projects.filter((p) => p.archived) as p (p.id)}
          <button class="nav add" onclick={() => (ui.projectEditor = p.id)}><Mascot kind={p.mascot} color={p.color} size={16} />{p.name}</button>
        {/each}
      {/if}
    {/if}
  </div>

  {#if anySelected()}
    <div class="soundbar" class:on={player.playing}>
      <button class="sb-play" onclick={togglePlay} aria-label={t(player.playing ? 'Pause' : 'Play')}><Icon name={player.playing ? 'pause' : 'play'} size={11} /></button>
      <button class="sb-names" onclick={() => (ui.view = 'sounds')}>
        <Icon name="sound" size={13} />
        <span>{SOUNDS.filter((x) => db.sound.on[x.id]).map((x) => t(x.name)).join(' · ')}</span>
      </button>
    </div>
  {/if}

  <TimerWidget />
</aside>

<style>
  aside {
    width: 252px; flex: none; background: var(--surface); border-right: 1px solid var(--line);
    padding: 20px 14px 16px; display: flex; flex-direction: column; gap: 22px; overflow-y: auto;
  }
  aside.app { padding-top: 46px; }
  .logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; }
  .logo span { font-size: 22px; font-weight: 700; }
  nav { display: flex; flex-direction: column; gap: 2px; }
  .nav {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 0; background: transparent;
    font-size: 14px; color: var(--ink-2); text-align: left; width: 100%;
  }
  .nav:hover { background: var(--sunken); }
  .nav.on { background: #eef0f4; color: var(--ink); font-weight: 600; }
  .nav.add { font-size: 13px; color: var(--ink-3); }
  .projects { display: flex; flex-direction: column; gap: 2px; }
  .head { display: flex; justify-content: space-between; padding: 0 10px 6px; }
  .proj { display: flex; align-items: center; border-radius: 9px; }
  .proj:hover, .proj.on { background: var(--sunken); }
  .proj.on .name { font-weight: 600; }
  .pick { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px 4px 6px 8px; border: 0; background: transparent; text-align: left; }
  .badge { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .time { font-size: 12px; color: var(--ink-3); }
  .soundbar { margin-top: auto; margin-bottom: -10px; display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 12px; background: var(--sunken); }
  .soundbar + :global(.timer) { margin-top: 0; }
  .sb-play { width: 28px; height: 28px; border-radius: 14px; border: 0; background: var(--surface); display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .soundbar.on .sb-play { background: var(--ink); color: #fff; }
  .sb-names { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; border: 0; background: transparent; font-size: 12px; color: var(--ink-2); text-align: left; padding: 0; }
  .sb-names span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .edit { opacity: 0; width: 28px; height: 28px; margin-right: 2px; }
  .proj:hover .edit, .edit:focus-visible { opacity: 1; }
</style>
