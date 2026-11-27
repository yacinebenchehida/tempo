<script lang="ts">
  let { name, size = 16, stroke = 1.9 }: { name: string; size?: number; stroke?: number } = $props();
  const P: Record<string, string> = {
    board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chart: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="5.5" y="4" width="4.5" height="16" rx="1.4" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4.5" height="16" rx="1.4" fill="currentColor" stroke="none"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor" stroke="none"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    flag: '<path d="M5 21V4h12l-2.5 4.5L17 13H5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    skip: '<path d="M5 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/>',
    rain: '<path d="M7 15a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.8 7.6 3.8 3.8 0 0 1 17 15"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
    waves: '<path d="M2.5 9c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 3-1.6"/><path d="M2.5 13.5c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 3-1.6"/><path d="M2.5 18c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 3-1.6"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 17h6"/>',
    stream: '<path d="M4 5c3 1.5 3 4 0 5.5s-3 4 0 5.5"/><path d="M11 5c3 1.5 3 4 0 5.5s-3 4 0 5.5 3 4 0 5.5"/><path d="M18 3c3 1.5 3 4 0 5.5s-3 4 0 5.5"/>',
    fire: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.3 2.5-5.2 3.5-8 1.6 1.4 2.3 3 2.4 4.6C13 10 13.6 7.6 13 4.5c3.4 2 5.5 5.5 5.5 10.2 0 3.6-2.6 6.3-6.5 6.3z"/><path d="M12 21c-1.7 0-2.8-1.1-2.8-2.7 0-1.8 1.5-2.6 2.1-4.3 1.6 1 3.5 2.4 3.5 4.4 0 1.5-1.1 2.6-2.8 2.6z"/>',
    'noise-brown': '<path d="M2.5 12c2.2 0 2.6-5 5-5s2.6 10 5 10 2.6-8 5-8 2.2 3 4 3"/>',
    'noise-pink': '<path d="M2.5 12h1.3l1.4-4 1.6 8 1.6-9 1.6 10 1.6-7 1.6 5 1.6-8 1.6 9 1.6-6 1.4 2H21.5"/>',
    noise: '<path d="M3 12h1.5l1.2-5 1.6 10 1.6-13 1.6 15 1.6-11 1.6 8 1.6-12 1.6 13 1.6-7 1.2 2H21"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    sound: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none">{@html P[name] ?? ''}</svg>
