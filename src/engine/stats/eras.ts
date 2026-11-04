/**
 * Era detection: binary segmentation (piecewise-constant mean, least squares)
 * on log message volume per month (or per week for short chats), with a
 * BIC-style penalty based on a robust noise estimate.
 */
import type { Ctx } from '../context';
import { T } from '../prepare';
import type { Era, EraKind } from '../types';
import { DAY, logOddsZ, median, monthOf, monthStart, weekOfDay, weekStart, zeros } from '../util';
import type { ContentResult } from './content';

interface Bucket {
  start: number;
  end: number;
  days: number;
  count: number;
}

export function buckets(ctx: Ctx): { list: Bucket[]; unit: 'month' | 'week' } {
  const { m, day } = ctx;
  if (m === 0) return { list: [], unit: 'month' };
  const spanDays = ctx.lastDay - ctx.firstDay + 1;
  const unit = spanDays >= 180 ? 'month' : 'week';
  const list: Bucket[] = [];
  const firstDayTs = ctx.firstDay * DAY;
  const endTs = (ctx.lastDay + 1) * DAY;
  if (unit === 'month') {
    const fm = monthOf(firstDayTs);
    const lm = monthOf(ctx.lastDay * DAY);
    for (let mo = fm; mo <= lm; mo++) {
      const s = Math.max(monthStart(mo), firstDayTs);
      const e = Math.min(monthStart(mo + 1), endTs);
      list.push({ start: s, end: e, days: (e - s) / DAY, count: 0 });
    }
    let cur = -1;
    let curB = 0;
    for (let k = 0; k < m; k++) {
      if (day[k] !== cur) {
        cur = day[k]!;
        curB = monthOf(cur * DAY) - fm;
      }
      list[curB]!.count++;
    }
  } else {
    const fw = weekOfDay(ctx.firstDay);
    const lw = weekOfDay(ctx.lastDay);
    for (let w = fw; w <= lw; w++) {
      const s = Math.max(weekStart(w), firstDayTs);
      const e = Math.min(weekStart(w + 1), endTs);
      list.push({ start: s, end: e, days: (e - s) / DAY, count: 0 });
    }
    for (let k = 0; k < m; k++) list[weekOfDay(day[k]!) - fw]!.count++;
  }
  return { list, unit };
}

/** Returns segment boundaries [a, b) over `x`. Exported for tests. */
export function binarySegmentation(x: number[], minLen: number, maxSegments: number, penaltyScale = 3): [number, number][] {
  const n = x.length;
  if (n < minLen * 2) return [[0, n]];
  const S = new Float64Array(n + 1);
  const S2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    S[i + 1] = S[i]! + x[i]!;
    S2[i + 1] = S2[i]! + x[i]! * x[i]!;
  }
  const sse = (a: number, b: number) => {
    const len = b - a;
    if (len <= 0) return 0;
    const s = S[b]! - S[a]!;
    return S2[b]! - S2[a]! - (s * s) / len;
  };
  // Robust noise estimate from first differences (MAD).
  const diffs: number[] = [];
  for (let i = 1; i < n; i++) diffs.push(x[i]! - x[i - 1]!);
  const md = median(diffs) ?? 0;
  const mad = median(diffs.map((d) => Math.abs(d - md))) ?? 0;
  let sigma = (mad * 1.4826) / Math.SQRT2;
  if (!(sigma > 1e-6)) {
    const mean = S[n]! / n;
    sigma = Math.sqrt(Math.max(1e-6, S2[n]! / n - mean * mean)) / 2 || 0.05;
  }
  const penalty = penaltyScale * sigma * sigma * Math.log(n);
  const segs: [number, number][] = [[0, n]];
  while (segs.length < maxSegments) {
    let best: { si: number; split: number; gain: number } | null = null;
    for (let si = 0; si < segs.length; si++) {
      const [a, b] = segs[si]!;
      if (b - a < minLen * 2) continue;
      const whole = sse(a, b);
      for (let sp = a + minLen; sp <= b - minLen; sp++) {
        const gain = whole - sse(a, sp) - sse(sp, b);
        if (!best || gain > best.gain) best = { si, split: sp, gain };
      }
    }
    if (!best || best.gain < penalty) break;
    const [a, b] = segs[best.si]!;
    segs.splice(best.si, 1, [a, best.split], [best.split, b]);
  }
  return segs.sort((p, q) => p[0] - q[0]);
}

