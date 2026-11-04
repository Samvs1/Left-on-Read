/**
 * The Wrapped soundtrack, synthesised sample by sample in plain TypeScript
 * (no Web Audio graph, no samples, no files), so it renders in well under a
 * second, off the main thread, and identically on every device.
 *
 * A small house-pop track at 128 BPM: kick, clap, hats, an offbeat bass, warm
 * detuned pads, a plucked arpeggio through a ping-pong delay, all glued with a
 * Freeverb-style reverb, sidechain pumping and a gentle compressor. The
 * arrangement follows the video: the drop lands on the first stat, the
 * breakdown on the personality reveal, the finale on the summary.
 */
import { BAR, BEAT } from './timeline';
import type { SceneId } from './data';

export const SAMPLE_RATE = 48_000;
const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;

export interface SynthScene {
  id: SceneId;
  bars: number;
}

/** Fmaj7 · G · Em7 · Am7 */
const PROGRESSION = [
  { root: 41, chord: [53, 57, 60, 64] },
  { root: 43, chord: [55, 59, 62, 67] },
  { root: 40, chord: [52, 55, 59, 62] },
  { root: 45, chord: [57, 60, 64, 67] },
];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/* ------------------------------------------------------------------ */
/* DSP building blocks                                                  */
/* ------------------------------------------------------------------ */

function noiseGen(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  z1 = 0;
  z2 = 0;
  set(type: 'lp' | 'hp' | 'bp', f: number, q: number) {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number, b1: number, b2: number;
    if (type === 'lp') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = (1 - cw) / 2;
    } else if (type === 'hp') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = (1 + cw) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }
  run(x: number) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

function polyblep(t: number, dt: number) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Exponential approach from a to b with time constant tc (seconds). */
const expTo = (a: number, b: number, t: number, tc: number) => b + (a - b) * Math.exp(-t / tc);

/* ------------------------------------------------------------------ */
/* One-shots (rendered once, mixed many times)                          */
/* ------------------------------------------------------------------ */

type Mono = Float32Array;
type Stereo = [Float32Array, Float32Array];

function kickShot(): Mono {
  const n = Math.round(0.45 * SR);
  const out = new Float32Array(n);
  const rnd = noiseGen(9);
  const hp = new Biquad().set('hp', 2500, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 42 + 123 * Math.exp(-t / 0.035);
    ph += f / SR;
    const amp = (t < 0.003 ? t / 0.003 : 1) * Math.exp(-t / 0.11);
    const click = t < 0.012 ? hp.run(rnd()) * 0.25 * (1 - t / 0.012) : 0;
    out[i] = Math.sin(TAU * ph) * amp * 0.95 + click;
  }
  return out;
}

function clapShot(seed: number): Mono {
  const n = Math.round(0.32 * SR);
  const out = new Float32Array(n);
  const rnd = noiseGen(seed);
  const bp = new Biquad().set('bp', 1450, 0.85);
  const bursts: [number, number, number][] = [
    [0, 0.5, 0.012],
    [0.011, 0.42, 0.012],
    [0.024, 0.62, 0.07],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = 0;
    for (const [dt, amp, tc] of bursts) if (t >= dt) env += amp * Math.exp(-(t - dt) / tc) * (t - dt < 0.002 ? (t - dt) / 0.002 : 1);
    out[i] = bp.run(rnd()) * env * 1.3;
  }
  return out;
}

function hatShot(seed: number, open: boolean): Mono {
  const n = Math.round((open ? 0.32 : 0.09) * SR);
  const out = new Float32Array(n);
  const rnd = noiseGen(seed);
  const hp = new Biquad().set('hp', 7800, 0.7);
  const tc = open ? 0.08 : 0.016;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = hp.run(rnd()) * Math.exp(-t / tc) * (t < 0.001 ? t / 0.001 : 1) * 0.5;
  }
  return out;
}

function bassShot(midi: number, len: number): Mono {
  const n = Math.round((len + 0.02) * SR);
  const out = new Float32Array(n);
  const f = freq(midi);
  const dt = f / SR;
  const lp = new Biquad();
  let ph = 0;
  let sub = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 32 === 0) lp.set('lp', expTo(1500, 240, t, len / 2.2), 5);
    ph += dt;
    if (ph >= 1) ph -= 1;
    sub += dt / 2;
    if (sub >= 1) sub -= 1;
    const saw = 2 * ph - 1 - polyblep(ph, dt);
    const s = lp.run(saw) + Math.sin(TAU * sub) * 0.55;
    const env = t < 0.006 ? t / 0.006 : t < len * 0.7 ? 1 : Math.max(0, 1 - (t - len * 0.7) / (len * 0.3));
    out[i] = s * env * 0.3;
  }
  return out;
}

