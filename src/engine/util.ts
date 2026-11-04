import type { Counted, Percentiles } from './types';

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Day number since 1970-01-01 for a naive timestamp. */
export const dayOf = (t: number) => Math.floor(t / DAY);
/** Hour of day 0–23 for a naive timestamp. */
export const hourOf = (t: number) => Math.floor((t - Math.floor(t / DAY) * DAY) / HOUR);
/** Weekday with Monday = 0 … Sunday = 6. */
export const weekdayOfDay = (day: number) => (((day + 3) % 7) + 7) % 7;
/** Month number (year * 12 + month) for a naive timestamp. */
export function monthOf(t: number): number {
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
export const monthStart = (month: number) => Date.UTC(Math.floor(month / 12), month % 12, 1);
/** Week number (weeks start on Monday). */
export const weekOfDay = (day: number) => Math.floor((day + 3) / 7);
export const weekStart = (week: number) => (week * 7 - 3) * DAY;

/** Quantile of a sorted numeric array using linear interpolation. */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0]!;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (pos - lo);
}

export function percentiles(values: number[] | Float64Array): Percentiles | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = Float64Array.from(values).sort();
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i]!;
  return {
    count: n,
    mean: sum / n,
    p5: quantileSorted(sorted, 0.05),
    p25: quantileSorted(sorted, 0.25),
    median: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
    p90: quantileSorted(sorted, 0.9),
    p95: quantileSorted(sorted, 0.95),
  };
}

export function median(values: number[] | Float64Array): number | null {
  if (values.length === 0) return null;
  return quantileSorted(Float64Array.from(values).sort(), 0.5);
}

/** Top-k entries of a count map, descending, ties broken by key. */
export function topK<K>(map: Map<K, number>, k: number, filter?: (key: K, count: number) => boolean): { key: K; count: number }[] {
  const arr: { key: K; count: number }[] = [];
  for (const [key, count] of map) if (!filter || filter(key, count)) arr.push({ key, count });
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (typeof a.key === 'number' && typeof b.key === 'number') return a.key - b.key;
    const sa = String(a.key);
    const sb = String(b.key);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  return arr.slice(0, k);
}

export function topKCounted(map: Map<string, number>, k: number, filter?: (key: string, count: number) => boolean): Counted[] {
  return topK(map, k, filter);
}

export const inc = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

/**
 * Log-odds ratio with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008).
 * Returns the z-score of how much more `yi` (count in group i, total ni) is used than
 * `yj` (count in the rest, total nj), with prior pseudo-count `aw` for the word and total prior a0.
 */
export function logOddsZ(yi: number, ni: number, yj: number, nj: number, aw: number, a0: number): number {
  const li = Math.log((yi + aw) / (ni + a0 - yi - aw));
  const lj = Math.log((yj + aw) / (nj + a0 - yj - aw));
  const variance = 1 / (yi + aw) + 1 / (yj + aw);
  return (li - lj) / Math.sqrt(variance);
}

export const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function argMax(values: ArrayLike<number>, eligible?: (i: number) => boolean): number {
  let best = -1;
  let bv = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (eligible && !eligible(i)) continue;
    if (values[i]! > bv) {
      bv = values[i]!;
      best = i;
    }
  }
  return best;
}

export function truncate(s: string, max = 160): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

export function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

export function matrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => zeros(cols));
}