export function labelEras(rates: number[], overall: number): EraKind[] {
  const n = rates.length;
  const kinds: (EraKind | null)[] = new Array(n).fill(null);
  if (n === 0) return [];
  if (n === 1) return ['steady'];
  let hi = 0;
  let lo = 0;
  for (let i = 1; i < n; i++) {
    if (rates[i]! > rates[hi]!) hi = i;
    if (rates[i]! < rates[lo]!) lo = i;
  }
  kinds[hi] = 'golden';
  if (lo !== hi && rates[lo]! <= overall * 0.75) kinds[lo] = 'quiet';
  for (let i = 0; i < n; i++) {
    if (kinds[i]) continue;
    const prev = i > 0 ? rates[i - 1]! : null;
    if (i === 0) {
      kinds[i] = rates[1]! > rates[0]! * 1.3 ? 'spark' : 'beginning';
      continue;
    }
    if (i === n - 1) {
      if (prev !== null && rates[i]! > prev * 1.3) kinds[i] = kinds[i - 1] === 'quiet' ? 'comeback' : 'rise';
      else if (prev !== null && rates[i]! < prev * 0.75) kinds[i] = 'fade';
      else kinds[i] = 'now';
      continue;
    }
    if (prev !== null && rates[i]! > prev * 1.3) kinds[i] = kinds[i - 1] === 'quiet' ? 'renaissance' : 'rise';
    else if (prev !== null && rates[i]! < prev * 0.75) kinds[i] = 'cooldown';
    else kinds[i] = 'steady';
  }
  return kinds as EraKind[];
}

