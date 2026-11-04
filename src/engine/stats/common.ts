import type { Ctx } from '../context';
import { TYPES } from '../prepare';
import type { Excerpt, TimeSeries } from '../types';
import { truncate } from '../util';

/** Builds an excerpt for a view position. */
export function excerptAt(ctx: Ctx, k: number, max = 200): Excerpt {
  const i = ctx.idx[k]!;
  return { ts: ctx.tl[k]!, author: ctx.au[k]!, text: truncate(ctx.P.texts[i] ?? '', max), type: TYPES[ctx.P.type[i]!]! };
}

export function emptySeries(ctx: Ctx, buckets: number): TimeSeries {
  return {
    starts: new Array<number>(buckets).fill(0),
    totals: new Array<number>(buckets).fill(0),
    byPerson: Array.from({ length: ctx.seriesRows }, () => new Array<number>(buckets).fill(0)),
  };
}

/** Binary search: first view position with tl >= t. */
export function lowerBound(arr: Float64Array, t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
