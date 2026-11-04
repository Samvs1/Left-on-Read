/**
 * The twelve Wrapped scenes and the compositor that strings them together
 * with beat-locked wipes. Every frame is a pure function of time, so the live
 * preview and the exported video are identical, frame for frame.
 */
import { onPersonColor, personColor } from '../colors';
import { fmtCompact, fmtNum } from '../format';
import type { SceneId, WrappedData } from './data';
import {
  avatar,
  blob,
  bubble,
  circle,
  clamp01,
  drawText,
  ease,
  emoji,
  fitSize,
  H,
  kicker,
  logoMark,
  measure,
  popText,
  prog,
  rng,
  riseLines,
  riseText,
  roundRect,
  signature,
  starburst,
  W,
  wrap,
  grain,
  type G,
  type TextStyle,
} from './draw';
import { BAR, BEAT, sceneAt, TRANSITION, type Timeline } from './timeline';

interface Pal {
  bg: string;
  fg: string;
  a1: string;
  a2: string;
  a3: string;
}

/* Bold duotones. Text colours pass 3:1 or better on their background (all text here is large). */
const PAL = {
  ink: { bg: '#0e0b1a', fg: '#f6f2ff', a1: '#c8ff2e', a2: '#ff4fd8', a3: '#3dd6ff' },
  violet: { bg: '#2b1a9e', fg: '#f6f2ff', a1: '#c8ff2e', a2: '#ff8fd2', a3: '#3dd6ff' },
  lime: { bg: '#c8ff2e', fg: '#14102a', a1: '#5b3df5', a2: '#ff5c39', a3: '#14102a' },
  night: { bg: '#100a2b', fg: '#f6f2ff', a1: '#ffd23f', a2: '#ff4fd8', a3: '#3dd6ff' },
  coral: { bg: '#ff5c39', fg: '#14102a', a1: '#fff5ec', a2: '#ffd23f', a3: '#2b1a9e' },
  blue: { bg: '#1f3cff', fg: '#f3f6ff', a1: '#ffd23f', a2: '#ff8fd2', a3: '#c8ff2e' },
  pink: { bg: '#ff8fd2', fg: '#1a0f33', a1: '#2b1a9e', a2: '#ffd23f', a3: '#ff5c39' },
  cream: { bg: '#fff1df', fg: '#1a0f33', a1: '#e8431f', a2: '#5b3df5', a3: '#ffd23f' },
  teal: { bg: '#06403a', fg: '#eafff7', a1: '#5dffb2', a2: '#ffd23f', a3: '#3dd6ff' },
  summary: { bg: '#2a1a8c', fg: '#ffffff', a1: '#c8ff2e', a2: '#ff8fd2', a3: '#3dd6ff' },
} satisfies Record<string, Pal>;

const SCENE_PAL: Record<SceneId, Pal> = {
  intro: PAL.ink,
  messages: PAL.violet,
  months: PAL.lime,
  hour: PAL.night,
  talk: PAL.coral,
  speed: PAL.blue,
  emojis: PAL.pink,
  words: PAL.cream,
  streak: PAL.teal,
  awards: PAL.ink,
  persona: PAL.night,
  summary: PAL.summary,
};

export interface SceneCtx {
  g: G;
  /** Seconds since the scene started (keeps running past `dur` during the next wipe). */
  t: number;
  dur: number;
  d: WrappedData;
  calm: boolean;
  /** Right-hand side of the signature, e.g. "Wrapped 2025". */
  sig: string;
}

const L = 90;
const CW = W - 2 * L;
const B = BEAT;

function fill(g: G, color: string) {
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function glow(g: G, x: number, y: number, r: number, color: string, alpha: number) {
  if (r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, alpha));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function body(size: number, color: string, extra: Partial<TextStyle> = {}): TextStyle {
  return { size, color, weight: 600, kind: 'body', ...extra };
}

function display(size: number, color: string, extra: Partial<TextStyle> = {}): TextStyle {
  return { size, color, weight: 800, kind: 'display', stretch: 'condensed', tracking: -0.035, ...extra };
}

/** Bars with rounded tops anchored to the baseline. */
function barPath(g: G, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h);
  g.closePath();
}

/* ------------------------------------------------------------------ */
/* Scenes                                                               */
/* ------------------------------------------------------------------ */