export function computeEras(ctx: Ctx, c: ContentResult): Era[] {
  const { m, P, np, idx, au, tl, conv, turnStart, turnEnd, nTurns } = ctx;
  if (m === 0) return [];
  const { list, unit } = buckets(ctx);
  const rates = list.map((b) => (b.days > 0 ? b.count / b.days : 0));
  const x = rates.map((r) => Math.log1p(r));
  const minLen = unit === 'month' ? 2 : 3;
  const maxSegments = Math.min(6, Math.max(1, Math.floor(list.length / minLen)));
  const segs = list.length >= 4 ? binarySegmentation(x, minLen, maxSegments) : [[0, list.length] as [number, number]];
  const totalDays = list.reduce((acc, b) => acc + b.days, 0);
  const overallRate = totalDays > 0 ? m / totalDays : 0;

  const eras = segs.map(([a, b], index) => {
    const start = list[a]!.start;
    const end = list[b - 1]!.end;
    const days = list.slice(a, b).reduce((acc, bk) => acc + bk.days, 0);
    const messages = list.slice(a, b).reduce((acc, bk) => acc + bk.count, 0);
    return { index, start, end, days, messages, perDay: days > 0 ? messages / days : 0 };
  });
  const kinds = labelEras(eras.map((e) => e.perDay), overallRate);

  // Per-era details
  const nE = eras.length;
  const eraOf = (t: number) => {
    for (let e = nE - 1; e >= 0; e--) if (t >= eras[e]!.start) return e;
    return 0;
  };
  const share = eras.map(() => zeros(np));
  const tokens = eras.map(() => new Map<number, number>());
  const emojis = eras.map(() => new Map<number, number>());
  const tokTotal = zeros(nE);
  const emoTotal = zeros(nE);
  const sentSum = zeros(nE);
  const sentCnt = zeros(nE);
  const rts: number[][] = eras.map(() => []);
  let e = 0;
  for (let k = 0; k < m; k++) {
    while (e + 1 < nE && tl[k]! >= eras[e + 1]!.start) e++;
    const i = idx[k]!;
    share[e]![au[k]!]!++;
    for (let t = P.tokStart[i]!; t < P.tokStart[i + 1]!; t++) {
      const id = P.tokens[t]!;
      tokens[e]!.set(id, (tokens[e]!.get(id) ?? 0) + 1);
      tokTotal[e]!++;
    }
    for (let q = P.emoStart[i]!; q < P.emoStart[i + 1]!; q++) {
      const id = P.emoIds[q]!;
      emojis[e]!.set(id, (emojis[e]!.get(id) ?? 0) + 1);
      emoTotal[e]!++;
    }
    if (P.type[i] === T.text) {
      sentSum[e]! += P.sentiment[i]!;
      sentCnt[e]!++;
    }
  }
  for (let t = 1; t < nTurns; t++) {
    const k0 = turnStart[t]!;
    const pe = turnEnd[t - 1]!;
    if (conv[pe] !== conv[k0]) continue;
    rts[eraOf(tl[k0]!)]!.push(tl[k0]! - tl[pe]!);
  }
  let N = 0;
  for (let v = 0; v < c.tokenTotals.length; v++) N += c.tokenTotals[v]!;
  let NE = 0;
  for (let v = 0; v < c.emojiTotals.length; v++) NE += c.emojiTotals[v]!;
  const seen = new Map<EraKind, number>();
  return eras.map((era, ei) => {
    const kind = kinds[ei]!;
    const ordinal = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, ordinal);
    const sh = share[ei]!;
    const tot = sh.reduce((x2, y) => x2 + y, 0) || 1;
    let topPerson = 0;
    for (let a = 1; a < np; a++) if (sh[a]! > sh[topPerson]!) topPerson = a;
    // Distinctive words for the era
    const ni = tokTotal[ei]!;
    const words: { id: number; z: number }[] = [];
    for (const [id, yi] of tokens[ei]!) {
      if (yi < 3 || ctx.isStop(id) || P.vocab[id]!.length < 3) continue;
      const total = c.tokenTotals[id]!;
      const aw = (300 * total) / Math.max(1, N);
      const z = nE > 1 ? logOddsZ(yi, ni, total - yi, N - ni, aw, 300) : yi;
      words.push({ id, z });
    }
    words.sort((p, q) => q.z - p.z);
    // Signature emoji (fall back to most used)
    let topEmoji: string | null = null;
    let bestZ = -Infinity;
    let mostUsed = -1;
    let mostCount = 0;
    for (const [id, yi] of emojis[ei]!) {
      if (yi > mostCount) {
        mostCount = yi;
        mostUsed = id;
      }
      if (yi < 3 || nE < 2) continue;
      const total = c.emojiTotals[id]!;
      const aw = (30 * total) / Math.max(1, NE);
      const z = logOddsZ(yi, emoTotal[ei]!, total - yi, NE - emoTotal[ei]!, aw, 30);
      if (z > bestZ) {
        bestZ = z;
        topEmoji = P.emojiDisplay[id]!;
      }
    }
    if ((!topEmoji || bestZ < 1) && mostUsed >= 0) topEmoji = P.emojiDisplay[mostUsed]!;
    return {
      index: ei,
      kind,
      ordinal,
      start: era.start,
      end: era.end,
      days: era.days,
      messages: era.messages,
      perDay: era.perDay,
      intensity: overallRate > 0 ? era.perDay / overallRate : 1,
      share: sh.map((v) => v / tot),
      topPerson,
      topEmoji,
      topWords: words.slice(0, 3).map((w) => P.vocab[w.id]!),
      medianResponseMs: rts[ei]!.length >= 5 ? median(rts[ei]!) : null,
      sentiment: sentCnt[ei]! > 0 ? sentSum[ei]! / sentCnt[ei]! : 0,
    };
  });
}
