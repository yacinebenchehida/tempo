<script lang="ts">
  import { fly } from 'svelte/transition';
  import { ui } from '../lib/store.svelte';

  $effect(() => {
    if (!ui.toast) return;
    const k = ui.toast.key;
    const t = setTimeout(() => {
      if (ui.toast?.key === k) ui.toast = null;
    }, 2600);
    return () => clearTimeout(t);
  });
</script>

{#if ui.toast}
  {#key ui.toast.key}
    <div class="toast" role="status" transition:fly={{ y: 16, duration: 220 }}>{ui.toast.text}</div>
  {/key}
{/if}

<style>
  .toast { position: fixed; bottom: 24px; left: 50%; translate: -50% 0; background: var(--ink); color: #fff; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 500; z-index: 70; box-shadow: var(--shadow-pop); }
</style>
