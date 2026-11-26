<script lang="ts">
  import { flip } from 'svelte/animate';
  import { db, ui, clock, activeProjects, projectById, createTask, moveTask, taskTime } from '../lib/store.svelte';
  import { COLUMNS, type Column } from '../lib/types';
  import { fmtDayLong, fmtDur, DAY } from '../lib/time';
  import { loadSample } from '../lib/sample';
  import Icon from './Icon.svelte';
  import TaskCard from './TaskCard.svelte';
  import { t } from '../lib/i18n.svelte';

  const projects = $derived(activeProjects());
  const visible = (projectId: string) => {
    const p = projectById(projectId);
    return !!p && !p.archived && (ui.filter === 'all' || ui.filter === projectId);
  };

  let showOldDone = $state(false);
  const cutoff = $derived(clock.now - db.settings.hideDoneAfterDays * DAY);

  const columns = $derived(
    COLUMNS.map((c) => {
      let list = db.tasks.filter((t) => t.column === c.id && visible(t.projectId)).sort((a, b) => a.order - b.order);
      let hidden = 0;
      if (c.id === 'done') {
        list = [...list].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
        if (!showOldDone) {
          const recent = list.filter((t) => (t.completedAt ?? 0) >= cutoff);
          hidden = list.length - recent.length;
          list = recent;
        }
      }
      const time = list.reduce((a, t) => a + taskTime(t.id, clock.now), 0);
      return { ...c, list, hidden, time };
    })
  );

  // ----- drag and drop -----
  let dragId = $state<string | null>(null);
  let drop = $state<{ col: Column; before: string | null } | null>(null);
  let celebrateId = $state<string | null>(null);

  function onDragStart(e: DragEvent, id: string) {
    dragId = id;
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e: DragEvent, col: Column) {
    if (!dragId) return;
    e.preventDefault();
    const zone = e.currentTarget as HTMLElement;
    const cards = [...zone.querySelectorAll<HTMLElement>('[data-card]')].filter((el) => el.dataset.card !== dragId);
    let before: string | null = null;
    for (const el of cards) {
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        before = el.dataset.card!;
        break;
      }
    }
    if (col === 'done') before = null;
    if (drop?.col !== col || drop.before !== before) drop = { col, before };
  }
  function onDrop(e: DragEvent, col: Column) {
    e.preventDefault();
    if (dragId && drop) {
      const t = db.tasks.find((x) => x.id === dragId);
      const wasDone = t?.column === 'done';
      moveTask(dragId, col, drop.before);
      if (col === 'done' && !wasDone && t) {
        if (db.timer.taskId === t.id && db.timer.phase === 'work') {
          import('../lib/timer.svelte').then((m) => m.stop());
        }
        celebrateId = t.id;
        const color = projectById(t.projectId)?.color ?? '#16181D';
        ui.celebrate = { x: e.clientX, y: e.clientY, color, key: Date.now() };
        setTimeout(() => (celebrateId = null), 1000);
      }
    }
    dragId = null;
    drop = null;
  }
  function onDragEnd() {
    dragId = null;
    drop = null;
  }

  // ----- quick add -----
  let adding = $state<Column | null>(null);
  let newTitle = $state('');
  let newProject = $state('');
  let lastProject = '';

  function openAdd(col: Column) {
    if (!projects.length) {
      ui.projectEditor = 'new';
      return;
    }
    adding = col;
    newTitle = '';
    newProject = ui.filter !== 'all' ? ui.filter : lastProject && projectById(lastProject) ? lastProject : projects[0].id;
  }
  function submitAdd(keepOpen: boolean) {
    if (!adding || !newTitle.trim()) {
      adding = null;
      return;
    }
    createTask(newProject, adding, newTitle);
    lastProject = newProject;
    newTitle = '';
    if (!keepOpen) adding = null;
  }
  function newTaskButton() {
    if (!projects.length) return (ui.projectEditor = 'new');
    const pid = ui.filter !== 'all' ? ui.filter : lastProject && projectById(lastProject) ? lastProject : projects[0].id;
    const t = createTask(pid, 'todo', '');
    t.title = '';
    ui.openTaskId = t.id;
  }
  function focus(el: HTMLElement) {
    el.focus();
  }
</script>

