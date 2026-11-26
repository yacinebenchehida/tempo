/** Project colours, in assignment order. Checked for contrast on white and
 *  for colour-blind separation of neighbours; projects also always carry a
 *  name and a mascot, so colour is never the only way to tell them apart. */
export const PALETTE = [
  { hex: '#2F6DB5', name: 'Blue' },
  { hex: '#E0663F', name: 'Coral' },
  { hex: '#1E9E8A', name: 'Teal' },
  { hex: '#8257C9', name: 'Violet' },
  { hex: '#B7860B', name: 'Amber' },
  { hex: '#C93F7A', name: 'Raspberry' },
  { hex: '#4A8F35', name: 'Green' },
  { hex: '#5B6BD6', name: 'Indigo' },
  { hex: '#B8552B', name: 'Rust' },
  { hex: '#2A93B8', name: 'Sky' },
  { hex: '#8C9A2B', name: 'Olive' },
  { hex: '#A0529E', name: 'Plum' }
];

/** Mix a colour with white: amount 0 = white, 1 = the colour. */
export function tint(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixed = ch.map((c) => Math.round(255 + (c - 255) * amount));
  return '#' + mixed.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Stroke-drawn animals on a 24×24 grid. `E` marks an eye (filled dot). */
const E = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r=".75" fill="currentColor" stroke="none"/>`;

export const MASCOTS: Record<string, { label: string; svg: string }> = {
  porpoise: { label: 'Porpoise', svg: `<path d="M3 13.2C5.6 8.9 11 7.6 15.3 9.4c2.2.9 3.9 2.5 5.2 4.2-1.9.8-4.1 1-6.3.6l-3 1.8c-3 .9-6.1.1-8.2-2.8z"/><path d="M11.6 8.7l1.6-3.1 1.1 3.7"/><path d="M3 13.2l-1.6-2.3M3 13.2l-1.4 2.4"/><path d="M12.5 13.4c.8.6 1.8.8 2.8.6"/>${E(17.2, 12)}` },
  hedgehog: { label: 'Hedgehog', svg: `<path d="M3.5 17c0-4.7 3.6-8.3 8.2-8.3 3 0 5.5 1.6 6.9 4l2.4 1.4-2.2 1.3c-.7 1-1.8 1.6-3.2 1.6H3.5z"/><path d="M5.5 12.2L3.8 10.4M8.4 10.1L7.9 7.6M11.8 9.1l.8-2.5M15.2 9.8l1.9-1.9"/><path d="M8 17v1.8M14 17v1.8"/>${E(17.6, 13.3)}` },
  bee: { label: 'Bee', svg: `<ellipse cx="12" cy="14.5" rx="6" ry="4.3"/><path d="M10.6 10.4v8.2M14 10.4v8.2"/><path d="M10.4 10.3C8.6 7.2 9.3 4.6 11.2 5s1.6 3.3.6 5.2"/><path d="M13.3 10.2c1.7-3 4.3-3.8 5.2-2.4s-1.4 3.2-3.9 3.1"/><path d="M18 14.5h2.4"/>${E(7.9, 13.6)}` },
  fox: { label: 'Fox', svg: `<path d="M4 4.5l4.5 4h7l4.5-4v8.5c0 4.2-3.6 7.5-8 7.5s-8-3.3-8-7.5z"/><path d="M8 15.5l4 4.5 4-4.5"/><path d="M11.2 15.6h1.6l-.8 1z"/>${E(9.3, 12.6)}${E(14.7, 12.6)}` },
  owl: { label: 'Owl', svg: `<path d="M6 9c0-3 2.5-5 6-5s6 2 6 5v6.5c0 3.4-2.7 5.5-6 5.5s-6-2.1-6-5.5z"/><path d="M6.3 6.2L5 3.5l3.2 1.4M17.7 6.2L19 3.5l-3.2 1.4"/><circle cx="9.5" cy="10.5" r="2"/><circle cx="14.5" cy="10.5" r="2"/><path d="M11.3 13l.7 1.4.7-1.4"/><path d="M9.5 17.5l1 1 1.5-1 1.5 1 1-1"/>${E(9.5, 10.5)}${E(14.5, 10.5)}` },
  cat: { label: 'Cat', svg: `<path d="M5 8.2V3.5l4 3.2h6l4-3.2v4.7c1 1.3 1.5 2.8 1.5 4.3 0 4.4-3.8 7.5-8.5 7.5s-8.5-3.1-8.5-7.5c0-1.5.5-3 1.5-4.3z"/><path d="M1.8 13h4M2.2 15.8l3.8-1M22.2 13h-4M21.8 15.8l-3.8-1"/><path d="M11.2 14h1.6l-.8 1z"/>${E(9, 11.5)}${E(15, 11.5)}` },
  snail: { label: 'Snail', svg: `<circle cx="11" cy="11.5" r="5.5"/><path d="M11 11.5a1.8 1.8 0 1 1 1.8 1.8c-1.8 0-3.6-1.4-3.6-3.4 0-2.2 1.9-3.8 4-3.6"/><path d="M2.5 18.5h14.5c2.3 0 4-1.6 4-3.8V12"/><path d="M21 12l-1.3-3.4M21 12l1.4-3.2"/>` },
  butterfly: { label: 'Butterfly', svg: `<path d="M12 9C10 5 5 3.8 3.8 6.2 2.6 8.8 5.6 12 12 12"/><path d="M12 9c2-4 7-5.2 8.2-2.8 1.2 2.6-1.8 5.8-8.2 5.8"/><path d="M12 12c-3 0-6.2 1.6-5.6 4.4.7 2.6 4.2 1.3 5.6-2.4"/><path d="M12 12c3 0 6.2 1.6 5.6 4.4-.7 2.6-4.2 1.3-5.6-2.4"/><path d="M12 8v11M12 8l-1.8-3M12 8l1.8-3"/>` },
  turtle: { label: 'Turtle', svg: `<path d="M3.5 15.5c0-4.6 3.8-8.3 8.5-8.3s8.5 3.7 8.5 8.3z"/><path d="M8 15.5l1.5-4.3h5l1.5 4.3M12 7.2v4"/><path d="M20.5 13.8c1.4.1 2.3-.7 2.3-1.8s-1-1.9-2.2-1.7"/><path d="M6 15.5v2.5M17.5 15.5v2.5"/>` },
  frog: { label: 'Frog', svg: `<path d="M3.5 15.2c0-3.9 3.8-6.7 8.5-6.7s8.5 2.8 8.5 6.7-3.8 5.3-8.5 5.3-8.5-1.4-8.5-5.3z"/><circle cx="8" cy="8.5" r="2.4"/><circle cx="16" cy="8.5" r="2.4"/><path d="M8.5 15c2 1.6 5 1.6 7 0"/>${E(8, 8.5)}${E(16, 8.5)}` },
  bird: { label: 'Bird', svg: `<path d="M3.5 14c0-4 3-7 7-7 3 0 5.2 2 5.7 4.5l4.8.7-4.6 1.6c-1 3.4-3.5 5.2-7 5.2H3.5l2-2.5z"/><path d="M8 13.5c1.6 1.6 4 1.6 5.5 0"/><path d="M9 19v2M12 18.6v2.4"/>${E(13.5, 10.4)}` },
  fish: { label: 'Fish', svg: `<path d="M2.5 12c3-4.5 9.5-6 14.5-2l4-3v10l-4-3c-5 4-11.5 2.5-14.5-2z"/><path d="M10.5 9.3c1.1 1.6 1.1 3.8 0 5.4"/>${E(6.8, 11.4)}` },
  rabbit: { label: 'Rabbit', svg: `<circle cx="12" cy="15" r="5.5"/><path d="M9.6 10V4.3c0-1.3 2-1.3 2 0V9.6M12.4 9.6V4.3c0-1.3 2-1.3 2 0V10"/><path d="M11.3 16.3h1.4l-.7.9z"/><path d="M12 17.2v1"/>${E(10, 14.4)}${E(14, 14.4)}` },
  mouse: { label: 'Mouse', svg: `<path d="M3 16c0-4.3 3.7-7.5 8.3-7.5 3.6 0 6.6 2.1 7.6 5.2L21.5 16H3z"/><circle cx="10.5" cy="7.7" r="2.6"/><path d="M3 16c-1.2 1.5-.6 3.8 1.6 4.1"/>${E(16.4, 12.8)}` },
  octopus: { label: 'Octopus', svg: `<path d="M6 11.5a6 6 0 0 1 12 0V15H6z"/><path d="M6 15c0 2.7-1.8 3.8-3 3.8M9.5 15c0 2.8-.8 4.6-2 5.6M14.5 15c0 2.8.8 4.6 2 5.6M18 15c0 2.7 1.8 3.8 3 3.8M12 15v5"/>${E(9.6, 11)}${E(14.4, 11)}` },
  ladybird: { label: 'Ladybird', svg: `<circle cx="12" cy="13.8" r="6.5"/><path d="M8.6 8.6a3.6 3.6 0 0 1 6.8 0"/><path d="M12 7.6v12.7"/><path d="M10 6l-1.5-2.2M14 6l1.5-2.2"/><circle cx="9" cy="12.5" r=".9" fill="currentColor"/><circle cx="15" cy="12.5" r=".9" fill="currentColor"/><circle cx="9.4" cy="16.5" r=".9" fill="currentColor"/><circle cx="14.6" cy="16.5" r=".9" fill="currentColor"/>` },
  penguin: { label: 'Penguin', svg: `<path d="M7 20.5c-1-3-1.2-9.2.9-13.3C9.8 3.6 14.2 3.6 16.1 7.2c2.1 4.1 1.9 10.3.9 13.3z"/><path d="M10 20c-.7-2.6-.7-6.2.5-8.7h3c1.2 2.5 1.2 6.1.5 8.7"/><path d="M11.2 9l.8 1.1.8-1.1"/><path d="M7 20.5h3.4M13.6 20.5H17"/>${E(10.4, 7.8)}${E(13.6, 7.8)}` },
  crab: { label: 'Crab', svg: `<ellipse cx="12" cy="14.5" rx="6.5" ry="4"/><path d="M5.6 11c-2.1-.8-2.8-3.3-1.4-4.6l1.4 2.1 1.1-2.4c1.1 1.5.9 3.3-.3 4.2"/><path d="M18.4 11c2.1-.8 2.8-3.3 1.4-4.6l-1.4 2.1-1.1-2.4c-1.1 1.5-.9 3.3.3 4.2"/><path d="M6.6 16.8l-3 1.8M7.8 18l-2 2.6M17.4 16.8l3 1.8M16.2 18l2 2.6"/><path d="M10.2 10.6V8.8M13.8 10.6V8.8"/>${E(10.2, 8.6)}${E(13.8, 8.6)}` }
};

export const MASCOT_KEYS = Object.keys(MASCOTS);
