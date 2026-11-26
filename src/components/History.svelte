<script lang="ts">
  import { db, ui, clock, carriedWeeks } from '../lib/store.svelte';
  import { COLUMNS } from '../lib/types';
  import { fmtDur, fmtHours, fmtDayShort } from '../lib/time';
  import { tint } from '../lib/palette';
  import { t, tp } from '../lib/i18n.svelte';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';

  let query = $state('');
  let project = $state('all');
  let status = $state<'all' | 'open' | 'done'>('all');

  const minute = $derived(Math.floor(clock.now / 60000));

  // Per-task totals, first and last activity, computed once a minute.
  const stats = $derived.by(() => {
    void minute;
    const now = Date.now();
    const m = new Map<string, { ms: number; first: number | null; last: number; subs: Map<string, number> }>();
    for (const e of db.entries) {
      const end = e.end ?? now;
      const s = m.get(e.taskId) ?? { ms: 0, first: null, last: 0, subs: new Map() };
      s.ms += end - e.start;
      s.first = s.first === null ? e.start : Math.min(s.first, e.start);
      s.last = Math.max(s.last, end);
      if (e.subtaskId) s.subs.set(e.subtaskId, (s.subs.get(e.subtaskId) ?? 0) + end - e.start);
      m.set(e.taskId, s);
    }
    return m;
  });

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const groups = $derived.by(() => {
    const q = norm(query.trim());
    const out = db.projects
      .filter((p) => project === 'all' || p.id === project)
      .map((p) => {
        const tasks = db.tasks
          .filter((tk) => tk.projectId === p.id)
          .filter((tk) => status === 'all' || (status === 'done' ? tk.column === 'done' : tk.column !== 'done'))
          .map((tk) => {
            const st = stats.get(tk.id);
            const matchedSubs = q ? tk.subtasks.filter((s) => norm(s.title).includes(q)) : [];
            const match = !q || norm(tk.title).includes(q) || matchedSubs.length > 0 || norm(tk.notes).includes(q);
            return {
              tk,
              match,
              ms: st?.ms ?? 0,
              started: st?.first ?? tk.createdAt,
              last: Math.max(st?.last ?? 0, tk.completedAt ?? 0, tk.createdAt),
              matchedSubs: matchedSubs.map((s) => ({ s, ms: st?.subs.get(s.id) ?? 0 })),
              carried: carriedWeeks(tk, clock.now)
            };
          })
          .filter((x) => x.match)
          .sort((a, b) => b.last - a.last);
        const ms = tasks.reduce((a, x) => a + x.ms, 0);
        return { p, tasks, ms };
      })
      .filter((g) => g.tasks.length > 0);
    return out.sort((a, b) => Number(a.p.archived) - Number(b.p.archived) || b.ms - a.ms);
  });

  const count = $derived(groups.reduce((a, g) => a + g.tasks.length, 0));
  const colName = (c: string) => t(COLUMNS.find((x) => x.id === c)?.name ?? c);
</script>

