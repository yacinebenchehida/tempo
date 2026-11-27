// Ambient sounds, all generated in code with the Web Audio API: no audio files.
// Noise "colours" are pre-computed into seamless stereo loops; wind and ocean
// add slow live modulation so they never sound like a short repeating loop.

import { untrack } from 'svelte';
import { db } from './store.svelte';

export interface SoundDef {
  id: string;
  name: string; // English; translated at display
  icon: string;
  level: number; // loudness balance between sounds
}

export const SOUNDS: SoundDef[] = [
  { id: 'rain', name: 'Rain', icon: 'rain', level: 2.8 },
  { id: 'ocean', name: 'Ocean', icon: 'waves', level: 1.7 },
  { id: 'wind', name: 'Wind', icon: 'wind', level: 4.2 },
  { id: 'stream', name: 'Stream', icon: 'stream', level: 1.0 },
  { id: 'fire', name: 'Fire', icon: 'fire', level: 1.75 },
  { id: 'brown', name: 'Brown noise', icon: 'noise-brown', level: 1.7 },
  { id: 'pink', name: 'Pink noise', icon: 'noise-pink', level: 1.1 },
  { id: 'white', name: 'White noise', icon: 'noise', level: 0.3 }
];

export const player = $state({ playing: false });

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const chains = new Map<string, { gain: GainNode; stop: () => void }>();
let suspendTimer: ReturnType<typeof setTimeout> | null = null;

// ---------- sample generators (one channel, n samples) ----------

type Gen = (n: number, sr: number) => Float32Array;

const white: Gen = (n) => {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  return a;
};

const pink: Gen = (n) => {
  // Paul Kellet's refined filter.
  const a = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return a;
};

const brown: Gen = (n) => {
  const a = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    a[i] = last * 3.5;
  }
  return a;
};

/** One-pole high-pass, in place. */
function highpass(a: Float32Array, sr: number, hz: number) {
  const rc = 1 / (2 * Math.PI * hz);
  const k = rc / (rc + 1 / sr);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < a.length; i++) {
    const out = k * (prevOut + a[i] - prevIn);
    prevIn = a[i];
    prevOut = out;
    a[i] = out;
  }
  return a;
}

/** One-pole low-pass, in place. */
function lowpass(a: Float32Array, sr: number, hz: number) {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    y += k * (a[i] - y);
    a[i] = y;
  }
  return a;
}

const rain: Gen = (n, sr) => {
  // A soft hiss plus thousands of tiny drops of random size.
  const bed = highpass(pink(n, sr), sr, 500);
  const drops = new Float32Array(n);
  let env = 0;
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.0035) env = Math.max(env, Math.pow(Math.random(), 3) * 1.4);
    drops[i] = (Math.random() * 2 - 1) * env;
    env *= 0.992;
  }
  highpass(drops, sr, 1200);
  for (let i = 0; i < n; i++) bed[i] = bed[i] * 0.55 + drops[i] * 0.6;
  return bed;
};

const stream: Gen = (n, sr) => {
  // Band-limited noise with quick, irregular swells: running water.
  const a = lowpass(highpass(white(n, sr), sr, 350), sr, 2600);
  let wob = 0.6, target = 0.6;
  for (let i = 0; i < n; i++) {
    if (i % 1200 === 0) target = 0.45 + Math.random() * 0.55;
    wob += (target - wob) * 0.0008;
    a[i] *= wob * 1.6;
  }
  return a;
};

const fire: Gen = (n, sr) => {
  // A low, warm rumble with crackles and the odd bigger snap.
  const rumble = lowpass(brown(n, sr), sr, 300);
  const crackle = new Float32Array(n);
  let env = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.0006) env = Math.max(env, 0.3 + Math.random() * 0.7);
    else if (r < 0.00062) env = 1.6; // a snap
    crackle[i] = (Math.random() * 2 - 1) * env;
    env *= 0.965;
  }
  highpass(crackle, sr, 900);
  for (let i = 0; i < n; i++) rumble[i] = rumble[i] * 0.9 + crackle[i] * 0.55;
  return rumble;
};

const GENERATORS: Record<string, Gen> = { white, pink, brown, rain, stream, fire, wind: pink, ocean: brown };
const LOOP_SECONDS: Record<string, number> = { rain: 14, stream: 16, fire: 18 };

