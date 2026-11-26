<script lang="ts">
  import { db, ui, clock, projectById, activeProjects, createTask } from '../lib/store.svelte';
  import { tint } from '../lib/palette';
  import { addDays, addMonths, dayKey, fmtDayLong, fmtDur, fmtTime, overlap, startOfMonth, startOfWeek, months, weekHeader, DAY } from '../lib/time';
  import { t, cap } from '../lib/i18n.svelte';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';

  let offset = $state(0);
  let selected = $state(dayKey(Date.now()));

  const month = $derived(addMonths(startOfMonth(clock.now), offset));
  const today = $derived(dayKey(clock.now));
  const projects = $derived(activeProjects());
  const visible = (pid: string) => {
    const p = projectById(pid);
    return !!p && !p.archived && (ui.filter === 'all' || ui.filter === pid);
  };

  const days = $derived.by(() => {
    const first = startOfWeek(month);
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(first, i);
      const key = dayKey(d);
      const from = d.getTime();
      const to = addDays(d, 1).getTime();
      const per = new Map<string, number>();
      for (const e of db.entries) {
        if (!visible(e.projectId)) continue;
        const ms = overlap(e.start, e.end ?? clock.now, from, to);
        if (ms) per.set(e.projectId, (per.get(e.projectId) ?? 0) + ms);
      }
      const total = [...per.values()].reduce((a, b) => a + b, 0);
      const chips = db.tasks
        .filter((t) => t.due === key && visible(t.projectId))
        .sort((a, b) => Number(a.column === 'done') - Number(b.column === 'done') || a.priority - b.priority);
      out.push({ d, key, inMonth: d.getMonth() === month.getMonth(), total, per, chips });
    }
    // Drop a trailing week that belongs entirely to the next month.
    return out.slice(35).every((x) => !x.inMonth) ? out.slice(0, 35) : out;
  });
  const maxDay = $derived(Math.max(8 * 3600000, ...days.map((d) => d.total)));

  const sel = $derived.by(() => {
    const d = new Date(selected + 'T00:00:00');
    const from = d.getTime();
    const to = from + DAY;
    const due = db.tasks.filter((t) => t.due === selected && visible(t.projectId));
    const log = db.entries
      .filter((e) => visible(e.projectId) && overlap(e.start, e.end ?? clock.now, from, to) > 0)
      .sort((a, b) => a.start - b.start);
    const total = log.reduce((a, e) => a + overlap(e.start, e.end ?? clock.now, from, to), 0);
    return { d, due, log, total };
  });

  // Drag a chip to another day to move its due date.
  let dragTask = $state<string | null>(null);
  let overDay = $state<string | null>(null);
  function dropOn(key: string) {
    const t = db.tasks.find((x) => x.id === dragTask);
    if (t) t.due = key;
    dragTask = null;
    overDay = null;
  }

  let adding = $state(false);
  let newTitle = $state('');
  let newProject = $state('');
  function addDue() {
    if (!newTitle.trim() || !newProject) return;
    createTask(newProject, 'todo', newTitle, { due: selected });
    newTitle = '';
    adding = false;
  }
  function focus(el: HTMLElement) {
    el.focus();
  }
</script>