<div class="page">
  <header>
    <div>
      <span class="muted date">{fmtDayLong(clock.now)}</span>
      <h1 class="display">{t('Board')}</h1>
    </div>
    <div class="tools">
      <button class="chip" class:on={ui.filter === 'all'} onclick={() => (ui.filter = 'all')}><span class="dot" style:background="var(--ink)"></span>{t('All projects')}</button>
      {#each projects as p (p.id)}
        <button class="chip" class:on={ui.filter === p.id} onclick={() => (ui.filter = ui.filter === p.id ? 'all' : p.id)}><span class="dot" style:background={p.color}></span>{p.name}</button>
      {/each}
      <button class="btn primary" onclick={newTaskButton}><Icon name="plus" size={14} stroke={2.2} />{t('New task')}</button>
    </div>
  </header>

  {#if !projects.length}
    <div class="empty card">
      <h2 class="display">{t('Welcome to Tempo')}</h2>
      <p>{t('Start by creating a project. Each one gets its own colour and a little animal, and everything you track is grouped by project.')}</p>
      <div class="row">
        <button class="btn primary" onclick={() => (ui.projectEditor = 'new')}><Icon name="plus" size={14} />{t('Create a project')}</button>
        <button class="btn" onclick={loadSample}>{t('Explore with sample data')}</button>
      </div>
      <p class="muted small">{t('Sample data can be removed in one click from Settings.')}</p>
    </div>
  {:else}
    <div class="scroller">
      <div class="cols">
        {#each columns as col (col.id)}
          <section
            class="col"
            class:target={drop?.col === col.id}
            ondragover={(e) => onDragOver(e, col.id)}
            ondrop={(e) => onDrop(e, col.id)}
            aria-label={t(col.name)}
          >
            <div class="col-head">
              <span class="col-name">{t(col.name)} <span class="muted">{col.list.length}</span></span>
              <span class="muted num small">{col.time ? fmtDur(col.time) : ''}</span>
            </div>
            <div class="list">
              {#each col.list as task (task.id)}
                <div
                  class="drag-item"
                  class:dragging={dragId === task.id}
                  class:drop-before={drop?.col === col.id && drop.before === task.id}
                  data-card={task.id}
                  draggable="true"
                  ondragstart={(e) => onDragStart(e, task.id)}
                  ondragend={onDragEnd}
                  animate:flip={{ duration: 280 }}
                  role="listitem"
                >
                  <TaskCard {task} {celebrateId} />
                </div>
              {/each}
              {#if drop?.col === col.id && drop.before === null}<div class="placeholder"></div>{/if}
            </div>
            {#if col.id === 'done' && (col.hidden || showOldDone)}
              <button class="btn ghost small older" onclick={() => (showOldDone = !showOldDone)}>{showOldDone ? t('Hide older') : t('Show {n} older', { n: col.hidden })}</button>
            {/if}
            {#if adding === col.id}
              <div class="adder">
                <input
                  class="input"
                  placeholder={t('Task name, then Enter')}
                  bind:value={newTitle}
                  use:focus
                  onkeydown={(e) => {
                    if (e.key === 'Enter') submitAdd(true);
                    if (e.key === 'Escape') adding = null;
                  }}
                />
                <div class="adder-row">
                  <select class="input small-select" bind:value={newProject} aria-label={t('Project')}>
                    {#each projects as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
                  </select>
                  <button class="btn primary small" onclick={() => submitAdd(false)}>{t('Add')}</button>
                  <button class="icon-btn" aria-label={t('Cancel')} onclick={() => (adding = null)}><Icon name="x" size={14} /></button>
                </div>
              </div>
            {:else if col.id !== 'done'}
              <button class="add" onclick={() => openAdd(col.id)}>{t('+ Add task')}</button>
            {/if}
          </section>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .page { padding: 26px 30px 36px; display: flex; flex-direction: column; gap: 20px; min-height: 100%; }
  header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
  .date { font-size: 13px; }
  h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--line-strong); background: transparent; font-size: 13px; font-weight: 500; }
  .chip.on { background: var(--surface); border-color: var(--ink); }
  .chip:hover { background: var(--surface); }
  .dot { width: 8px; height: 8px; border-radius: 4px; }
  .scroller { overflow-x: auto; padding-bottom: 6px; flex: 1; }
  .cols { display: grid; grid-template-columns: repeat(4, minmax(250px, 1fr)); gap: 16px; align-items: start; }
  .col { display: flex; flex-direction: column; gap: 10px; background: rgba(255, 255, 255, 0.55); border-radius: 16px; padding: 12px; min-height: 160px; transition: background 0.2s, box-shadow 0.2s; }
  .col.target { background: rgba(255, 255, 255, 0.9); box-shadow: inset 0 0 0 2px var(--line-strong); }
  .col-head { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 6px 2px; }
  .col-name { font-size: 14px; font-weight: 600; }
  .small { font-size: 12px; }
  .list { display: flex; flex-direction: column; gap: 10px; min-height: 20px; }
  .drag-item { cursor: grab; }
  .drag-item { position: relative; }
  .drag-item.dragging { opacity: 0.35; }
  .drag-item.drop-before::before { content: ''; position: absolute; left: 4px; right: 4px; top: -7px; height: 4px; border-radius: 2px; background: var(--ink); }
  .placeholder { height: 4px; border-radius: 2px; background: var(--ink); margin: -3px 4px; }
  .add { border: 1px dashed #c9ced6; background: transparent; border-radius: 10px; min-height: 40px; font-size: 13px; color: var(--ink-3); }
  .add:hover { background: var(--surface); color: var(--ink); }
  .older { align-self: center; }
  .adder { display: flex; flex-direction: column; gap: 8px; background: var(--surface); padding: 10px; border-radius: 12px; box-shadow: var(--shadow); }
  .adder-row { display: flex; gap: 6px; align-items: center; }
  .small-select { min-height: 30px; font-size: 12px; padding: 0 8px; flex: 1; }
  .empty { max-width: 560px; margin: 40px auto; display: flex; flex-direction: column; gap: 12px; padding: 32px; }
  .empty h2 { margin: 0; font-size: 26px; }
  .empty p { margin: 0; line-height: 1.55; color: var(--ink-2); }
  .empty .row { display: flex; gap: 10px; flex-wrap: wrap; }
</style>
