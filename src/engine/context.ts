/**
 * Per-computation context: the filtered "view" of messages, local times and
 * the conversation / turn segmentation shared by every stats module.
 */
import type { Prepared } from './prepare';
import { T, isMediaCode } from './prepare';
import type { Settings } from './types';
import { DAY, HOUR, MINUTE, weekdayOfDay } from './util';
import { STOPWORDS } from './lexicon/stopwords';

export interface Ctx {
  P: Prepared;
  s: Settings;
  /** Number of people. */
  np: number;
  /** View: indices into Prepared of included person messages (chronological). */
  idx: Int32Array;
  m: number;
  /** Local (shifted) timestamps per view position. */
  tl: Float64Array;
  day: Int32Array;
  hour: Uint8Array;
  wd: Uint8Array;
  /** Author per view position. */
  au: Int16Array;
  /** Conversation id per view position. */
  conv: Int32Array;
  convStart: Int32Array;
  convEnd: Int32Array;
  nConv: number;
  /** Turn segmentation (within conversations). */
  turnStart: Int32Array;
  turnEnd: Int32Array;
  nTurns: number;
  /** System message indices (into Prepared) within the date range. */
  systemIdx: number[];
  gapMs: number;
  shift: number;
  /** Stopword test for a vocab id (default list + custom). */
  isStop: (id: number) => boolean;
  firstDay: number;
  lastDay: number;
  /** Messages per person in the view. */
  counts: number[];
  mainPeople: number[];
  otherPeople: number[];
  /** Maps person → series row (main people get their own row, others share the last row). */
  seriesRow: Int32Array;
  seriesRows: number;
  excluded: number;
}

export function buildContext(P: Prepared, s: Settings): Ctx {
  const shift = s.timezoneOffsetHours * HOUR;
  const start = s.dateStart ?? -Infinity;
  const end = s.dateEnd ?? Infinity;
  const np = P.people.length;
  const keep: number[] = [];
  const systemIdx: number[] = [];
  let excluded = 0;
  for (let i = 0; i < P.n; i++) {
    const t = P.ts[i]! + shift;
    const code = P.type[i]!;
    if (t < start || t >= end) {
      if (code !== T.system) excluded++;
      continue;
    }
    if (code === T.system) {
      systemIdx.push(i);
      continue;
    }
    if (P.author[i]! < 0) continue;
    if (!s.includeMedia && isMediaCode(code)) {
      excluded++;
      continue;
    }
    keep.push(i);
  }
  const m = keep.length;
  const idx = Int32Array.from(keep);
  const tl = new Float64Array(m);
  const day = new Int32Array(m);
  const hour = new Uint8Array(m);
  const wd = new Uint8Array(m);
  const au = new Int16Array(m);
  const conv = new Int32Array(m);
  const counts = new Array<number>(np).fill(0);
  const gapMs = s.conversationGapMinutes * MINUTE;
  const cs: number[] = [];
  const ce: number[] = [];
  const tsArr: number[] = [];
  const teArr: number[] = [];
  let c = -1;
  let prevT = -Infinity;
  let prevA = -1;
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    const t = P.ts[i]! + shift;
    tl[k] = t;
    const d = Math.floor(t / DAY);
    day[k] = d;
    hour[k] = Math.floor((t - d * DAY) / HOUR);
    wd[k] = weekdayOfDay(d);
    const a = P.author[i]!;
    au[k] = a;
    counts[a]!++;
    const newConv = t - prevT >= gapMs;
    if (newConv) {
      if (c >= 0) ce.push(k - 1);
      c++;
      cs.push(k);
    }
    conv[k] = c;
    if (newConv || a !== prevA) {
      if (tsArr.length > 0) teArr.push(k - 1);
      tsArr.push(k);
    }
    prevT = t;
    prevA = a;
  }
  if (m > 0) {
    ce.push(m - 1);
    teArr.push(m - 1);
  }

  const custom = new Set(s.stopwords);
  const stopCache = new Uint8Array(P.vocab.length);
  for (let v = 0; v < P.vocab.length; v++) {
    const w = P.vocab[v]!;
    stopCache[v] = P.vocabStop[v] || custom.has(w) || w.length < 2 || /^\d+$/.test(w) || P.vocabLaugh[v]! >= 0 || STOPWORDS.has(w) ? 1 : 0;
  }

  // Main people for charts
  const total = m || 1;
  const order = counts.map((cnt, i) => ({ i, cnt })).sort((a, b) => b.cnt - a.cnt || a.i - b.i);
  const mainPeople: number[] = [];
  const otherPeople: number[] = [];
  for (const { i, cnt } of order) {
    const share = (cnt / total) * 100;
    if ((np <= 2 || (share >= s.othersThresholdPct && mainPeople.length < 12)) && (cnt > 0 || np <= 2)) mainPeople.push(i);
    else otherPeople.push(i);
  }
  // Never put a single person in "Others": promote them instead.
  if (otherPeople.length === 1) mainPeople.push(otherPeople.pop()!);
  const seriesRow = new Int32Array(np);
  const rows = mainPeople.length + (otherPeople.length > 0 ? 1 : 0);
  mainPeople.forEach((p, r) => (seriesRow[p] = r));
  for (const p of otherPeople) seriesRow[p] = mainPeople.length;

  return {
    P,
    s,
    np,
    idx,
    m,
    tl,
    day,
    hour,
    wd,
    au,
    conv,
    convStart: Int32Array.from(cs),
    convEnd: Int32Array.from(ce),
    nConv: cs.length,
    turnStart: Int32Array.from(tsArr),
    turnEnd: Int32Array.from(teArr),
    nTurns: tsArr.length,
    systemIdx,
    gapMs,
    shift,
    isStop: (id: number) => stopCache[id] === 1,
    firstDay: m > 0 ? day[0]! : 0,
    lastDay: m > 0 ? day[m - 1]! : 0,
    counts,
    mainPeople,
    otherPeople,
    seriesRow,
    seriesRows: rows,
    excluded,
  };
}