<div class="page">
  <section class="main">
    <header>
      <div>
        <span class="muted small">{t('Due dates and time logged')}</span>
        <h1 class="display">{cap(months()[month.getMonth()])} {month.getFullYear()}</h1>
      </div>
      <div class="nav">
        <button class="btn square" aria-label={t('Previous month')} onclick={() => offset--}><Icon name="left" /></button>
        <button class="btn" onclick={() => { offset = 0; selected = today; }}>{t('Today')}</button>
        <button class="btn square" aria-label={t('Next month')} onclick={() => offset++}><Icon name="right" /></button>
      </div>
    </header>

    <div class="filters">
      <button class="chip" class:on={ui.filter === 'all'} onclick={() => (ui.filter = 'all')}><span class="dot" style:background="var(--ink)"></span>{t('All')}</button>
      {#each projects as p (p.id)}
        <button class="chip" class:on={ui.filter === p.id} onclick={() => (ui.filter = ui.filter === p.id ? 'all' : p.id)}><span class="dot" style:background={p.color}></span>{p.name}</button>
      {/each}
    </div>

    <div class="grid-wrap">
      <div class="wk">{#each weekHeader() as w}<span>{w}</span>{/each}</div>
      <div class="grid">
        {#each days as day (day.key)}
          <div
            class="day"
            class:out={!day.inMonth}
            class:sel={day.key === selected}
            class:over={overDay === day.key}
            role="button"
            tabindex="0"
            onclick={() => (selected = day.key)}
            onkeydown={(e) => e.key === 'Enter' && (selected = day.key)}
            ondragover={(e) => { if (dragTask) { e.preventDefault(); overDay = day.key; } }}
            ondragleave={() => overDay === day.key && (overDay = null)}
            ondrop={(e) => { e.preventDefault(); dropOn(day.key); }}
            aria-label={t('{day}, {n} due', { day: fmtDayLong(day.d), n: day.chips.length })}
          >
            <div class="day-top">
              <span class="n" class:today={day.key === today}>{day.d.getDate()}</span>
              <span class="logged num">{day.total ? fmtDur(day.total) : ''}</span>
            </div>
            <div class="chips">
              {#each day.chips.slice(0, 3) as task (task.id)}
                {@const p = projectById(task.projectId)}
                <span
                  class="c"
                  class:done={task.column === 'done'}
                  style:background={tint(p?.color ?? '#8A909C', 0.14)}
                  draggable="true"
                  ondragstart={(e) => { dragTask = task.id; e.dataTransfer?.setData('text/plain', task.id); }}
                  ondragend={() => { dragTask = null; overDay = null; }}
                  ondblclick={(e) => { e.stopPropagation(); ui.openTaskId = task.id; }}
                  title={t('{title} · drag to change the due date, double-click to open', { title: task.title })}
                  role="note"
                >
                  <span class="cd" style:background={p?.color}></span><span class="ct">{task.title}</span>
                </span>
              {/each}
              {#if day.chips.length > 3}<span class="more">{t('+{n} more', { n: day.chips.length - 3 })}</span>{/if}
            </div>
            {#if day.total}
              <div class="bar">
                {#each [...day.per.entries()] as [pid, ms]}
                  <span style:width="{(ms / maxDay) * 100}%" style:background={projectById(pid)?.color}></span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
    <p class="muted small">{t('Chips are tasks due that day: drag one to another day to move it, double-click to open it. The thin bar shows the time you logged, split by project.')}</p>
  </section>

  <aside class="panel">
    <div>
      <span class="muted small">{t(selected === today ? 'Today' : selected < today ? 'Past day' : 'Upcoming')}</span>
      <h2 class="display">{fmtDayLong(sel.d)}</h2>
    </div>

    <div class="block">
      <div class="block-head"><span class="eyebrow">{t('Due')}</span>
        {#if projects.length}<button class="btn small ghost" onclick={() => { adding = true; newProject = ui.filter !== 'all' ? ui.filter : projects[0].id; }}><Icon name="plus" size={12} />{t('Task due this day')}</button>{/if}
      </div>
      {#if adding}
        <div class="adder">
          <input class="input" placeholder={t('Task name')} bind:value={newTitle} use:focus onkeydown={(e) => { if (e.key === 'Enter') addDue(); if (e.key === 'Escape') adding = false; }} />
          <div class="adder-row">
            <select class="input" bind:value={newProject}>{#each projects as p (p.id)}<option value={p.id}>{p.name}</option>{/each}</select>
            <button class="btn primary small" onclick={addDue}>{t('Add')}</button>
          </div>
        </div>
      {/if}
      {#if !sel.due.length && !adding}<span class="muted small">{t('Nothing due.')}</span>{/if}
      {#each sel.due as task (task.id)}
        {@const p = projectById(task.projectId)}
        <button class="due" style:background={tint(p?.color ?? '#8A909C', 0.12)} onclick={() => (ui.openTaskId = task.id)}>
          {#if p}<Mascot kind={p.mascot} color={p.color} size={18} />{/if}
          <span class="dt" class:done={task.column === 'done'}>{task.title}</span>
          <span class="small muted">{p?.name}</span>
        </button>
      {/each}
    </div>

    <div class="block">
      <div class="block-head"><span class="eyebrow">{t('Time log')}</span><span class="num strong">{sel.total ? fmtDur(sel.total) : ''}</span></div>
      {#if !sel.log.length}<span class="muted small">{t('No time logged.')}</span>{/if}
      {#each sel.log as e (e.id)}
        {@const task = db.tasks.find((x) => x.id === e.taskId)}
        {@const p = projectById(e.projectId)}
        <div class="entry">
          <span class="es" style:background={p?.color}></span>
          <div class="ei">
            <span class="et">{task?.title ?? t('Deleted task')}</span>
            <span class="muted small num">{fmtTime(e.start)} – {e.end ? fmtTime(e.end) : t('now')} · {p?.name}</span>
          </div>
          <span class="num">{fmtDur((e.end ?? clock.now) - e.start)}</span>
          {#if e.end}<button class="icon-btn" aria-label={t('Edit entry')} onclick={() => (ui.entryEditor = { id: e.id, taskId: e.taskId, day: selected })}><Icon name="edit" size={14} /></button>{/if}
        </div>
      {/each}
      <button class="add" onclick={() => (ui.entryEditor = { id: null, taskId: null, day: selected })}>{t('+ Add time manually')}</button>
    </div>
  </aside>
</div>

<style>
  .page { padding: 26px 30px 36px; display: flex; gap: 22px; align-items: flex-start; flex-wrap: wrap; }
  .main { flex: 999 1 620px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; }
  .small { font-size: 12px; }
  .nav { display: flex; gap: 8px; }
  .square { width: 38px; padding: 0; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: transparent; font-size: 13px; font-weight: 500; }
  .chip.on { background: var(--surface); border-color: var(--ink); }
  .dot { width: 8px; height: 8px; border-radius: 4px; }
  .grid-wrap { overflow-x: auto; }
  .wk, .grid { display: grid; grid-template-columns: repeat(7, minmax(92px, 1fr)); gap: 6px; }
  .wk { font-size: 12px; font-weight: 600; color: var(--ink-3); padding: 0 8px 6px; }
  .day { min-height: 108px; border-radius: 12px; background: var(--surface); padding: 7px; display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer; transition: box-shadow 0.2s, transform 0.25s var(--spring); outline: none; }
  .day:hover { box-shadow: var(--shadow-lift); transform: translateY(-1px); }
  .day.out { background: #eef0f3; }
  .day.out .n { color: var(--ink-3); }
  .day.sel { box-shadow: 0 0 0 2px var(--ink); }
  .day.over { box-shadow: 0 0 0 2px var(--ink), var(--shadow-lift); background: #fafbfc; }
  .day:focus-visible { box-shadow: 0 0 0 2px var(--ink); }
  .day-top { display: flex; justify-content: space-between; align-items: center; }
  .n { width: 24px; height: 24px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
  .n.today { background: var(--ink); color: #fff; }
  .logged { font-size: 11px; color: var(--ink-3); }
  .chips { display: flex; flex-direction: column; gap: 3px; }
  .c { display: flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 6px; font-size: 11px; font-weight: 500; line-height: 1.3; cursor: grab; min-width: 0; }
  .cd { width: 6px; height: 6px; border-radius: 3px; flex: none; }
  .ct { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c.done .ct { text-decoration: line-through; color: var(--ink-3); }
  .more { font-size: 11px; color: var(--ink-3); padding-left: 6px; }
  .bar { margin-top: auto; display: flex; gap: 2px; height: 4px; }
  .bar span { height: 4px; border-radius: 2px; min-width: 3px; }
  .panel { flex: 1 1 300px; max-width: 380px; background: var(--surface); border-radius: 18px; padding: 22px; display: flex; flex-direction: column; gap: 20px; position: sticky; top: 16px; }
  .panel h2 { margin: 2px 0 0; font-size: 22px; }
  .block { display: flex; flex-direction: column; gap: 8px; }
  .block-head { display: flex; justify-content: space-between; align-items: center; min-height: 30px; }
  .strong { font-weight: 600; }
  .due { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 0; text-align: left; }
  .dt { flex: 1; font-size: 13px; font-weight: 600; }
  .dt.done { text-decoration: line-through; color: var(--ink-3); }
  .entry { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #eef0f3; }
  .es { width: 4px; height: 30px; border-radius: 2px; flex: none; }
  .ei { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .et { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .add { margin-top: 4px; border: 1px dashed #c9ced6; background: transparent; border-radius: 10px; min-height: 40px; font-size: 13px; color: var(--ink-2); }
  .add:hover { background: var(--sunken); }
  .adder { display: flex; flex-direction: column; gap: 6px; }
  .adder-row { display: flex; gap: 6px; }
</style>
