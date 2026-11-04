/**
 * Canvas toolkit for the Wrapped video: fonts, easing, kinetic text, shapes,
 * grain and the brand mark. Everything draws in a fixed 1080×1920 space; the
 * preview simply scales the context.
 */

export const W = 1080;
export const H = 1920;
export type G = CanvasRenderingContext2D;

export const FAMILY = {
  display: '"LOR Wrapped", "Bricolage Grotesque Variable", "Inter Variable", system-ui, sans-serif',
  body: '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif',
} as const;
export type FontKind = keyof typeof FAMILY;
export type Stretch = 'normal' | 'semi-condensed' | 'condensed';

const proto = typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype : null;
const HAS_STRETCH = !!proto && 'fontStretch' in proto;
const HAS_SPACING = !!proto && 'letterSpacing' in proto;

type Ext = G & { fontStretch?: string; letterSpacing?: string };

export function setFont(g: G, size: number, weight = 800, kind: FontKind = 'display', tracking = 0, stretch: Stretch = 'semi-condensed') {
  g.font = `${weight} ${Math.round(size * 10) / 10}px ${FAMILY[kind]}`;
  const x = g as Ext;
  if (HAS_STRETCH) x.fontStretch = kind === 'display' ? stretch : 'normal';
  if (HAS_SPACING) x.letterSpacing = `${Math.round(tracking * size * 10) / 10}px`;
}

/* ------------------------------------------------------------------ */
/* Easing + timing                                                      */
/* ------------------------------------------------------------------ */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Progress (0–1) of an animation that starts at `start` and lasts `dur`. */
export const prog = (t: number, start: number, dur: number) => clamp01((t - start) / dur);

