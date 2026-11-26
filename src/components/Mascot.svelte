<script lang="ts">
  import { MASCOTS } from '../lib/palette';
  let { kind, color = 'currentColor', size = 20, label = '' }: { kind: string; color?: string; size?: number; label?: string } = $props();
  const m = $derived(MASCOTS[kind] ?? MASCOTS.porpoise);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  style:color
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
  style="flex: none">{@html m.svg}</svg>