<div class="page">
  <header>
    <div>
      <span class="muted small">{t('Everything you have worked on')}</span>
      <h1 class="display">{t('History')}</h1>
    </div>
  </header>

  <div class="controls">
    <label class="search">
      <Icon name="search" size={16} />
      <input placeholder={t('Search tasks and subtasks')} bind:value={query} aria-label={t('Search tasks and subtasks')} />
      {#if query}<button class="icon-btn" aria-label={t('Clear search')} onclick={() => (query = '')}><Icon name="x" size={13} /></button>{/if}
    </label>
    <select class="input proj" bind:value={project} aria-label={t('Project')}>
      <option value="all">{t('All projects')}</option>
      {#each db.projects as p (p.id)}<option value={p.id}>{p.name}{p.archived ? ' ' + t('(archived)') : ''}</option>{/each}
    </select>
    <div class="seg">
      <button class:on={status === 'all'} onclick={() => (status = 'all')}>{t('All')}</button>
      <button class:on={status === 'open'} onclick={() => (status = 'open')}>{t('Open')}</button>
      <button class:on={status === 'done'} onclick={() => (status = 'done')}>{t('Finished')}</button>
    </div>
    <span class="muted small">{tp(count, '{n} task', '{n} tasks')}</span>
  </div>

  {#if !groups.length}
    <div class="card empty"><Mascot kind="owl" color="var(--ink-3)" size={40} /><p>{t(query ? 'Nothing matches your search.' : 'No tasks yet.')}</p></div>
  {/if}

  {#each groups as g (g.p.id)}
    <section class="card group" style:--c={g.p.color}>
      <div class="gh">
        <span class="badge" style:background={tint(g.p.color, 0.14)}><Mascot kind={g.p.mascot} color={g.p.color} size={20} /></span>
        <h2>{g.p.name}{#if g.p.archived}<span class="muted arch"> {t('(archived)')}</span>{/if}</h2>
        <span class="muted small">{tp(g.tasks.length, '{n} task', '{n} tasks')}</span>
        <span class="num gt">{fmtHours(g.ms)}</span>
      </div>
      <div class="table">
        <div class="thead">
          <span>{t('Task')}</span><span>{t('Status')}</span><span>{t('Started')}</span><span>{t('Finished')}</span><span class="r">{t('Time')}</span>
        </div>
        {#each g.tasks as x (x.tk.id)}
          <button class="tr" onclick={() => (ui.openTaskId = x.tk.id)}>
            <span class="tt">
              <span class="name" class:done={x.tk.column === 'done'}>{x.tk.title}</span>
              {#if x.carried}<span class="carried">{tp(x.carried, 'Carried over · {n} week', 'Carried over · {n} weeks')}</span>{/if}
              {#each x.matchedSubs as m (m.s.id)}
                <span class="sub">› {m.s.title}{m.ms ? ` · ${fmtDur(m.ms)}` : ''}{m.s.done ? ' ✓' : ''}</span>
              {/each}
              {#if !query && x.tk.subtasks.length}<span class="sub muted">{t('{a} of {b}', { a: x.tk.subtasks.filter((s) => s.done).length, b: x.tk.subtasks.length })} {t('subtasks')}</span>{/if}
            </span>
            <span><span class="pill" class:fin={x.tk.column === 'done'}>{colName(x.tk.column)}</span></span>
            <span class="muted num">{fmtDayShort(x.started)}</span>
            <span class="muted num">{x.tk.completedAt ? fmtDayShort(x.tk.completedAt) : '—'}</span>
            <span class="r time">
              <span class="num" class:over={x.tk.estimate > 0 && x.ms > x.tk.estimate * 60000}>{fmtDur(x.ms)}{x.tk.estimate ? ` / ${fmtDur(x.tk.estimate * 60000)}` : ''}</span>
              {#if x.tk.estimate}<span class="bar"><span style:width="{Math.min(100, (x.ms / (x.tk.estimate * 60000)) * 100)}%"></span></span>{/if}
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .page { padding: 26px 30px 40px; display: flex; flex-direction: column; gap: 16px; }
  h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; }
  .small { font-size: 12px; }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .search { flex: 1 1 260px; max-width: 420px; display: flex; align-items: center; gap: 8px; padding: 0 10px 0 12px; min-height: 38px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-3); }
  .search:focus-within { border-color: var(--ink); }
  .search input { flex: 1; border: 0; outline: none; background: transparent; min-height: 36px; color: var(--ink); }
  .proj { width: auto; min-width: 180px; }
  .empty { align-items: center; text-align: center; display: flex; flex-direction: column; gap: 8px; padding: 40px; color: var(--ink-2); }
  .group { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; }
  .gh { display: flex; align-items: center; gap: 10px; }
  .gh h2 { margin: 0; font-size: 17px; font-weight: 600; flex: 1; }
  .arch { font-size: 13px; font-weight: 400; }
  .gt { font-weight: 600; }
  .badge { width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; }
  .table { display: flex; flex-direction: column; overflow-x: auto; }
  .thead, .tr { display: grid; grid-template-columns: minmax(220px, 1fr) 110px 100px 100px 170px; gap: 12px; align-items: center; min-width: 760px; }
  .thead { font-size: 12px; color: var(--ink-3); padding: 4px 8px; }
  .tr { border: 0; background: transparent; text-align: left; padding: 9px 8px; border-top: 1px solid #eef0f3; border-radius: 8px; font-size: 13px; }
  .tr:hover { background: var(--sunken); }
  .r { text-align: right; justify-self: end; }
  .tt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .name { font-weight: 600; font-size: 14px; }
  .name.done { color: var(--ink-2); }
  .sub { font-size: 12px; color: var(--ink-2); }
  .carried { align-self: flex-start; font-size: 11px; font-weight: 600; color: #8a1c12; background: #fdecea; border-radius: 6px; padding: 1px 6px; }
  .pill { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--sunken); color: var(--ink-2); white-space: nowrap; }
  .pill.fin { background: var(--c); color: #fff; }
  .time { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .time .over { color: #b42318; }
  .bar { width: 110px; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 4px; background: var(--c); }
</style>