function pluckShot(midi: number): Mono {
  const n = Math.round(0.26 * SR);
  const out = new Float32Array(n);
  const f = freq(midi);
  const dt = f / SR;
  const lp = new Biquad();
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 32 === 0) lp.set('lp', expTo(4200, 700, t, 0.07), 0.9);
    ph += dt;
    if (ph >= 1) ph -= 1;
    const tri = 4 * Math.abs(ph - 0.5) - 1;
    const sq = (ph < 0.5 ? 1 : -1) + polyblep(ph, dt) - polyblep((ph + 0.5) % 1, dt);
    const env = (t < 0.003 ? t / 0.003 : 1) * Math.exp(-t / 0.075);
    out[i] = lp.run(tri + sq * 0.25) * env * 0.16;
  }
  return out;
}

/** A sustained chord: two detuned saws per note spread left/right, through a sweeping lowpass. */
function padShot(notes: number[], len: number, bright: number, level: number): Stereo {
  const rel = 0.45;
  const n = Math.round((len + rel) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const voices = notes.flatMap((m) => [
    { dt: (freq(m) * 2 ** (-8 / 1200)) / SR, ph: (m * 0.137) % 1, left: 0.8 },
    { dt: (freq(m) * 2 ** (7 / 1200)) / SR, ph: (m * 0.291) % 1, left: 0.2 },
  ]);
  const fl = new Biquad();
  const fr = new Biquad();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 64 === 0) {
      const c = bright * (0.6 + 0.4 * Math.min(1, t / (len * 0.6)));
      fl.set('lp', c, 0.7);
      fr.set('lp', c, 0.7);
    }
    let sl = 0;
    let sr = 0;
    for (const v of voices) {
      v.ph += v.dt;
      if (v.ph >= 1) v.ph -= 1;
      const s = 2 * v.ph - 1 - polyblep(v.ph, v.dt);
      sl += s * v.left;
      sr += s * (1 - v.left);
    }
    const env = t < 0.25 ? t / 0.25 : t < len ? 1 : Math.max(0, 1 - (t - len) / rel);
    L[i] = fl.run(sl) * env * level;
    R[i] = fr.run(sr) * env * level;
  }
  return [L, R];
}

function riserShot(len: number, level: number): Mono {
  const n = Math.round(len * SR);
  const out = new Float32Array(n);
  const rnd = noiseGen(77);
  const bp = new Biquad();
  for (let i = 0; i < n; i++) {
    const x = i / n;
    if (i % 64 === 0) bp.set('bp', 350 * 20 ** x, 1.4);
    out[i] = bp.run(rnd()) * level * x ** 2.2 * (x > 0.97 ? (1 - x) / 0.03 : 1) * 2.2;
  }
  return out;
}

function whooshShot(): Mono {
  const len = BEAT * 0.75;
  const n = Math.round((len + 0.05) * SR);
  const out = new Float32Array(n);
  const rnd = noiseGen(55);
  const bp = new Biquad();
  for (let i = 0; i < n; i++) {
    const x = Math.min(1, i / (len * SR));
    if (i % 64 === 0) bp.set('bp', 600 * (5200 / 600) ** x, 2);
    const env = i < len * SR ? x ** 2 : Math.max(0, 1 - (i - len * SR) / (0.05 * SR));
    out[i] = bp.run(rnd()) * env * 0.16;
  }
  return out;
}