function intro(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.intro;
  fill(g, P.bg);
  const k = calm ? 0 : t;
  const pop = (start: number) => (calm ? 1 : ease.back(prog(t, start, 0.6)));
  g.fillStyle = P.a1;
  starburst(g, 905, 300, 150 * pop(0.05), 235 * pop(0.05), 12, k * 0.35);
  g.fill();
  g.fillStyle = P.a2;
  circle(g, 1115, 1235 + Math.sin(k * 1.2) * 14, 205 * pop(B));
  g.fill();
  g.save();
  g.translate(160, 470);
  g.rotate(-0.25 + k * 0.18);
  const s3 = pop(B * 2);
  g.fillStyle = P.a3;
  roundRect(g, -105 * s3, -105 * s3, 210 * s3, 210 * s3, 46 * s3);
  g.fill();
  g.restore();
  g.save();
  g.globalAlpha = 0.28;
  g.strokeStyle = P.fg;
  g.lineWidth = 4;
  circle(g, 940, 1660, 120 * (calm ? 1 : ease.out(prog(t, B * 3, 0.8))));
  g.stroke();
  g.restore();

  kicker(g, d.copy['your']!, L, 790, P.fg, prog(t, 0.1, 0.5), calm);
  if (d.year) {
    // The year slams in, one digit per beat.
    const st = display(400, P.fg, { tracking: -0.045 });
    let x = L;
    const digits = Array.from(d.year);
    const total = digits.reduce((a, ch) => a + measure(g, ch, st), 0);
    const scale = Math.min(1, CW / total);
    for (let i = 0; i < digits.length; i++) {
      const ch = digits[i]!;
      const w = measure(g, ch, st) * scale;
      const p = prog(t, 0.12 + i * B, 0.42);
      if (p > 0) {
        const s = (calm ? 1 : 1 + 0.9 * (1 - ease.out(p))) * scale;
        g.save();
        g.translate(x + w / 2, 1150 - 145 * scale);
        g.scale(s, s);
        drawText(g, ch, 0, 145, { ...st, align: 'center', alpha: calm ? ease.out(p) : clamp01(p * 3) });
        g.restore();
      }
      x += w;
    }
  } else {
    const st = display(170, P.fg);
    const lines = wrap(g, d.copy['heading']!, CW, st).slice(0, 2);
    const size = Math.min(...lines.map((ln) => fitSize(g, ln, CW, st)));
    riseLines(g, lines, L, 1150 - (lines.length - 1) * size * 0.95, size * 0.95, { ...st, size }, t, 0.15, 0.2, calm);
  }
  riseText(g, d.copy['word']!, L, 1380, display(230, P.a1, { tracking: -0.04 }), prog(t, BAR, 0.6), calm);
  const ls = body(54, P.fg, { weight: 650 });
  riseLines(g, wrap(g, d.copy['introLine']!, CW, ls).slice(0, 2), L, 1500, 66, ls, t, BAR + B, 0.12, calm);
  d.people.slice(0, 6).forEach((p, i) => {
    const pp = prog(t, BAR + B * 2 + i * 0.08, 0.5);
    if (pp <= 0) return;
    avatar(g, L + 50 + i * 82, 1690, 48 * (calm ? 1 : ease.back(pp)), personColor(p.id, false), onPersonColor(p.id), p.initials, P.bg);
  });
  signature(g, P.fg, c.sig);
}

function messages(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.messages;
  fill(g, P.bg);
  const r = rng(11);
  for (let i = 0; i < 22; i++) {
    const layer = i % 3;
    const speed = [60, 110, 180][layer]!;
    const w = 150 + r() * 230;
    const h = [62, 78, 96][layer]!;
    const x = r() * (W + 200) - 100;
    const y0 = r() * (H + 400);
    const y = calm ? y0 - 200 : ((y0 + t * speed) % (H + 400)) - 200;
    g.globalAlpha = [0.09, 0.13, 0.18][layer]!;
    g.fillStyle = i % 5 === 0 ? P.a1 : P.fg;
    bubble(g, x, y, w, h, i % 2 === 0);
    g.fill();
  }
  g.globalAlpha = 1;
  glow(g, W / 2, 960, 620, P.a2, 0.18 * prog(t, 0, 1));
  kicker(g, d.copy['msgKicker']!, W / 2, 700, P.fg, prog(t, 0.05, 0.5), calm, 'center');
  const st = display(370, P.fg, { align: 'center', tracking: -0.045 });
  const size = fitSize(g, d.copy['msgNumber']!, CW, st);
  const v = calm ? d.messages : Math.round(d.messages * ease.expo(prog(t, 0.15, 1.6)));
  drawText(g, fmtNum(v), W / 2, 1010, { ...st, size, alpha: clamp01(prog(t, 0.1, 0.25)) });
  riseText(g, d.copy['msgWord']!, W / 2, 1150, display(130, P.a1, { align: 'center' }), prog(t, 0.45, 0.6), calm);
  const ls = body(48, P.fg, { align: 'center' });
  riseLines(g, wrap(g, d.copy['msgLine']!, 860, ls), W / 2, 1330, 62, ls, t, 1.5, 0.1, calm);
  signature(g, P.fg, c.sig);
}

