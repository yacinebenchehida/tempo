<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { db, ui, clock, taskById, projectById, activeProjects, updateTask, deleteTask, taskTime, deleteEntry, carriedWeeks } from '../lib/store.svelte';
  import { toggle } from '../lib/timer.svelte';
  import { COLUMNS, type Level } from '../lib/types';
  import { fmtDur, fmtTime, fmtDayShort, fmtDayLong, parseDay, uid } from '../lib/time';
  import SubtaskRow from './SubtaskRow.svelte';
  import { tint } from '../lib/palette';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';
  import { t, tp } from '../lib/i18n.svelte';

  const task = $derived(taskById(ui.openTaskId));
  const project = $derived(task ? projectById(task.projectId) : null);
  const projects = $derived(activeProjects());
  const spent = $derived(task ? taskTime(task.id, clock.now) : 0);
  const entries = $derived(task ? db.entries.filter((e) => e.taskId === task.id).sort((a, b) => b.start - a.start) : []);
  const isRunning = $derived(task && db.timer.taskId === task.id && db.timer.phase === 'work');
  const carried = $derived(task ? carriedWeeks(task, clock.now) : 0);
  const subName = (id: string | null | undefined) => (id && task ? task.subtasks.find((s) => s.id === id)?.title : null);

  let newSub = $state('');
  let confirmDelete = $state(false);

  // Estimate as hours + minutes.
  const estH = $derived(task ? Math.floor(task.estimate / 60) : 0);
  const estM = $derived(task ? task.estimate % 60 : 0);
  function setEstimate(h: number, m: number) {
    if (task) task.estimate = Math.max(0, Math.round((h || 0) * 60 + (m || 0)));
  }

  function close() {
    if (task && !task.title.trim()) task.title = t('Untitled task');
    ui.openTaskId = null;
    confirmDelete = false;
  }
  function addSub() {
    if (!task || !newSub.trim()) return;
    task.subtasks.push({ id: uid(), title: newSub.trim(), done: false, due: null, estimate: 0 });
    newSub = '';
  }
  function focusIfEmpty(el: HTMLInputElement) {
    if (!el.value) el.focus();
  }
</script>

