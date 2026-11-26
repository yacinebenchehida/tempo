<script lang="ts">
  import { ui } from '../lib/store.svelte';

  const N = 14;
  const parts = $derived.by(() => {
    const c = ui.celebrate;
    if (!c) return [];
    return Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const d = 40 + Math.random() * 46;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 18, size: 5 + Math.random() * 5, round: i % 3 !== 0, color: i % 4 === 0 ? '#16181D' : c.color };
    });
  });

  $effect(() => {
    if (!ui.celebrate) return;
    const k = ui.celebrate.key;
    const t = setTimeout(() => {
      if (ui.celebrate?.key === k) ui.celebrate = null;
    }, 1000);
    return () => clearTimeout(t);
  });
</script>

{#if ui.celebrate}
  {#key ui.celebrate.key}
    <div class="burst" style:left="{ui.celebrate.x}px" style:top="{ui.celebrate.y}px" aria-hidden="true">
      {#each parts as p}
        <span style:--dx="{p.dx}px" style:--dy="{p.dy}px" style:width="{p.size}px" style:height="{p.size}px" style:background={p.color} style:border-radius={p.round ? '50%' : '2px'}></span>
      {/each}
    </div>
  {/key}
{/if}

<style>
  .burst { position: fixed; width: 0; height: 0; z-index: 60; pointer-events: none; }
  span { position: absolute; left: 0; top: 0; animation: fly 0.85s cubic-bezier(0.15, 0.8, 0.3, 1) forwards; }
  @keyframes fly {
    0% { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
    70% { opacity: 1; }
    100% { transform: translate(calc(var(--dx) - 50%), calc(var(--dy) + 24px - 50%)) scale(1) rotate(160deg); opacity: 0; }
  }
</style>