/** A stereo buffer whose end flows into its start without a click. */
function loopBuffer(c: AudioContext, id: string): AudioBuffer {
  const cached = buffers.get(id);
  if (cached) return cached;
  const sr = c.sampleRate;
  const n = Math.round((LOOP_SECONDS[id] ?? 12) * sr);
  const fade = Math.round(0.5 * sr);
  const buf = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = GENERATORS[id](n + fade, sr);
    const out = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) out[i] = raw[i];
    // Equal-power crossfade of the extra tail into the head.
    for (let i = 0; i < fade; i++) {
      const x = i / fade;
      out[i] = raw[i] * Math.sin((x * Math.PI) / 2) + raw[n + i] * Math.cos((x * Math.PI) / 2);
    }
  }
  buffers.set(id, buf);
  return buf;
}

function lfo(c: AudioContext, hz: number, amount: number, target: AudioParam) {
  const o = c.createOscillator();
  o.frequency.value = hz;
  const g = c.createGain();
  g.gain.value = amount;
  o.connect(g).connect(target);
  o.start();
  return o;
}

function build(c: AudioContext, def: SoundDef) {
  const src = c.createBufferSource();
  src.buffer = loopBuffer(c, def.id);
  src.loop = true;
  // Start each sound at a random point so mixes don't line up the same way every time.
  const offset = Math.random() * src.buffer.duration;
  const gain = c.createGain();
  gain.gain.value = 0;
  const extra: AudioScheduledSourceNode[] = [];

  if (def.id === 'wind') {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.9;
    const gust = c.createGain();
    gust.gain.value = 0.75;
    extra.push(lfo(c, 0.061, 260, bp.frequency), lfo(c, 0.17, 90, bp.frequency), lfo(c, 0.073, 0.45, gust.gain));
    src.connect(bp).connect(gust).connect(gain);
  } else if (def.id === 'ocean') {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    const swell = c.createGain();
    swell.gain.value = 0.6;
    extra.push(lfo(c, 0.085, 0.42, swell.gain), lfo(c, 0.085, 420, lp.frequency), lfo(c, 0.031, 0.15, swell.gain));
    src.connect(lp).connect(swell).connect(gain);
  } else {
    src.connect(gain);
  }
  gain.connect(master!);
  src.start(0, offset);
  return {
    gain,
    stop: () => {
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => {
        try {
          src.stop();
          extra.forEach((x) => x.stop());
        } catch {
          /* already stopped */
        }
        gain.disconnect();
      }, 800);
    }
  };
}

function ensureContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    // A gentle limiter so stacking several loud sounds never distorts.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(ctx.destination);
  }
  return ctx;
}

const target = (id: string) => {
  const def = SOUNDS.find((s) => s.id === id)!;
  const v = db.sound.volumes[id] ?? 0.6;
  return v * v * def.level; // squared: sliders feel even to the ear
};

/** Bring the audio graph in line with the stored choices. */
function sync() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(player.playing ? db.sound.master * db.sound.master : 0, t, player.playing ? 0.35 : 0.2);
  for (const def of SOUNDS) {
    const on = !!db.sound.on[def.id] && player.playing;
    let ch = chains.get(def.id);
    if (on && !ch) {
      ch = build(ctx, def);
      chains.set(def.id, ch);
    }
    if (on && ch) ch.gain.gain.setTargetAtTime(target(def.id), t, 0.25);
    if (!on && ch) {
      ch.stop();
      chains.delete(def.id);
    }
  }
}

export function anySelected() {
  return SOUNDS.some((s) => db.sound.on[s.id]);
}

export async function play() {
  if (!anySelected()) return;
  const c = ensureContext();
  if (suspendTimer) clearTimeout(suspendTimer);
  await c.resume();
  player.playing = true;
  sync();
}

export function pause() {
  if (!player.playing) return;
  player.playing = false;
  sync();
  // Let the fade finish, then let the audio device rest.
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => ctx?.suspend(), 1500);
}

export function togglePlay() {
  if (player.playing) pause();
  else play();
}

export function toggleSound(id: string) {
  db.sound.on[id] = !db.sound.on[id];
  if (db.sound.on[id] && db.sound.volumes[id] === undefined) db.sound.volumes[id] = 0.6;
  if (!anySelected()) pause();
}

/** Keep the sound in step with stored changes (volumes, selections). */
export function startSoundSync() {
  $effect.root(() => {
    $effect(() => {
      // Read everything sync() depends on, so changes re-run it.
      JSON.stringify(db.sound.on);
      JSON.stringify(db.sound.volumes);
      void db.sound.master;
      void player.playing;
      sync();
    });
    // Optional link with the timer (off unless chosen in Settings).
    $effect(() => {
      if (!db.sound.withTimer) return;
      const phase = db.timer.phase;
      untrack(() => (phase === 'work' ? play() : pause()));
    });
  });
}
