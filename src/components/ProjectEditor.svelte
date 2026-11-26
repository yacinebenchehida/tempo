<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { db, ui, clock, projectById, createProject, updateProject, deleteProject, nextColor, nextMascot } from '../lib/store.svelte';
  import { PALETTE, MASCOTS, MASCOT_KEYS, tint } from '../lib/palette';
  import { fmtHours } from '../lib/time';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';

  const isNew = ui.projectEditor === 'new';
  const existing = isNew ? null : projectById(ui.projectEditor);

  let name = $state(existing?.name ?? '');
  let color = $state(existing?.color ?? nextColor());
  let mascot = $state(existing?.mascot ?? nextMascot());
  let confirmDelete = $state(false);

  const stats = $derived.by(() => {
    if (!existing) return { tasks: 0, ms: 0 };
    const tasks = db.tasks.filter((t) => t.projectId === existing.id).length;
    const ms = db.entries.filter((e) => e.projectId === existing.id).reduce((a, e) => a + ((e.end ?? clock.now) - e.start), 0);
    return { tasks, ms };
  });

  function save() {
    if (!name.trim()) return;
    if (existing) updateProject(existing.id, { name: name.trim(), color, mascot });
    else {
      const p = createProject({ name: name.trim(), color, mascot });
      ui.filter = 'all';
      void p;
    }
    ui.projectEditor = null;
  }
  function archive() {
    if (!existing) return;
    updateProject(existing.id, { archived: !existing.archived });
    if (ui.filter === existing.id) ui.filter = 'all';
    ui.projectEditor = null;
  }
  function remove() {
    if (!existing) return;
    deleteProject(existing.id);
    ui.projectEditor = null;
  }
  function focus(el: HTMLElement) {
    el.focus();
  }
</script>

<div class="scrim" transition:fade={{ duration: 150 }} onclick={() => (ui.projectEditor = null)} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true" aria-label={isNew ? 'New project' : 'Edit project'} transition:scale={{ start: 0.94, duration: 220 }}>
  <div class="preview" style:background={tint(color, 0.12)}>
    <span class="big pop" style:background="#fff">{#key mascot + color}<Mascot kind={mascot} {color} size={44} />{/key}</span>
    <div>
      <span class="eyebrow">{isNew ? 'New project' : 'Edit project'}</span>
      <div class="pname display">{name || 'Project name'}</div>
    </div>
  </div>

  <label class="field"><span>Name</span>
    <input class="input" bind:value={name} use:focus onkeydown={(e) => e.key === 'Enter' && save()} placeholder="e.g. Thesis chapter 2" />
  </label>

  <div class="field"><span>Colour</span>
    <div class="swatches">
      {#each PALETTE as c}
        <button class="sw" class:on={color === c.hex} style:background={c.hex} onclick={() => (color = c.hex)} aria-label={c.name} title={c.name}>
          {#if color === c.hex}<Icon name="check" size={14} stroke={3} />{/if}
        </button>
      {/each}
    </div>
  </div>

  <div class="field"><span>Mascot</span>
    <div class="mascots">
      {#each MASCOT_KEYS as k}
        <button class="m" class:on={mascot === k} onclick={() => (mascot = k)} aria-label={MASCOTS[k].label} title={MASCOTS[k].label} style:--c={color}>
          <Mascot kind={k} color={mascot === k ? color : 'var(--ink-2)'} size={24} />
        </button>
      {/each}
    </div>
  </div>

  <div class="actions">
    {#if existing}
      {#if confirmDelete}
        <span class="warn">Delete {stats.tasks} task{stats.tasks === 1 ? '' : 's'} and {fmtHours(stats.ms)} of history? Archiving keeps them.</span>
        <button class="btn small danger" onclick={remove}>Delete for good</button>
        <button class="btn small ghost" onclick={() => (confirmDelete = false)}>Cancel</button>
      {:else}
        <button class="btn small ghost" onclick={archive}><Icon name="archive" size={13} />{existing.archived ? 'Unarchive' : 'Archive'}</button>
        <button class="btn small ghost danger" onclick={() => (confirmDelete = true)}><Icon name="trash" size={13} />Delete</button>
      {/if}
    {/if}
    <span class="spacer"></span>
    {#if !confirmDelete}
      <button class="btn ghost" onclick={() => (ui.projectEditor = null)}>Cancel</button>
      <button class="btn primary" onclick={save} disabled={!name.trim()}>{isNew ? 'Create project' : 'Save'}</button>
    {/if}
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(22, 24, 29, 0.25); z-index: 30; }
  .modal {
    position: fixed; left: 50%; top: 50%; translate: -50% -50%; width: min(520px, calc(100vw - 40px)); max-height: calc(100vh - 60px); overflow-y: auto;
    background: var(--surface); border-radius: 20px; box-shadow: var(--shadow-pop); z-index: 31; padding: 22px; display: flex; flex-direction: column; gap: 18px;
  }
  .preview { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 14px; transition: background 0.4s; }
  .big { width: 68px; height: 68px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; box-shadow: var(--shadow); }
  .pname { font-size: 24px; font-weight: 700; margin-top: 2px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .sw { width: 32px; height: 32px; border-radius: 16px; border: 0; color: #fff; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.2s var(--spring); }
  .sw:hover { transform: scale(1.12); }
  .sw.on { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--ink); }
  .mascots { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 6px; }
  .m { aspect-ratio: 1; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); display: inline-flex; align-items: center; justify-content: center; transition: transform 0.2s var(--spring); }
  .m:hover { transform: scale(1.08); background: var(--sunken); }
  .m.on { border-color: var(--c); box-shadow: inset 0 0 0 1px var(--c); }
  .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .spacer { flex: 1; }
  .warn { font-size: 12px; color: var(--ink-2); flex-basis: 100%; }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
