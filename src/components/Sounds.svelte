<script lang="ts">
  import { db } from '../lib/store.svelte';
  import { SOUNDS, player, togglePlay, toggleSound, anySelected, play } from '../lib/sound.svelte';
  import { uid } from '../lib/time';
  import { t } from '../lib/i18n.svelte';
  import Icon from './Icon.svelte';

  const s = db.sound;
  let naming = $state(false);
  let mixName = $state('');

  const selected = $derived(SOUNDS.filter((x) => s.on[x.id]));

  function saveMix() {
    const name = mixName.trim();
    if (!name || !selected.length) return;
    const volumes: Record<string, number> = {};
    for (const x of selected) volumes[x.id] = s.volumes[x.id] ?? 0.6;
    s.mixes.push({ id: uid(), name, volumes });
    mixName = '';
    naming = false;
  }
  function applyMix(volumes: Record<string, number>) {
    for (const x of SOUNDS) s.on[x.id] = x.id in volumes;
    Object.assign(s.volumes, volumes);
    play();
  }
  const isCurrent = (volumes: Record<string, number>) =>
    SOUNDS.every((x) => !!s.on[x.id] === x.id in volumes) && Object.keys(volumes).every((k) => Math.abs((s.volumes[k] ?? 0) - volumes[k]) < 0.01);
  function focus(el: HTMLElement) {
    el.focus();
  }
</script>

<div class="page">
  <header>
    <div>
      <span class="muted small">{t('Pick the sounds you are in the mood for, then press play.')}</span>
      <h1 class="display">{t('Sounds')}</h1>
    </div>
    <div class="master">
      <button class="big-play" class:on={player.playing} onclick={togglePlay} disabled={!anySelected()} aria-label={t(player.playing ? 'Pause' : 'Play')}>
        <Icon name={player.playing ? 'pause' : 'play'} size={18} />
      </button>
      <label class="vol">
        <Icon name="volume" size={16} />
        <input type="range" min="0" max="1" step="0.01" bind:value={s.master} aria-label={t('Volume')} />
      </label>
    </div>
  </header>

  <div class="grid">
    {#each SOUNDS as x (x.id)}
      {@const on = !!s.on[x.id]}
      <div class="tile" class:on class:live={on && player.playing}>
        <button class="hit" onclick={() => toggleSound(x.id)} aria-pressed={on}>
          <span class="ic"><Icon name={x.icon} size={30} stroke={1.6} /></span>
          <span class="name">{t(x.name)}</span>
        </button>
        <input
          type="range" min="0.02" max="1" step="0.01"
          value={s.volumes[x.id] ?? 0.6}
          oninput={(e) => {
            s.volumes[x.id] = +(e.currentTarget as HTMLInputElement).value;
            if (!on) s.on[x.id] = true;
          }}
          aria-label={t('Volume of {name}', { name: t(x.name) })}
        />
      </div>
    {/each}
  </div>

  <section class="card mixes">
    <div class="mh">
      <h2>{t('Mixes')}</h2>
      {#if naming}
        <div class="namer">
          <input class="input" placeholder={t('Mix name')} bind:value={mixName} use:focus onkeydown={(e) => { if (e.key === 'Enter') saveMix(); if (e.key === 'Escape') naming = false; }} />
          <button class="btn primary small" onclick={saveMix} disabled={!mixName.trim()}>{t('Save')}</button>
          <button class="btn ghost small" onclick={() => (naming = false)}>{t('Cancel')}</button>
        </div>
      {:else}
        <button class="btn small" onclick={() => (naming = true)} disabled={!selected.length}><Icon name="plus" size={13} />{t('Save this mix')}</button>
      {/if}
    </div>
    {#if !s.mixes.length}
      <p class="muted small">{t('Turn on a few sounds, set their volumes, then save the mix to find it again in one click.')}</p>
    {/if}
    <div class="chips">
      {#each s.mixes as m (m.id)}
        <span class="chip" class:cur={isCurrent(m.volumes)}>
          <button class="apply" onclick={() => applyMix(m.volumes)}>
            {m.name}
            <span class="muted">{Object.keys(m.volumes).map((k) => t(SOUNDS.find((x) => x.id === k)?.name ?? k)).join(' · ')}</span>
          </button>
          <button class="icon-btn" aria-label={t('Delete')} onclick={() => (s.mixes = s.mixes.filter((x) => x.id !== m.id))}><Icon name="x" size={12} /></button>
        </span>
      {/each}
    </div>
  </section>

  <label class="toggle"><input type="checkbox" bind:checked={s.withTimer} /> {t('Start and stop the sounds with the task timer')}</label>
</div>

<style>
  .page { padding: 26px 30px 40px; display: flex; flex-direction: column; gap: 18px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .small { font-size: 12px; }
  .master { display: flex; align-items: center; gap: 14px; background: var(--surface); padding: 8px 16px 8px 8px; border-radius: 999px; box-shadow: var(--shadow); }
  .big-play { width: 48px; height: 48px; border-radius: 24px; border: 0; background: var(--ink); color: #fff; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.2s var(--spring); }
  .big-play:hover { transform: scale(1.06); }
  .big-play:disabled { opacity: 0.35; cursor: default; transform: none; }
  .vol { display: flex; align-items: center; gap: 8px; color: var(--ink-3); }
  .vol input { width: 140px; }
  input[type='range'] { accent-color: var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  .tile { background: var(--surface); border-radius: 18px; padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow); transition: background 0.3s, box-shadow 0.3s, transform 0.3s var(--spring); }
  .tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); }
  .tile.on { background: var(--ink); color: #fff; }
  .tile.on input[type='range'] { accent-color: #fff; }
  .hit { border: 0; background: transparent; color: inherit; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 4px; text-align: left; }
  .ic { width: 52px; height: 52px; border-radius: 14px; background: var(--sunken); color: var(--ink-2); display: inline-flex; align-items: center; justify-content: center; transition: background 0.3s; }
  .tile.on .ic { background: #2b2f37; color: #fff; }
  .tile.live .ic { animation: breathe 3.6s ease-in-out infinite; }
  .name { font-weight: 600; font-size: 14px; }
  .tile input[type='range'] { width: 100%; opacity: 0.55; transition: opacity 0.2s; }
  .tile.on input[type='range'], .tile:hover input[type='range'] { opacity: 1; }
  .mixes { display: flex; flex-direction: column; gap: 12px; }
  .mh { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .namer { display: flex; gap: 6px; align-items: center; }
  .namer .input { min-height: 32px; width: 200px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--line-strong); border-radius: 12px; padding: 2px 2px 2px 4px; }
  .chip.cur { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
  .apply { border: 0; background: transparent; display: flex; flex-direction: column; align-items: flex-start; padding: 6px 8px; font-weight: 600; font-size: 13px; text-align: left; }
  .apply .muted { font-weight: 400; font-size: 11px; }
  .toggle { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ink-2); }
  .toggle input { width: 18px; height: 18px; accent-color: var(--ink); }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