function impactShot(level: number): Mono {
  const n = Math.round(1.6 * SR);
  const out = new Float32Array(n);
  const rnd = noiseGen(31);
  const hp = new Biquad().set('hp', 5200, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (32 + 58 * Math.exp(-t / 0.35)) / SR;
    const boom = Math.sin(TAU * ph) * Math.exp(-t / 0.35) * (t < 0.004 ? t / 0.004 : 1) * 0.55;
    const crash = hp.run(rnd()) * Math.exp(-t / 0.45) * 0.16;
    out[i] = (boom + crash) * level;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Effects                                                              */
/* ------------------------------------------------------------------ */

/**
 * Freeverb (Jezar's public-domain design): 8 damped combs + 4 allpasses per
 * channel. It runs at half the sample rate (a reverb tail has little energy
 * up there) and each filter is its own tight loop over the buffer.
 */
function reverb(input: Float32Array, wet: number): Stereo {
  const rate = SR / 2;
  const scale = rate / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const n = input.length;
  const m = Math.ceil(n / 2);
  const x = new Float32Array(m);
  for (let k = 0; k < m; k++) x[k] = ((input[2 * k] ?? 0) + (input[2 * k + 1] ?? 0)) * 0.0075;
  const feedback = 0.84;
  const damp = 0.3;
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const acc = new Float32Array(m);
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch === 0 ? 0 : 23;
    acc.fill(0);
    for (const c of combs) {
      const len = Math.round((c + spread) * scale);
      const buf = new Float32Array(len);
      let idx = 0;
      let store = 0;
      for (let k = 0; k < m; k++) {
        const y = buf[idx]!;
        store = y * (1 - damp) + store * damp;
        buf[idx] = x[k]! + store * feedback;
        if (++idx === len) idx = 0;
        acc[k]! += y;
      }
    }
    for (const a of aps) {
      const len = Math.round((a + spread) * scale);
      const buf = new Float32Array(len);
      let idx = 0;
      for (let k = 0; k < m; k++) {
        const b = buf[idx]!;
        const v = acc[k]!;
        buf[idx] = v + b * 0.5;
        if (++idx === len) idx = 0;
        acc[k] = b - v;
      }
    }
    // Back to full rate with linear interpolation.
    const o = out[ch]!;
    for (let k = 0; k < m; k++) {
      const a0 = acc[k]! * wet;
      const a1 = (k + 1 < m ? acc[k + 1]! : 0) * wet;
      o[2 * k] = a0;
      if (2 * k + 1 < n) o[2 * k + 1] = (a0 + a1) * 0.5;
    }
  }
  return out;
}

/** Ping-pong delay with a darkening feedback loop. */
function pingPong(input: Float32Array, time: number, fb: number, wet: number): Stereo {
  const d = Math.round(time * SR);
  const n = input.length;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bl = new Float32Array(d);
  const br = new Float32Array(d);
  let i = 0;
  let lpL = 0;
  let lpR = 0;
  const a = 1 - Math.exp((-TAU * 2800) / SR);
  for (let k = 0; k < n; k++) {
    const yl = bl[i]!;
    const yr = br[i]!;
    lpL += a * (yl - lpL);
    lpR += a * (yr - lpR);
    bl[i] = input[k]! + lpR * fb;
    br[i] = lpL * fb;
    if (++i >= d) i = 0;
    L[k] = yl * wet;
    R[k] = yr * wet;
  }
  return [L, R];
}

/* ------------------------------------------------------------------ */
/* Arrangement                                                          */
/* ------------------------------------------------------------------ */

type Section = 'intro' | 'full' | 'break' | 'finale' | 'end';

function addMono(dst: Float32Array, src: Float32Array, at: number, gain = 1) {
  const o = Math.round(at * SR);
  const end = Math.min(dst.length, o + src.length);
  for (let i = Math.max(0, o); i < end; i++) dst[i]! += src[i - o]! * gain;
}

function addPan(L: Float32Array, R: Float32Array, src: Float32Array, at: number, gain: number, pan: number) {
  const a = (pan + 1) * (Math.PI / 4);
  addMono(L, src, at, gain * Math.cos(a));
  addMono(R, src, at, gain * Math.sin(a));
}

export interface Rendered {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

export function renderSoundtrackPCM(scenes: SynthScene[], duration: number): Rendered {
  const n = Math.ceil(duration * SR);
  const drumsL = new Float32Array(n);
  const drumsR = new Float32Array(n);
  const musL = new Float32Array(n);
  const musR = new Float32Array(n);
  const fxL = new Float32Array(n);
  const fxR = new Float32Array(n);
  const revSend = new Float32Array(n);
  const dlySend = new Float32Array(n);
  const kicks: number[] = [];

  // Sample bank.
  const kick = kickShot();
  const claps = [clapShot(3), clapShot(4), clapShot(5)];
  const hats = [hatShot(11, false), hatShot(12, false), hatShot(13, false), hatShot(14, false)];
  const openHat = hatShot(21, true);
  const bassCache = new Map<string, Mono>();
  const bass = (m: number, len: number) => {
    const k = `${m}:${len.toFixed(3)}`;
    let b = bassCache.get(k);
    if (!b) bassCache.set(k, (b = bassShot(m, len)));
    return b;
  };
  const pluckCache = new Map<number, Mono>();
  const pluck = (m: number) => {
    let p = pluckCache.get(m);
    if (!p) pluckCache.set(m, (p = pluckShot(m)));
    return p;
  };
  const padCache = new Map<string, Stereo>();
  const pad = (h: number, bright: number, level: number, len: number, extra: number[] = []) => {
    const k = `${h}:${bright}:${level}:${len}:${extra.join(',')}`;
    let p = padCache.get(k);
    if (!p) padCache.set(k, (p = padShot([...PROGRESSION[h]!.chord, ...extra], len, bright, level)));
    return p;
  };
  const whoosh = whooshShot();
  const riser = riserShot(BAR, 0.16);
  const riserHalf = riserShot(BAR / 2, 0.11);

  const bars: { section: Section; scene: SceneId; first: boolean }[] = [];
  for (const sc of scenes) {
    for (let b = 0; b < sc.bars; b++) {
      const section: Section = sc.id === 'intro' ? 'intro' : sc.id === 'persona' ? 'break' : sc.id === 'summary' ? (b === sc.bars - 1 ? 'end' : 'finale') : 'full';
      bars.push({ section, scene: sc.id, first: b === 0 });
    }
  }

  let hatIdx = 0;
  let clapIdx = 0;
  bars.forEach((bar, i) => {
    const t0 = i * BAR;
    if (t0 >= duration) return;
    const h = i % PROGRESSION.length;
    const harmony = PROGRESSION[h]!;
    const { section } = bar;
    if (bar.first && i > 0) addPan(fxL, fxR, whoosh, t0 - BEAT * 0.75, 1, 0);
    if (bar.first && (bar.scene === 'messages' || bar.scene === 'awards' || bar.scene === 'summary')) {
      const imp = impactShot(bar.scene === 'summary' ? 1.15 : 0.9);
      addPan(fxL, fxR, imp, t0, 1, 0);
      addMono(revSend, imp, t0, 0.5);
    }
    if (section === 'end') {
      const imp = impactShot(0.7);
      addPan(fxL, fxR, imp, t0, 1, 0);
    }

    // Pads carry the harmony everywhere.
    const p =
      section === 'end'
        ? pad(h, 2600, 0.03, BAR * 1.2, [harmony.chord[0]! + 12, harmony.chord[2]! + 12])
        : pad(h, section === 'intro' ? (i === 0 ? 900 : 1400) : section === 'break' ? 2400 : 1700, section === 'break' ? 0.038 : 0.03, BAR);
    addMono(musL, p[0], t0);
    addMono(musR, p[1], t0);
    addMono(revSend, p[0], t0, 0.5);
    addMono(revSend, p[1], t0, 0.5);

    const drumsOn = section === 'full' || section === 'finale' || (section === 'intro' && i >= 1);
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * BEAT;
      if (drumsOn) {
        const kv = section === 'intro' ? 0.8 : 1;
        addPan(drumsL, drumsR, kick, tb, kv, 0);
        kicks.push(tb);
        if (b % 2 === 1 && section !== 'intro') {
          const c = claps[clapIdx++ % claps.length]!;
          addPan(drumsL, drumsR, c, tb, 1, 0.05);
          addMono(revSend, c, tb, 0.35);
        }
        const off = b === 3 && section === 'finale' ? openHat : hats[hatIdx++ % hats.length]!;
        addPan(drumsL, drumsR, off, tb + BEAT / 2, 0.85, 0.25);
        addPan(drumsL, drumsR, hats[hatIdx++ % hats.length]!, tb, 0.3, -0.25);
        if (section === 'finale') {
          addPan(drumsL, drumsR, hats[hatIdx++ % hats.length]!, tb + BEAT / 4, 0.22, -0.4);
          addPan(drumsL, drumsR, hats[hatIdx++ % hats.length]!, tb + (3 * BEAT) / 4, 0.22, 0.4);
        }
      } else if (section === 'intro') {
        addPan(drumsL, drumsR, hats[hatIdx++ % hats.length]!, tb + BEAT / 2, 0.35, 0.2);
      }
      if (section === 'full' || section === 'finale') {
        addPan(musL, musR, bass(harmony.root, BEAT * 0.42), tb + BEAT / 2, b === 3 ? 0.9 : 1, 0);
        if (b === 1) addPan(musL, musR, bass(harmony.root + 12, BEAT * 0.18), tb + BEAT * 0.25, 0.6, 0);
      }
    }
    if (section !== 'end' && (section !== 'intro' || i >= 1)) {
      for (let s = 0; s < 16; s++) {
        const note = harmony.chord[ARP[s]! % harmony.chord.length]! + 12;
        const vel = (section === 'break' ? 0.9 : s % 4 === 0 ? 1 : 0.7) * (section === 'intro' ? 0.6 : 1);
        const shot = pluck(note);
        const at = t0 + (s * BEAT) / 4;
        addPan(musL, musR, shot, at, vel, s % 2 ? 0.3 : -0.3);
        addMono(dlySend, shot, at, vel * 0.5);
        addMono(revSend, shot, at, vel * 0.25);
      }
    }
    const next = bars[i + 1];
    if (next && next.section === 'finale' && section === 'break') {
      addPan(fxL, fxR, riser, t0, 1, 0);
      addMono(revSend, riser, t0, 0.4);
    }
    if (section === 'intro' && i === 1) addPan(fxL, fxR, riserHalf, t0 + BAR / 2, 1, 0);
  });

  // Effects.
  const [dl, dr] = pingPong(dlySend, BEAT * 0.75, 0.34, 0.38);
  for (let k = 0; k < n; k++) revSend[k]! += (dl[k]! + dr[k]!) * 0.3;
  const [rl, rr] = reverb(revSend, 0.32);

  // Mix: music pumps against the kick; then a gentle compressor and a fade-out.
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let kp = 0;
  const duckLen = BEAT * 0.62;
  let env = 0;
  let gain = 1;
  const atk = Math.exp(-1 / (0.005 * SR));
  const rel = Math.exp(-1 / (0.22 * SR));
  const thresh = 10 ** (-16 / 20);
  const ratio = 3.2;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    while (kp + 1 < kicks.length && kicks[kp + 1]! <= t) kp++;
    let duck = 1;
    const tk = kicks[kp];
    if (tk !== undefined && t >= tk && t - tk < duckLen) {
      const x = t - tk;
      duck = x < 0.012 ? 1 - 0.58 * (x / 0.012) : 0.42 + 0.58 * ((x - 0.012) / (duckLen - 0.012));
    }
    const l = drumsL[k]! + (musL[k]! + dl[k]!) * duck + rl[k]! + fxL[k]!;
    const r = drumsR[k]! + (musR[k]! + dr[k]!) * duck + rr[k]! + fxR[k]!;
    const al = l < 0 ? -l : l;
    const ar = r < 0 ? -r : r;
    const peak = al > ar ? al : ar;
    env = peak > env ? atk * env + (1 - atk) * peak : rel * env + (1 - rel) * peak;
    // The gain moves slowly, so it is only recomputed every 16 samples.
    if ((k & 15) === 0) gain = env > thresh ? (thresh * (env / thresh) ** (1 / ratio)) / env : 1;
    L[k] = l * gain;
    R[k] = r * gain;
  }
  // Normalise to -1 dBFS, soft-limit (Padé tanh), fade out over the final bar.
  let max = 1e-9;
  for (let k = 0; k < n; k++) {
    const a = L[k]! < 0 ? -L[k]! : L[k]!;
    const b = R[k]! < 0 ? -R[k]! : R[k]!;
    if (a > max) max = a;
    if (b > max) max = b;
  }
  const norm = (0.89 / max) * 1.1;
  const fadeStart = Math.floor(Math.max(0, duration - BAR) * SR);
  const soft = (x: number) => {
    const c = x > 3 ? 3 : x < -3 ? -3 : x;
    return (c * (27 + c * c)) / (27 + 9 * c * c);
  };
  for (let k = 0; k < n; k++) {
    const fade = k > fadeStart ? 1 - (k - fadeStart) / Math.max(1, n - fadeStart) : 1;
    L[k] = soft(L[k]! * norm) * fade;
    R[k] = soft(R[k]! * norm) * fade;
  }
  return { left: L, right: R, sampleRate: SR };
}