{#if task}
  <div class="scrim" transition:fade={{ duration: 150 }} onclick={close} role="presentation"></div>
  <aside class="drawer" transition:fly={{ x: 420, duration: 260, opacity: 1 }} aria-label={t('Task details')} style:--c={project?.color ?? '#8A909C'} style:--c-soft={tint(project?.color ?? '#8A909C', 0.1)}>
    <div class="top">
      <span class="badge" style:background={project ? tint(project.color, 0.14) : 'var(--sunken)'}>
        {#if project}<Mascot kind={project.mascot} color={project.color} size={22} />{/if}
      </span>
      <select class="input proj" value={task.projectId} onchange={(e) => updateTask(task.id, { projectId: (e.currentTarget as HTMLSelectElement).value })} aria-label={t('Project')}>
        {#each projects as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        {#if project?.archived}<option value={project.id}>{project.name} {t('(archived)')}</option>{/if}
      </select>
      <button class="icon-btn" aria-label={t('Close')} onclick={close}><Icon name="x" size={18} /></button>
    </div>

    <input class="title display" placeholder={t('Task name')} bind:value={task.title} use:focusIfEmpty aria-label={t('Task name')} />

    <div class="timer-row">
      <button class="btn primary" onclick={() => toggle(task.id, isRunning ? undefined : null)}><Icon name={isRunning ? 'pause' : 'play'} size={13} />{t(isRunning ? 'Pause timer' : 'Start timer')}</button>
      <div class="spent"><span class="num display">{fmtDur(spent)}</span><span class="muted">{task.estimate ? t('of {d} estimated', { d: fmtDur(task.estimate * 60000) }) : t('tracked')}</span></div>
    </div>
    {#if task.estimate}
      <div class="est-bar"><span style:width="{Math.min(100, (spent / (task.estimate * 60000)) * 100)}%" class:over={spent > task.estimate * 60000}></span></div>
    {/if}

    {#if task.plannedWeek && task.column !== 'todo'}
      <div class="planned" class:late={carried > 0}>
        <Icon name="calendar" size={14} />
        <span>{t('Planned for the week of {d}', { d: fmtDayLong(parseDay(task.plannedWeek)).replace(/^\S+ /, '') })}{carried ? ' · ' + tp(carried, '{n} week over', '{n} weeks over') : ''}</span>
      </div>
    {/if}

    <div class="grid">
      <label class="field"><span>{t('Status')}</span>
        <select class="input" value={task.column} onchange={(e) => updateTask(task.id, { column: (e.currentTarget as HTMLSelectElement).value as any })}>
          {#each COLUMNS as c}<option value={c.id}>{t(c.name)}</option>{/each}
        </select>
      </label>
      <label class="field"><span>{t('Due date')}</span>
        <div class="due-row">
          <input class="input" type="date" value={task.due ?? ''} onchange={(e) => (task.due = (e.currentTarget as HTMLInputElement).value || null)} />
          {#if task.due}<button class="icon-btn" aria-label={t('Clear due date')} onclick={() => (task.due = null)}><Icon name="x" size={14} /></button>{/if}
        </div>
      </label>
      <div class="field"><span>{t('Priority')}</span>
        <div class="seg">
          {#each [1, 2, 3] as const as p}
            <button class:on={task.priority === p} onclick={() => (task.priority = p as Level)}>{t(p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low')}</button>
          {/each}
        </div>
      </div>
      <div class="field"><span>{t('Difficulty')}</span>
        <div class="seg">
          {#each [1, 2, 3] as const as d}
            <button class:on={task.difficulty === d} onclick={() => (task.difficulty = d as Level)} aria-label={t('Difficulty {d} of 3', { d })}>
              <span class="dots">{#each [1, 2, 3] as i}<span class:on={i <= d}></span>{/each}</span>
            </button>
          {/each}
        </div>
      </div>
      <div class="field span2"><span>{t('Time estimate')}</span>
        <div class="est">
          <input class="input num" type="number" min="0" value={estH} oninput={(e) => setEstimate(+(e.currentTarget as HTMLInputElement).value, estM)} aria-label={t('Hours')} /><span class="muted">{t('h')}</span>
          <input class="input num" type="number" min="0" max="59" step="5" value={estM} oninput={(e) => setEstimate(estH, +(e.currentTarget as HTMLInputElement).value)} aria-label={t('Minutes')} /><span class="muted">{t('m')}</span>
          {#each [[0, 30], [1, 0], [2, 0], [4, 0], [8, 0]] as [h, m]}
            <button class="btn small" onclick={() => setEstimate(h, m)}>{h ? t('{h}h', { h }) : t('{m}m', { m })}</button>
          {/each}
        </div>
      </div>
    </div>

    <section>
      <div class="sec-head"><span class="eyebrow">{t('Subtasks')}</span>{#if task.subtasks.length}<span class="muted small">{t('{a} of {b}', { a: task.subtasks.filter((s) => s.done).length, b: task.subtasks.length })}</span>{/if}</div>
      <ul class="subs">
        {#each task.subtasks as s (s.id)}
          <SubtaskRow {task} sub={s} />
        {/each}
      </ul>
      <input class="input" placeholder={t('Add a subtask, then Enter')} bind:value={newSub} onkeydown={(e) => e.key === 'Enter' && addSub()} />
    </section>

    <section>
      <span class="eyebrow">{t('Notes')}</span>
      <textarea class="input" placeholder={t('Anything worth remembering')} bind:value={task.notes}></textarea>
    </section>

    <section>
      <div class="sec-head"><span class="eyebrow">{t('Time log')}</span>
        <button class="btn small" onclick={() => (ui.entryEditor = { id: null, taskId: task.id, day: '' })}><Icon name="plus" size={12} />{t('Add time')}</button>
      </div>
      {#if !entries.length}<p class="muted small">{t('No time tracked yet.')}</p>{/if}
      {#each entries.slice(0, 30) as e (e.id)}
        <div class="entry">
          <span class="muted small day">{fmtDayShort(e.start)}</span>
          <span class="num small">{fmtTime(e.start)} – {e.end ? fmtTime(e.end) : t('now')}{#if subName(e.subtaskId)}<span class="muted">{' · '}{subName(e.subtaskId)}</span>{/if}</span>
          <span class="num strong">{fmtDur((e.end ?? clock.now) - e.start)}</span>
          {#if e.end}
            <button class="icon-btn" aria-label={t('Edit entry')} onclick={() => (ui.entryEditor = { id: e.id, taskId: task.id, day: '' })}><Icon name="edit" size={14} /></button>
            <button class="icon-btn" aria-label={t('Delete entry')} onclick={() => deleteEntry(e.id)}><Icon name="trash" size={14} /></button>
          {/if}
        </div>
      {/each}
      {#if entries.length > 30}<p class="muted small">{t('…and {n} older entries (see Calendar).', { n: entries.length - 30 })}</p>{/if}
    </section>

    <div class="danger-zone">
      {#if confirmDelete}
        <span class="small">{t('Delete this task and its {d} of tracked time?', { d: fmtDur(spent) })}</span>
        <button class="btn small danger" onclick={() => deleteTask(task.id)}>{t('Delete')}</button>
        <button class="btn small ghost" onclick={() => (confirmDelete = false)}>{t('Cancel')}</button>
      {:else}
        <button class="btn small ghost danger" onclick={() => (confirmDelete = true)}><Icon name="trash" size={13} />{t('Delete task')}</button>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .scrim { position: fixed; inset: 0; background: rgba(22, 24, 29, 0.18); z-index: 20; }
  .drawer {
    position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); background: var(--surface); z-index: 21;
    box-shadow: var(--shadow-pop); padding: 40px 26px 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
  }
  .top { display: flex; align-items: center; gap: 10px; }
  .badge { width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .proj { flex: 1; font-weight: 600; }
  .title { border: 0; outline: none; font-size: 24px; font-weight: 700; padding: 0; background: transparent; width: 100%; }
  .timer-row { display: flex; align-items: center; gap: 14px; }
  .spent { display: flex; flex-direction: column; }
  .spent .display { font-size: 20px; font-weight: 700; }
  .spent .muted { font-size: 12px; }
  .est-bar { height: 6px; border-radius: 3px; background: var(--sunken); overflow: hidden; margin-top: -8px; }
  .est-bar span { display: block; height: 6px; background: var(--c); border-radius: 3px; transition: width 1s linear; }
  .est-bar span.over { background: #b42318; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .span2 { grid-column: span 2; }
  .due-row { display: flex; gap: 4px; align-items: center; }
  .seg { width: 100%; }
  .seg button { flex: 1; }
  .dots { display: inline-flex; gap: 3px; }
  .dots span { width: 7px; height: 7px; border-radius: 4px; background: #d9dde3; }
  .dots span.on { background: currentColor; }
  .est { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .est .input { width: 64px; }
  section { display: flex; flex-direction: column; gap: 8px; }
  .sec-head { display: flex; align-items: center; justify-content: space-between; }
  .small { font-size: 12px; }
  .subs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .entry { display: grid; grid-template-columns: 90px 1fr auto auto auto; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid #eef0f3; }
  .strong { font-weight: 600; font-size: 13px; }
  .planned { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); margin-top: -6px; }
  .planned.late { color: #b42318; font-weight: 600; }
  .danger-zone { margin-top: auto; padding-top: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