export const ease = {
  out: (x: number) => 1 - (1 - x) ** 3,
  in: (x: number) => x ** 3,
  inOut: (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  expo: (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  back: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  },
  /** Springy overshoot that settles. */
  spring: (x: number) => (x >= 1 ? 1 : 1 - Math.cos(x * Math.PI * 2.5) * Math.exp(-5.5 * x)),
};

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Text                                                                 */
/* ------------------------------------------------------------------ */

export interface TextStyle {
  size: number;
  color: string;
  weight?: number;
  kind?: FontKind;
  align?: CanvasTextAlign;
  /** Letter spacing in em. */
  tracking?: number;
  stretch?: Stretch;
  alpha?: number;
  baseline?: CanvasTextBaseline;
}

const defaultTracking = (st: TextStyle) => st.tracking ?? (st.kind === 'body' || st.kind === 'emoji' ? 0 : -0.025);

function applyStyle(g: G, st: TextStyle) {
  setFont(g, st.size, st.weight ?? (st.kind === 'body' ? 600 : 800), st.kind ?? 'display', defaultTracking(st), st.stretch);
  g.fillStyle = st.color;
  g.textAlign = st.align ?? 'left';
  g.textBaseline = st.baseline ?? 'alphabetic';
}

export function measure(g: G, text: string, st: TextStyle): number {
  applyStyle(g, st);
  return g.measureText(text).width;
}

export function drawText(g: G, text: string, x: number, y: number, st: TextStyle) {
  if (!text) return;
  applyStyle(g, st);
  const a = g.globalAlpha;
  if (st.alpha !== undefined) g.globalAlpha = a * st.alpha;
  g.fillText(text, x, y);
  g.globalAlpha = a;
}

const fitCache = new Map<string, number>();
const wrapCache = new Map<string, string[]>();
/** Fonts finished loading: cached measurements are stale. */
export function resetTextCache() {
  fitCache.clear();
  wrapCache.clear();
}

/** Largest size ≤ maxSize at which `text` fits in maxW. */
export function fitSize(g: G, text: string, maxW: number, st: Omit<TextStyle, 'color'> & { minSize?: number }): number {
  const key = `${text}|${maxW}|${st.size}|${st.weight}|${st.kind}|${st.tracking}|${st.stretch}`;
  let v = fitCache.get(key);
  if (v === undefined) {
    const w = measure(g, text, { ...st, color: '#000' });
    v = w <= maxW ? st.size : Math.max(st.minSize ?? 12, Math.floor(((st.size * maxW) / w) * 10) / 10);
    fitCache.set(key, v);
  }
  return v;
}

/** Greedy word wrap at the given style. */
export function wrap(g: G, text: string, maxW: number, st: Omit<TextStyle, 'color'>): string[] {
  const key = `${text}|${maxW}|${st.size}|${st.weight}|${st.kind}|${st.tracking}|${st.stretch}`;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  applyStyle(g, { ...st, color: '#000' });
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (!line || g.measureText(test).width <= maxW) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  wrapCache.set(key, lines);
  return lines;
}

/**
 * Kinetic reveal: the text slides up out of an invisible slot (a clip), the
 * signature move of the video. In calm mode it simply fades in.
 */
export function riseText(g: G, text: string, x: number, y: number, st: TextStyle, p: number, calm: boolean) {
  if (p <= 0 || !text) return;
  if (calm || p >= 1) {
    drawText(g, text, x, y, { ...st, alpha: (st.alpha ?? 1) * (calm ? ease.out(p) : 1) });
    return;
  }
  const e = ease.expo(p);
  const width = measure(g, text, st);
  const asc = st.size * 1.0;
  const desc = st.size * 0.32;
  const align = st.align ?? 'left';
  const left = align === 'center' ? x - width / 2 : align === 'right' || align === 'end' ? x - width : x;
  g.save();
  g.beginPath();
  g.rect(left - st.size * 0.3, y - asc, width + st.size * 0.6, asc + desc);
  g.clip();
  drawText(g, text, x, y + (1 - e) * (asc + desc), st);
  g.restore();
}

/** Multi-line rise, one line after another. Returns the y after the last line. */
export function riseLines(g: G, lines: string[], x: number, y: number, lh: number, st: TextStyle, t: number, start: number, stagger: number, calm: boolean): number {
  lines.forEach((ln, i) => riseText(g, ln, x, y + i * lh, st, prog(t, start + i * stagger, 0.55), calm));
  return y + lines.length * lh;
}

/** Scale-pop around the text's visual centre. */
export function popText(g: G, text: string, x: number, y: number, st: TextStyle, p: number, calm: boolean) {
  if (p <= 0 || !text) return;
  const s = calm ? 1 : 0.55 + 0.45 * ease.back(p);
  g.save();
  const cy = y - st.size * 0.35;
  g.translate(x, cy);
  g.scale(s, s);
  drawText(g, text, 0, y - cy, { ...st, alpha: (st.alpha ?? 1) * clamp01(p * 2.5) });
  g.restore();
}

export function emoji(g: G, ch: string, x: number, y: number, size: number, alpha = 1) {
  setFont(g, size, 400, 'emoji');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  g.fillStyle = '#000';
  g.fillText(ch, x, y);
  g.globalAlpha = a;
}

/** Uppercase kicker with wide tracking. */
export function kicker(g: G, text: string, x: number, y: number, color: string, p: number, calm: boolean, align: CanvasTextAlign = 'left') {
  riseText(g, text.toUpperCase(), x, y, { size: 40, weight: 750, kind: 'body', tracking: 0.16, color, align }, p, calm);
}

/* ------------------------------------------------------------------ */
/* Shapes                                                               */
/* ------------------------------------------------------------------ */

export function roundRect(g: G, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function circle(g: G, cx: number, cy: number, r: number) {
  g.beginPath();
  g.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
}

export function starburst(g: G, cx: number, cy: number, rIn: number, rOut: number, points: number, rot: number) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Soft organic blob that slowly morphs over time. */
export function blob(g: G, cx: number, cy: number, r: number, t: number, seed: number, amp = 0.09) {
  const n = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * Math.sin(3 * a + t * 0.9 + seed) + amp * 0.6 * Math.sin(5 * a - t * 1.3 + seed * 2.1);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]);
  }
  g.beginPath();
  const mid = (i: number) => {
    const a = pts[i % n]!;
    const b = pts[(i + 1) % n]!;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  const m0 = mid(0);
  g.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!;
    const m = mid(i);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}

