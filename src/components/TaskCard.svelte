<script lang="ts">
  import type { Task } from '../lib/types';
  import { db, ui, clock, projectById, taskTime, moveTask, carriedWeeks } from '../lib/store.svelte';
  import { toggle, stop } from '../lib/timer.svelte';
  import { fmtDur, fmtDue } from '../lib/time';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';
  import { t, tp } from '../lib/i18n.svelte';

  let { task, celebrateId = null }: { task: Task; celebrateId?: string | null } = $props();

  const project = $derived(projectById(task.projectId));
  const color = $derived(project?.color ?? '#8A909C');
  const isCurrent = $derived(db.timer.taskId === task.id && db.timer.phase !== 'idle');
  const isRunning = $derived(isCurrent && db.timer.phase === 'work');
  const spent = $derived(taskTime(task.id, clock.now));
  const done = $derived(task.column === 'done');
  const subDone = $derived(task.subtasks.filter((s) => s.done).length);
  const due = $derived(task.due ? fmtDue(task.due, clock.now) : null);
  const over = $derived(task.estimate > 0 && spent > task.estimate * 60000);
  const carried = $derived(carriedWeeks(task, clock.now));
  const currentSub = $derived(isCurrent && db.timer.subtaskId ? task.subtasks.find((s) => s.id === db.timer.subtaskId) : null);
  const nextSubDue = $derived(
    task.subtasks
      .filter((s) => !s.done && s.due)
      .sort((a, b) => (a.due! < b.due! ? -1 : 1))[0] ?? null
  );

  function finish(e: MouseEvent) {
    e.stopPropagation();
    if (isCurrent) stop();
    moveTask(task.id, 'done', null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ui.celebrate = { x: r.left + r.width / 2, y: r.top + r.height / 2, color, key: Date.now() };
  }
  function play(e: MouseEvent) {
    e.stopPropagation();
    toggle(task.id, isCurrent ? undefined : null);
  }
</script>

<div class="card-wrap" class:running={isRunning} class:done style:--c={color}>
  <div class="open" role="button" tabindex="0" onclick={() => (ui.openTaskId = task.id)} onkeydown={(e) => e.key === 'Enter' && (ui.openTaskId = task.id)} aria-label={t('Open {title}', { title: task.title })}></div>
  <span class="stripe"></span>
  <div class="body">
    <div class="meta">
      {#if project}<Mascot kind={project.mascot} color={color} size={16} /><span class="proj">{project.name}</span>{/if}
      <span class="prio" title={t('Priority {n}', { n: task.priority })}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={task.priority === 1 ? 'var(--ink)' : task.priority === 2 ? '#AEB4BE' : 'none'} stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4h12l-2.5 4.5L17 13H5" /></svg>P{task.priority}
      </span>
    </div>
    <div class="title">{task.title}</div>
    {#if currentSub}
      <div class="cursub"><Icon name={isRunning ? 'play' : 'pause'} size={9} /><span>{currentSub.title}</span></div>
    {/if}
    {#if carried && !done}
      <div class="carried" title={t('Planned for the week of {d}', { d: task.plannedWeek ?? '' })}>{tp(carried, 'Carried over · {n} week', 'Carried over · {n} weeks')}</div>
    {/if}
    <div class="facts">
      <span class="dots" title={t('Difficulty {d} of 3', { d: task.difficulty })} aria-label={t('Difficulty {d} of 3', { d: task.difficulty })}>
        {#each [1, 2, 3] as i}<span class:on={i <= task.difficulty}></span>{/each}
      </span>
      {#if task.subtasks.length}
        <span class="sub"><span class="bar"><span style:width="{(subDone / task.subtasks.length) * 100}%"></span></span>{subDone}/{task.subtasks.length}</span>
      {/if}
      {#if due && !done}<span class="due" class:overdue={due.overdue} class:soon={due.soon}>{due.overdue ? t('Overdue · ') : ''}{due.text}</span>
      {:else if nextSubDue && !done}{@const d = fmtDue(nextSubDue.due!, clock.now)}<span class="due sub-due" class:overdue={d.overdue} title={nextSubDue.title}>› {d.text}</span>{/if}
    </div>
    <div class="foot">
      <span class="num spent" class:strong={isRunning}>{fmtDur(spent)}</span>
      {#if task.estimate}<span class="est num" class:over>/ {fmtDur(task.estimate * 60000)}</span>{/if}
      {#if done}
        <span class="tick pop"><Icon name="check" size={13} stroke={3} /></span>
      {:else}
        <button class="icon-btn act" onclick={finish} aria-label={t('Mark done')} title={t('Mark done')}><Icon name="check" size={16} stroke={2.2} /></button>
        <button class="playbtn" class:on={isCurrent} onclick={play} aria-label={t(isRunning ? 'Pause timer' : 'Start timer')} title={t(isRunning ? 'Pause timer' : 'Start timer')}>
          <Icon name={isRunning ? 'pause' : 'play'} size={12} />
        </button>
      {/if}
    </div>
  </div>
  {#if celebrateId === task.id}<span class="ring"></span>{/if}
</div>

<style>
  .card-wrap {
    position: relative; display: flex; gap: 11px; background: var(--surface); border-radius: 12px; padding: 13px 12px 11px 11px;
    box-shadow: var(--shadow); transition: transform 0.3s var(--spring), box-shadow 0.3s;
  }
  .card-wrap:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); }
  .card-wrap.running { box-shadow: 0 0 0 2px var(--c), var(--shadow-lift); }
  .card-wrap.done { opacity: 0.8; }
  .card-wrap.done .title { text-decoration: line-through; color: var(--ink-2); }
  .open { position: absolute; inset: 0; border-radius: 12px; cursor: pointer; }
  .stripe { width: 4px; border-radius: 2px; background: var(--c); flex: none; }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 9px; pointer-events: none; }
  .body button { pointer-events: auto; position: relative; }
  .meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); }
  .proj { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prio { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; flex: none; }
  .title { font-size: 14px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
  .cursub { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--c); margin-top: -4px; }
  .cursub span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .carried { align-self: flex-start; font-size: 11px; font-weight: 600; color: #8a1c12; background: #fdecea; border-radius: 6px; padding: 2px 7px; margin-top: -3px; }
  .sub-due { font-weight: 500; }
  .facts { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--ink-3); flex-wrap: wrap; }
  .dots { display: inline-flex; gap: 3px; }
  .dots span { width: 7px; height: 7px; border-radius: 4px; background: #d9dde3; }
  .dots span.on { background: var(--ink-2); }
  .sub { display: inline-flex; align-items: center; gap: 6px; }
  .bar { width: 34px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; display: inline-block; }
  .bar span { display: block; height: 4px; background: var(--c); }
  .due { margin-left: auto; }
  .due.soon { color: var(--ink); font-weight: 600; }
  .due.overdue { color: #b42318; font-weight: 600; }
  .foot { display: flex; align-items: center; gap: 6px; border-top: 1px solid #eef0f3; padding-top: 9px; }
  .spent { font-size: 13px; font-weight: 500; white-space: nowrap; }
  .spent.strong { font-weight: 700; }
  .est { font-size: 12px; color: var(--ink-3); white-space: nowrap; }
  .est.over { color: #b42318; }
  .act { margin-left: auto; color: var(--ink-2); }
  .playbtn { width: 32px; height: 32px; border-radius: 16px; border: 0; background: var(--sunken); display: inline-flex; align-items: center; justify-content: center; transition: transform 0.2s var(--spring); }
  .playbtn:hover { transform: scale(1.08); }
  .playbtn.on { background: var(--c); color: #fff; }
  .tick { margin-left: auto; width: 24px; height: 24px; border-radius: 12px; background: var(--c); color: #fff; display: inline-flex; align-items: center; justify-content: center; }
  .ring { position: absolute; right: 10px; bottom: 10px; width: 24px; height: 24px; border-radius: 12px; border: 2px solid var(--c); animation: ring 0.9s ease-out forwards; pointer-events: none; }
  @keyframes ring { from { transform: scale(0.4); opacity: 0.9; } to { transform: scale(2.8); opacity: 0; } }
</style>