function months(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.months;
  fill(g, P.bg);
  g.save();
  g.globalAlpha = 0.12;
  g.fillStyle = P.a1;
  blob(g, 900, 300, 260, calm ? 0 : t, 2);
  g.fill();
  g.restore();
  kicker(g, d.copy['monthKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  const nameSt = display(250, P.fg);
  const nameSize = fitSize(g, d.copy['monthName']!, CW, nameSt);
  riseText(g, d.copy['monthName']!, L, 380 + nameSize * 0.74, { ...nameSt, size: nameSize }, prog(t, 1.2, 0.6), calm);
  const ls = body(44, P.fg, { weight: 650 });
  riseLines(g, wrap(g, d.copy['monthLine']!, CW, ls), L, 470 + nameSize * 0.74, 56, ls, t, 1.45, 0.08, calm);

  const n = d.bars.length;
  const gap = n > 12 ? 10 : n > 8 ? 14 : 22;
  const bw = (CW - gap * (n - 1)) / n;
  const base = 1520;
  const maxH = 560;
  const maxV = Math.max(1, ...d.bars.map((b) => b.value));
  const hl = calm ? 1 : prog(t, 1.15, 0.4);
  g.fillStyle = rgba(P.fg, 0.25);
  g.fillRect(L, base + 2, CW, 3);
  d.bars.forEach((b, i) => {
    const p = calm ? 1 : ease.back(prog(t, 0.15 + i * 0.045, 0.55));
    const h = Math.max(0, (b.value > 0 ? Math.max(12, (maxH * b.value) / maxV) : 6) * p);
    const x = L + i * (bw + gap);
    barPath(g, x, base - h, bw, h, Math.min(bw / 2, 16));
    g.fillStyle = rgba(P.fg, 0.16);
    g.fill();
    if (b.top && hl > 0) {
      g.globalAlpha = hl;
      g.fillStyle = P.a1;
      g.fill();
      g.globalAlpha = 1;
      const vs = body(36, P.fg, { weight: 800, align: 'center' });
      drawText(g, fmtCompact(b.value), x + bw / 2, base - h - 22, { ...vs, alpha: hl });
    }
    const lbSize = bw < 44 ? 24 : 30;
    drawText(g, b.label, x + bw / 2, base + 50, body(lbSize, P.fg, { weight: 700, align: 'center', alpha: b.top ? 1 : 0.6 }));
    if (b.sub) drawText(g, b.sub, x + bw / 2, base + 84, body(lbSize - 4, P.fg, { weight: 600, align: 'center', alpha: 0.5 }));
  });
  signature(g, P.fg, c.sig);
}

function hour(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.hour;
  fill(g, P.bg);
  const cx = W / 2;
  const cy = 940;
  const r0 = 190;
  const maxLen = 230;
  glow(g, cx, cy, 560, P.a3, 0.22 * prog(t, 0.2, 1));
  kicker(g, d.copy['hourKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  const max = Math.max(1, ...d.hourly);
  g.lineCap = 'round';
  for (let h = 0; h < 24; h++) {
    const a = -Math.PI / 2 + (h * Math.PI * 2) / 24;
    const p = calm ? 1 : ease.out(prog(t, 0.1 + h * 0.028, 0.5));
    if (p <= 0) continue;
    const len = 6 + maxLen * ((d.hourly[h] ?? 0) / max) * p;
    const peak = h === d.peakHour;
    g.save();
    g.strokeStyle = peak ? P.a3 : P.fg;
    g.globalAlpha = peak ? 1 : 0.32;
    g.lineWidth = 28;
    if (peak) {
      g.shadowColor = P.a3;
      g.shadowBlur = 36 * prog(t, 1.0, 0.5);
    }
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
    g.stroke();
    g.restore();
  }
  circle(g, cx, cy, r0 - 34);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fill();
  const ticks = d.copy['hourTicks']!.split(';');
  ticks.forEach((label, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    const rr = r0 + maxLen + 52;
    drawText(g, label, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + 11, body(30, P.fg, { weight: 650, align: 'center', alpha: 0.5 * prog(t, 0.6, 0.5) }));
  });
  const st = display(118, P.fg, { align: 'center', stretch: 'semi-condensed' });
  const size = fitSize(g, d.copy['hourLabel']!, 2 * (r0 - 50), st);
  popText(g, d.copy['hourLabel']!, cx, cy + size * 0.36, { ...st, size }, prog(t, 1.1, 0.55), calm);
  const ls = body(46, P.fg, { weight: 650 });
  const y = riseLines(g, wrap(g, d.copy['hourLine']!, CW, ls), L, 1560, 58, ls, t, 1.5, 0.08, calm);
  riseText(g, d.copy['weekdayLine']!, L, y + 12, body(46, P.a1, { weight: 750 }), prog(t, 1.75, 0.5), calm);
  signature(g, P.fg, c.sig);
}

function talk(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.talk;
  fill(g, P.bg);
  kicker(g, d.copy['talkKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  if (!d.isGroup && d.people.length >= 2) {
    const a = d.people[0]!;
    const b = d.people[1]!;
    const maxShare = Math.max(a.share, b.share, 1e-9);
    const R = 300;
    const items = [
      { p: a, r: R * Math.sqrt(a.share / maxShare), x: 390, y: 800, fill: P.a3, ink: '#fff5ec', start: 0.2 },
      { p: b, r: R * Math.sqrt(b.share / maxShare), x: 700, y: 1170, fill: P.a2, ink: '#14102a', start: 0.2 + B },
    ];
    for (const it of items) {
      const pp = prog(t, it.start, 0.9);
      if (pp <= 0) continue;
      const r = it.r * (calm ? 1 : ease.spring(pp));
      circle(g, it.x, it.y, r);
      g.fillStyle = it.fill;
      g.fill();
      g.lineWidth = 12;
      g.strokeStyle = P.bg;
      g.stroke();
      const pct = `${Math.round(it.p.share * 100)}%`;
      const ps = display(it.r * 0.62, it.ink, { align: 'center' });
      drawText(g, pct, it.x, it.y + it.r * 0.12, { ...ps, size: fitSize(g, pct, it.r * 1.5, ps), alpha: clamp01(pp * 2) });
      const ns = body(Math.max(28, Math.min(50, it.r * 0.17)), it.ink, { weight: 750, align: 'center' });
      drawText(g, it.p.name, it.x, it.y + it.r * 0.45, { ...ns, size: fitSize(g, it.p.name, it.r * 1.5, ns), alpha: clamp01(pp * 2) });
    }
  } else {
    d.people.slice(0, 5).forEach((p, i) => {
      const pp = prog(t, 0.15 + i * B * 0.5, 0.55);
      if (pp <= 0) return;
      const y = 560 + i * 200;
      g.save();
      g.translate(calm ? 0 : (1 - ease.expo(pp)) * 900, 0);
      g.globalAlpha = calm ? ease.out(pp) : 1;
      drawText(g, String(i + 1), L, y + 62, display(150, i === 0 ? P.a1 : P.fg));
      avatar(g, L + 190, y + 8, 56, personColor(p.id, false), onPersonColor(p.id), p.initials, P.bg);
      const ns = display(80, P.fg, { stretch: 'semi-condensed' });
      drawText(g, p.name, L + 275, y + 22, { ...ns, size: fitSize(g, p.name, CW - 275, ns) });
      drawText(g, p.row, L + 275, y + 72, body(36, P.fg, { alpha: 0.78 }));
      g.restore();
    });
  }
  const ls = body(48, P.fg, { weight: 700 });
  riseLines(g, wrap(g, d.copy['talkLine']!, CW, ls), L, 1610, 60, ls, t, 1.5, 0.08, calm);
  signature(g, P.fg, c.sig);
}

function speed(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.speed;
  fill(g, P.bg);
  if (!calm) {
    const r = rng(23);
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const y = 120 + r() * 1650;
      const len = 180 + r() * 520;
      const sp = 1600 + r() * 1800;
      const off = r() * 3000;
      const x = ((off + t * sp) % (W + len + 400)) - len - 200;
      g.strokeStyle = P.fg;
      g.globalAlpha = 0.07 + r() * 0.1;
      g.lineWidth = 6 + r() * 10;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  kicker(g, d.copy['speedKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  const f0 = d.fastest[0]!;
  const ns = display(220, P.fg);
  const nameSize = fitSize(g, f0.name, CW, ns);
  const p = prog(t, 0.1, 0.55);
  if (p > 0) {
    const e = calm ? 1 : ease.expo(p);
    const x = L - (1 - e) * 1200;
    if (!calm && p < 1) for (let k = 3; k >= 1; k--) drawText(g, f0.name, x - k * 90 * (1 - e), 640, { ...ns, size: nameSize, alpha: 0.18 / k });
    drawText(g, f0.name, x, 640, { ...ns, size: nameSize, alpha: calm ? ease.out(p) : 1 });
  }
  riseText(g, f0.label, L, 860, display(190, P.a1), prog(t, 0.55, 0.55), calm);
  riseText(g, d.copy['speedLabel']!, L, 935, body(42, P.fg, { weight: 650, alpha: 0.85 }), prog(t, 0.75, 0.5), calm);
  const fastestMs = Math.max(1, f0.ms);
  d.fastest.forEach((f, i) => {
    const y = 1130 + i * (d.fastest.length > 2 ? 112 : 150);
    const pp = calm ? 1 : ease.out(prog(t, 1.0 + i * 0.12, 0.7));
    if (pp <= 0) return;
    const full = 520 * Math.max(0.12, Math.min(1, fastestMs / Math.max(1, f.ms)));
    const nsz = fitSize(g, f.name, 220, body(38, P.fg, { weight: 750 }));
    drawText(g, f.name, L, y + 13, body(nsz, P.fg, { weight: 750, alpha: clamp01(pp * 2) }));
    roundRect(g, L + 245, y - 30, Math.max(60, full * pp), 60, 30);
    g.fillStyle = i === 0 ? P.a1 : 'rgba(255,255,255,0.38)';
    g.fill();
    drawText(g, f.label, L + 245 + Math.max(60, full * pp) + 22, y + 13, body(38, P.fg, { weight: 750, alpha: pp }));
  });
  if (d.copy['starterLine']) {
    const ls = body(46, P.fg, { weight: 650 });
    riseLines(g, wrap(g, d.copy['starterLine'], CW, ls), L, 1620, 58, ls, t, 1.7, 0.08, calm);
  }
  signature(g, P.fg, c.sig);
}

function emojisScene(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.emojis;
  fill(g, P.bg);
  const r = rng(31);
  const list = d.emojis.map((e) => e.emoji);
  for (let i = 0; i < 22; i++) {
    const ch = list[i % list.length]!;
    const size = 70 + r() * 70;
    const x = r() * W;
    const y0 = r() * (H + 300);
    const sp = 90 + r() * 150;
    const y = calm ? y0 - 150 : ((y0 + t * sp) % (H + 300)) - 150;
    emoji(g, ch, x, y, size, 0.16);
  }
  kicker(g, d.copy['emojiKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  const top = d.emojis[0]!;
  const p = prog(t, 0.15, 0.7);
  if (p > 0) {
    const beat = calm ? 0 : 0.035 * Math.max(0, Math.cos(((t % B) / B) * Math.PI));
    const s = (calm ? 1 : ease.spring(p)) * (1 + beat);
    const rot = calm ? 0 : (1 - ease.out(p)) * -0.5 + 0.05 * Math.sin(t * 2.2);
    g.save();
    g.translate(W / 2, 820);
    g.rotate(rot);
    g.scale(s, s);
    emoji(g, top.emoji, 0, 0, 380);
    g.restore();
  }
  const bp = prog(t, 0.6, 0.5);
  if (bp > 0) {
    const bs = calm ? 1 : ease.back(bp);
    circle(g, 790, 580, 76 * bs);
    g.fillStyle = P.a1;
    g.fill();
    drawText(g, '#1', 790, 580 + 24 * bs, display(70 * bs, '#ffffff', { align: 'center', stretch: 'normal' }));
  }
  riseText(g, top.label, W / 2, 1160, display(84, P.fg, { align: 'center', stretch: 'semi-condensed' }), prog(t, 0.7, 0.5), calm);
  const rest = d.emojis.slice(1, 5);
  const cellW = 220;
  const x0 = W / 2 - (rest.length * cellW) / 2;
  rest.forEach((e, i) => {
    const pp = prog(t, 1.1 + i * B * 0.5, 0.5);
    if (pp <= 0) return;
    const cx = x0 + cellW * (i + 0.5);
    const s = calm ? 1 : ease.back(pp);
    g.save();
    g.globalAlpha = clamp01(pp * 2);
    roundRect(g, cx - 92, 1280, 184, 270, 40);
    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.fill();
    g.translate(cx, 1385);
    g.scale(s, s);
    emoji(g, e.emoji, 0, 0, 112);
    g.restore();
    g.save();
    g.globalAlpha = clamp01(pp * 2);
    drawText(g, `#${i + 2}`, cx, 1494, body(34, P.fg, { weight: 800, align: 'center' }));
    drawText(g, `${fmtCompact(e.count)}×`, cx, 1532, body(30, P.fg, { weight: 650, align: 'center', alpha: 0.7 }));
    g.restore();
  });
  signature(g, P.fg, c.sig);
}

function words(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.words;
  fill(g, P.bg);
  drawText(g, '“', 990, 700, display(620, P.a2, { align: 'right', alpha: 0.1, stretch: 'normal' }));
  kicker(g, d.copy['wordsKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  d.words.slice(0, 5).forEach((w, i) => {
    const y = 560 + i * 225 + 110;
    const start = 0.2 + i * B * 0.75;
    riseText(g, String(i + 1), L, y, display(170, P.a1), prog(t, start, 0.6), calm);
    const ws = display(i === 0 ? 150 : 118, P.fg);
    riseText(g, w.word, L + 185, y, { ...ws, size: fitSize(g, w.word, 600, ws) }, prog(t, start + 0.08, 0.6), calm);
    riseText(g, `${w.label}×`, W - L, y, body(38, P.fg, { weight: 700, align: 'right', alpha: 0.55 }), prog(t, start + 0.16, 0.6), calm);
  });
  const ns = body(32, P.fg, { weight: 550, alpha: 0.55 });
  riseLines(g, wrap(g, d.copy['wordsNote']!, CW, ns), L, 1720, 42, ns, t, 2.0, 0.08, calm);
  signature(g, P.fg, c.sig);
}

function streak(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.streak;
  fill(g, P.bg);
  glow(g, 900, 420, 520, P.a1, 0.14);
  kicker(g, d.copy['streakKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  const n = d.streakDays;
  const st = display(400, P.a1, { tracking: -0.045 });
  const size = fitSize(g, fmtNum(n), CW, st);
  const v = calm ? n : Math.round(n * ease.expo(prog(t, 0.1, 1.2)));
  drawText(g, fmtNum(v), L, 770, { ...st, size, alpha: clamp01(prog(t, 0.05, 0.3)) });
  riseText(g, d.copy['streakUnit']!, L, 885, display(96, P.fg), prog(t, 0.35, 0.6), calm);
  const cols = 12;
  const cell = 60;
  const gap = 14;
  const shown = Math.min(n, 84);
  for (let i = 0; i < shown; i++) {
    const pp = calm ? 1 : prog(t, 0.45 + (i / shown) * 1.3, 0.25);
    if (pp <= 0) continue;
    const x = L + (i % cols) * (cell + gap);
    const y = 990 + Math.floor(i / cols) * (cell + gap);
    const s = calm ? 1 : ease.back(pp);
    g.globalAlpha = 0.35 + (0.65 * (i + 1)) / shown;
    roundRect(g, x + (cell / 2) * (1 - s), y + (cell / 2) * (1 - s), cell * s, cell * s, 14 * s);
    g.fillStyle = P.a1;
    g.fill();
  }
  g.globalAlpha = 1;
  let ty = 990 + Math.ceil(shown / cols) * (cell + gap) + 70;
  if (n > shown) {
    drawText(g, `+${fmtNum(n - shown)}`, L, ty - 14, body(36, P.fg, { weight: 750, alpha: prog(t, 1.8, 0.4) }));
    ty += 50;
  }
  ty = Math.max(ty, 1330);
  riseText(g, d.copy['streakRange']!, L, ty, body(46, P.fg, { weight: 750 }), prog(t, 1.7, 0.5), calm);
  if (d.copy['busiestLine']) {
    const ls = body(38, P.fg, { alpha: 0.75 });
    riseLines(g, wrap(g, d.copy['busiestLine'], CW, ls), L, ty + 66, 48, ls, t, 1.9, 0.08, calm);
  }
  signature(g, P.fg, c.sig);
}

function awards(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.awards;
  fill(g, P.bg);
  // Twinkling sparkles.
  const r = rng(41);
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = 120 + r() * 1700;
    const ph = r() * Math.PI * 2;
    const a = calm ? 0.25 : 0.12 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + ph));
    g.globalAlpha = a;
    g.fillStyle = i % 3 === 0 ? P.a1 : P.fg;
    starburst(g, x, y, 3, 13 + r() * 8, 4, 0);
    g.fill();
  }
  g.globalAlpha = 1;
  kicker(g, d.copy['awardsKicker']!, L, 330, P.fg, prog(t, 0.05, 0.5), calm);
  const list = d.awards;
  const n = list.length;
  const h = n === 1 ? 470 : 330;
  const gap = 40;
  const total = n * h + (n - 1) * gap;
  const top = 1080 - total / 2;
  list.forEach((a, i) => {
    const p = prog(t, 0.3 + i * BAR * 0.75, 0.6);
    if (p <= 0) return;
    const y = top + i * (h + gap);
    const e = calm ? 1 : ease.back(p);
    g.save();
    g.translate(W / 2, y + h / 2 + (calm ? 0 : (1 - e) * 320));
    g.rotate(calm ? 0 : (1 - ease.out(p)) * -0.09);
    g.globalAlpha = clamp01(p * 2.5);
    const grad = g.createLinearGradient(-450, -h / 2, 450, h / 2);
    grad.addColorStop(0, a.from);
    grad.addColorStop(1, a.to);
    roundRect(g, -450, -h / 2, 900, h, 48);
    g.fillStyle = grad;
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fill();
    emoji(g, a.emoji, -450 + 120, n === 1 ? -40 : 0, n === 1 ? 150 : 118);
    const tx = -450 + 232;
    const maxW = 900 - 232 - 48;
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowBlur = 14;
    const ts = display(66, '#ffffff', { stretch: 'semi-condensed' });
    drawText(g, a.title, tx, -h / 2 + 104, { ...ts, size: fitSize(g, a.title, maxW, ts) });
    const ws = body(44, '#ffffff', { weight: 800 });
    drawText(g, a.winner, tx, -h / 2 + 166, { ...ws, size: fitSize(g, a.winner, maxW, ws) });
    const ls = body(32, '#ffffff', { weight: 550, alpha: 0.92 });
    wrap(g, a.line, maxW, ls)
      .slice(0, n === 1 ? 5 : 2)
      .forEach((ln, k) => drawText(g, ln, tx, -h / 2 + 226 + k * 42, ls));
    g.restore();
  });
  signature(g, P.fg, c.sig);
}

function persona(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const P = SCENE_PAL.persona;
  const pr = d.persona;
  fill(g, P.bg);
  const k = calm ? 0 : t;
  const grow = calm ? 1 : ease.out(prog(t, 0, 1.2));
  glow(g, 540 + 140 * Math.cos(k * 0.9), 900 + 100 * Math.sin(k * 0.7), 640 * grow, pr.c1, 0.72);
  glow(g, 540 - 150 * Math.cos(k * 0.8 + 1), 1040 - 90 * Math.sin(k * 1.1), 600 * grow, pr.c2, 0.6);
  // Keep the centre deep enough for white type.
  glow(g, 540, 990, 520, '#100a2b', 0.45);
  // Orbiting ring of dots.
  g.save();
  g.translate(540, 960);
  g.rotate(k * 0.25);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    g.globalAlpha = 0.3 * grow;
    circle(g, Math.cos(a) * 470, Math.sin(a) * 470, i % 3 === 0 ? 6 : 3.5);
    g.fillStyle = P.fg;
    g.fill();
  }
  g.restore();
  kicker(g, d.copy['personaKicker']!, W / 2, 470, P.fg, prog(t, 0.05, 0.5), calm, 'center');
  const ep = prog(t, 0.3, 0.6);
  if (ep > 0) {
    const s = calm ? 1 : ease.back(ep);
    g.save();
    g.translate(W / 2, 680);
    g.scale(s, s);
    emoji(g, pr.emoji, 0, 0, 150);
    g.restore();
  }
  g.save();
  g.shadowColor = 'rgba(10,6,30,0.35)';
  g.shadowBlur = 24;
  const ns = display(160, '#ffffff', { align: 'center' });
  let lines = [pr.name];
  let size = fitSize(g, pr.name, 920, ns);
  if (size < 110 && pr.name.includes(' ')) {
    lines = wrap(g, pr.name, 920, { ...ns, size: 132 });
    size = Math.min(...lines.map((ln) => fitSize(g, ln, 920, { ...ns, size: 132 })));
  }
  const y0 = 990 - ((lines.length - 1) * size * 0.95) / 2;
  riseLines(g, lines, W / 2, y0, size * 0.95, { ...ns, size }, t, 0.6, 0.12, calm);
  const ls = body(50, '#ffffff', { align: 'center' });
  riseLines(g, wrap(g, pr.line, 820, ls), W / 2, y0 + lines.length * size * 0.95 + 120, 66, ls, t, 1.3, 0.1, calm);
  g.restore();
  signature(g, P.fg, c.sig);
}

function summary(c: SceneCtx) {
  const { g, t, d, calm } = c;
  const grad = g.createLinearGradient(0, 0, W * 0.6, H);
  grad.addColorStop(0, '#1d1250');
  grad.addColorStop(0.55, '#4b2fd9');
  grad.addColorStop(1, '#c24bd8');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  glow(g, 980, 160, 420, '#ff8fd2', 0.35);
  glow(g, 60, 1820, 520, '#3dd6ff', 0.22);
  kicker(g, d.copy['summaryKicker']!, L, 250, '#ffffff', prog(t, 0.05, 0.5), calm);
  const ts = display(120, '#ffffff');
  const tsize = fitSize(g, d.title, CW, ts);
  riseText(g, d.title, L, 285 + tsize * 0.78, { ...ts, size: tsize }, prog(t, 0.15, 0.6), calm);
  let ax = L + 34;
  d.people.slice(0, 6).forEach((p, i) => {
    const pp = prog(t, 0.3 + i * 0.05, 0.4);
    if (pp > 0) avatar(g, ax, 470, 34 * (calm ? 1 : ease.back(pp)), personColor(p.id, false), onPersonColor(p.id), p.initials, '#2a1a8c');
    ax += 56;
  });
  if (!d.year) drawText(g, d.periodLabel, ax + 10, 482, body(34, '#ffffff', { weight: 650, alpha: 0.85 * prog(t, 0.4, 0.4) }));
  d.tiles.forEach((tile, i) => {
    const p = prog(t, 0.45 + i * B * 0.5, 0.5);
    if (p <= 0) return;
    const x = L + (i % 2) * (435 + 30);
    const y = 570 + Math.floor(i / 2) * 278;
    const s = calm ? 1 : ease.back(p);
    g.save();
    g.translate(x + 217.5, y + 125);
    g.scale(s, s);
    g.globalAlpha = clamp01(p * 2.5);
    roundRect(g, -217.5, -125, 435, 250, 40);
    g.fillStyle = 'rgba(255,255,255,0.13)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2;
    g.stroke();
    const lx = -217.5 + 36;
    const lb = body(26, '#ffffff', { weight: 750, tracking: 0.12, alpha: 0.75 });
    drawText(g, tile.label.toUpperCase(), lx, -125 + 62, { ...lb, size: fitSize(g, tile.label.toUpperCase(), 363, lb) });
    if (tile.emoji) emoji(g, tile.value, lx + 48, 4, 92);
    else {
      const vs = display(86, '#ffffff');
      drawText(g, tile.value, lx, 38, { ...vs, size: fitSize(g, tile.value, 363, vs) });
    }
    if (tile.sub) {
      const sb = body(28, '#ffffff', { alpha: 0.78 });
      drawText(g, tile.sub, lx, 92, { ...sb, size: fitSize(g, tile.sub, 363, { ...sb, minSize: 18 }) });
    }
    g.restore();
  });
  const pp = prog(t, 0.45 + d.tiles.length * B * 0.5 + 0.15, 0.6);
  if (pp > 0) {
    const ps = display(56, '#2a1a8c', { stretch: 'semi-condensed' });
    const size = fitSize(g, d.persona.name, CW - 150, ps);
    const w = Math.min(CW, measure(g, d.persona.name, { ...ps, size }) + 150);
    const s = calm ? 1 : ease.back(pp);
    g.save();
    g.translate(L, 1478);
    g.scale(s, s);
    g.globalAlpha = clamp01(pp * 2);
    roundRect(g, 0, -56, w, 112, 56);
    g.fillStyle = '#ffffff';
    g.fill();
    emoji(g, d.persona.emoji, 62, 2, 56);
    drawText(g, d.persona.name, 112, 20, { ...ps, size });
    g.restore();
  }
  const fp = prog(t, 0.45 + d.tiles.length * B * 0.5 + 0.45, 0.6);
  if (fp > 0) {
    g.save();
    g.globalAlpha = calm ? ease.out(fp) : clamp01(fp * 2);
    logoMark(g, L, 1652, 64);
    drawText(g, 'Left on Read', L + 84, 1699, display(48, '#ffffff', { stretch: 'normal', tracking: -0.025 }));
    drawText(g, d.copy['madeOnDevice']!, L, 1770, body(30, '#ffffff', { weight: 550, alpha: 0.72 }));
    g.restore();
  }
}

const SCENES: Record<SceneId, (c: SceneCtx) => void> = {
  intro,
  messages,
  months,
  hour,
  talk,
  speed,
  emojis: emojisScene,
  words,
  streak,
  awards,
  persona,
  summary,
};

/* ------------------------------------------------------------------ */
/* Compositor                                                           */
/* ------------------------------------------------------------------ */

type Mask = { kind: 'circle'; x: number; y: number } | { kind: 'up' } | { kind: 'bars' } | { kind: 'diag' };

const MASKS: Record<SceneId, Mask> = {
  intro: { kind: 'up' },
  messages: { kind: 'circle', x: 540, y: 960 },
  months: { kind: 'up' },
  hour: { kind: 'bars' },
  talk: { kind: 'circle', x: 0, y: 1920 },
  speed: { kind: 'diag' },
  emojis: { kind: 'circle', x: 540, y: 820 },
  words: { kind: 'up' },
  streak: { kind: 'bars' },
  awards: { kind: 'circle', x: 1080, y: 0 },
  persona: { kind: 'circle', x: 540, y: 960 },
  summary: { kind: 'up' },
};

function maskPath(g: G, m: Mask, p: number) {
  g.beginPath();
  if (p <= 0) return;
  switch (m.kind) {
    case 'circle': {
      const r = p * Math.hypot(Math.max(m.x, W - m.x), Math.max(m.y, H - m.y)) * 1.02;
      g.arc(m.x, m.y, r, 0, Math.PI * 2);
      break;
    }
    case 'up': {
      const y = H * (1 - p);
      g.moveTo(0, y + 160 * (1 - p));
      g.lineTo(W, y);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.closePath();
      break;
    }
    case 'bars': {
      const n = 6;
      const bh = H / n;
      for (let i = 0; i < n; i++) {
        const pi = clamp01(p * 1.6 - i * 0.12);
        g.rect(0, i * bh - 0.5, W * ease.out(pi), bh + 1);
      }
      break;
    }
    case 'diag': {
      const x = (W + H * 0.5) * p;
      g.moveTo(0, 0);
      g.lineTo(x, 0);
      g.lineTo(x - H * 0.5, H);
      g.lineTo(0, H);
      g.closePath();
      break;
    }
  }
}

export interface RenderOptions {
  calm: boolean;
  /** Right-hand side of the per-frame signature. */
  sig: string;
}

/** Draws the frame at time `t` (seconds). The context must map 1080×1920. */
export function renderFrame(g: G, d: WrappedData, tl: Timeline, t: number, opts: RenderOptions) {
  const { index, local } = sceneAt(tl, t);
  const cur = tl.scenes[index]!;
  const ctx = (lt: number, dur: number): SceneCtx => ({ g, t: lt, dur, d, calm: opts.calm, sig: opts.sig });
  g.save();
  if (index > 0 && local < TRANSITION) {
    const prev = tl.scenes[index - 1]!;
    const p = local / TRANSITION;
    SCENES[prev.id](ctx(prev.dur + local, prev.dur));
    if (opts.calm) {
      g.globalAlpha = ease.inOut(p);
      SCENES[cur.id](ctx(local, cur.dur));
      g.globalAlpha = 1;
    } else {
      // Two-layer wipe: a sheet of the next scene's accent colour leads, the scene follows.
      const m = MASKS[cur.id];
      g.save();
      maskPath(g, m, ease.out(clamp01(p * 1.15)));
      g.fillStyle = SCENE_PAL[cur.id].a1;
      g.fill();
      g.restore();
      g.save();
      maskPath(g, m, ease.inOut(clamp01((p - 0.2) / 0.8)));
      g.clip();
      SCENES[cur.id](ctx(local, cur.dur));
      g.restore();
    }
  } else {
    SCENES[cur.id](ctx(local, cur.dur));
  }
  grain(g, 0.06);
  g.restore();
}