/** Speech bubble with a little tail (the motif of the whole app). */
export function bubble(g: G, x: number, y: number, w: number, h: number, left: boolean) {
  const r = h / 2;
  roundRect(g, x, y, w, h, r);
  const tx = left ? x + r * 0.6 : x + w - r * 0.6;
  g.moveTo(tx - 14, y + h - 10);
  g.lineTo(left ? x - 6 : x + w + 6, y + h + 8);
  g.lineTo(tx + 14, y + h - 4);
  g.closePath();
}

/* ------------------------------------------------------------------ */
/* Texture + brand                                                      */
/* ------------------------------------------------------------------ */

const grains = new WeakMap<G, CanvasPattern | null>();
function grainPattern(g: G): CanvasPattern | null {
  if (grains.has(g)) return grains.get(g)!;
  let pat: CanvasPattern | null = null;
  try {
    const size = 160;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d')!;
    const img = x.createImageData(size, size);
    const r = rng(7);
    for (let i = 0; i < size * size; i++) {
      const v = Math.floor(r() * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    pat = g.createPattern(c, 'repeat');
  } catch {
    pat = null;
  }
  grains.set(g, pat);
  return pat;
}

/** Static film grain. It stays fixed in screen space, so it costs the video encoder almost nothing. */
export function grain(g: G, alpha = 0.07) {
  const pat = grainPattern(g);
  if (!pat) return;
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = 'overlay';
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);
  g.restore();
}

let bubblePath: Path2D | null = null;
export function logoMark(g: G, x: number, y: number, size: number) {
  const k = size / 64;
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, '#6a4bff');
  grad.addColorStop(0.55, '#c24bd8');
  grad.addColorStop(1, '#ff6b57');
  roundRect(g, 0, 0, 64, 64, 18);
  g.fillStyle = grad;
  g.fill();
  bubblePath ??= new Path2D('M17 19h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H31l-9 7v-7h-5a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6z');
  g.fillStyle = '#fff';
  g.fill(bubblePath);
  const dots: [number, string, number][] = [
    [23.5, '#6a4bff', 1],
    [32, '#c24bd8', 0.8],
    [40.5, '#ff6b57', 0.6],
  ];
  for (const [cx, col, a] of dots) {
    g.globalAlpha = a;
    circle(g, cx, 31, 3.2);
    g.fillStyle = col;
    g.fill();
  }
  g.restore();
}

/** Small "Left on Read · Wrapped" signature at the bottom of a frame. */
export function signature(g: G, color: string, right: string, alpha = 0.8) {
  const y = 1832;
  g.save();
  g.globalAlpha *= alpha;
  logoMark(g, 90, y - 34, 44);
  drawText(g, 'Left on Read', 148, y, { size: 32, weight: 750, kind: 'display', color, tracking: -0.02, stretch: 'normal' });
  drawText(g, right, W - 90, y, { size: 28, weight: 650, kind: 'body', color, align: 'right', tracking: 0.08 });
  g.restore();
}

/** Initials avatar. */
export function avatar(g: G, cx: number, cy: number, r: number, fill: string, ink: string, label: string, ring?: string) {
  circle(g, cx, cy, r);
  g.fillStyle = fill;
  g.fill();
  if (ring) {
    g.lineWidth = Math.max(3, r * 0.09);
    g.strokeStyle = ring;
    g.stroke();
  }
  drawText(g, label, cx, cy + r * 0.05, { size: r * 0.72, weight: 750, kind: 'body', color: ink, align: 'center', baseline: 'middle', tracking: -0.01 });
}
