import type { Ctx } from '../context';
import { F } from '../prepare';
import type { DynamicsStats, InterestTrend, ResponseBin } from '../types';
import { HOUR, MINUTE, median, monthStart, percentiles, zeros } from '../util';

export const RESPONSE_BINS: ResponseBin[] = [
  { max: MINUTE, label: '<1m' },
  { max: 5 * MINUTE, label: '1–5m' },
  { max: 15 * MINUTE, label: '5–15m' },
  { max: 30 * MINUTE, label: '15–30m' },
  { max: HOUR, label: '30m–1h' },
  { max: 2 * HOUR, label: '1–2h' },
  { max: 4 * HOUR, label: '2–4h' },
  { max: Infinity, label: '4h+' },
];

const CONV_BINS: { max: number; label: string }[] = [
  { max: 1, label: '1' },
  { max: 5, label: '2–5' },
  { max: 10, label: '6–10' },
  { max: 25, label: '11–25' },
  { max: 50, label: '26–50' },
  { max: 100, label: '51–100' },
  { max: 250, label: '101–250' },
  { max: Infinity, label: '250+' },
];

const binOf = (rt: number) => {
  for (let b = 0; b < RESPONSE_BINS.length; b++) if (rt < RESPONSE_BINS[b]!.max) return b;
  return RESPONSE_BINS.length - 1;
};

export interface DynamicsPerPerson {
  initiations: number[];
  endings: number[];
  ghostedOthers: number[];
  gotGhosted: number[];
  ghostChances: number[];
  responseTimes: number[][];
  responseHist: number[][];
  responseByHour: (number | null)[][];
  doubleTexts: number[];
  longestMonologue: ({ messages: number; ts: number; durationMs: number } | null)[];
  questionsAsked: number[];
  questionsAnsweredByOthers: number[];
  questionsAnswered: number[];
  revives: number[];
  turns: number[];
  /** Full reply counts among the top people (pairCount[a][b] = b replied to a). */
  pairPeople: number[];
  pairCount: number[][];
  pairTimes: number[][][];
  conversationsJoined: number[];
  /** Conversation starts per person in 8 slots: weekday/weekend × morning/afternoon/evening/night. */
  initiationSlots: number[][];
}

export function computeDynamics(ctx: Ctx): { dynamics: Omit<DynamicsStats, 'effort'>; perPerson: DynamicsPerPerson } {
  const { m, np, au, tl, hour, conv, convStart, convEnd, nConv, turnStart, turnEnd, nTurns, P, s } = ctx;
  const ghostMs = Math.max(s.ghostingThresholdMinutes * MINUTE, ctx.gapMs);
  const doubleMs = s.doubleTextMinutes * MINUTE;
  const reviveMs = s.reviveThresholdHours * HOUR;

  const pp: DynamicsPerPerson = {
    initiations: zeros(np),
    endings: zeros(np),
    ghostedOthers: zeros(np),
    gotGhosted: zeros(np),
    ghostChances: zeros(np),
    responseTimes: Array.from({ length: np }, () => []),
    responseHist: Array.from({ length: np }, () => zeros(RESPONSE_BINS.length)),
    responseByHour: [],
    doubleTexts: zeros(np),
    longestMonologue: new Array(np).fill(null),
    questionsAsked: zeros(np),
    questionsAnsweredByOthers: zeros(np),
    questionsAnswered: zeros(np),
    revives: zeros(np),
    turns: zeros(np),
    pairPeople: [],
    pairCount: [],
    pairTimes: [],
    conversationsJoined: zeros(np),
    initiationSlots: Array.from({ length: np }, () => zeros(8)),
  };

  // Top people for the full pair matrix (cliques, fastest pairs)
  const byCount = ctx.counts.map((c, i) => ({ c, i })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 64);
  pp.pairPeople = byCount.map((x) => x.i);
  const pairPos = new Int32Array(np).fill(-1);
  pp.pairPeople.forEach((p, k) => (pairPos[p] = k));
  const nPair = pp.pairPeople.length;
  pp.pairCount = Array.from({ length: nPair }, () => zeros(nPair));
  pp.pairTimes = Array.from({ length: nPair }, () => Array.from({ length: nPair }, () => [] as number[]));

  /* ---------- Conversations ---------- */
  const convLens: number[] = [];
  const convDurs: number[] = [];
  const convBins = CONV_BINS.map((b) => ({ label: b.label, count: 0 }));
  let longestConversation: DynamicsStats['longestConversation'] = null;
  const stamp = new Int32Array(np).fill(-1);
  const convMembers: number[][] = [];
  for (let c = 0; c < nConv; c++) {
    const a0 = convStart[c]!;
    const a1 = convEnd[c]!;
    pp.initiations[au[a0]!]!++;
    pp.endings[au[a1]!]!++;
    {
      const h = hour[a0]!;
      const part = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3;
      pp.initiationSlots[au[a0]!]![(ctx.wd[a0]! >= 5 ? 4 : 0) + part]!++;
    }
    const len = a1 - a0 + 1;
    const dur = tl[a1]! - tl[a0]!;
    convLens.push(len);
    convDurs.push(dur);
    for (let b = 0; b < CONV_BINS.length; b++) {
      if (len <= CONV_BINS[b]!.max) {
        convBins[b]!.count++;
        break;
      }
    }
    if (!longestConversation || len > longestConversation.messages) longestConversation = { messages: len, durationMs: dur, start: tl[a0]! };
    if (c > 0 && tl[a0]! - tl[convEnd[c - 1]!]! >= reviveMs) pp.revives[au[a0]!]!++;
    const members: number[] = [];
    for (let k = a0; k <= a1; k++) {
      const a = au[k]!;
      if (stamp[a] !== c) {
        stamp[a] = c;
        members.push(a);
        pp.conversationsJoined[a]!++;
      }
    }
    convMembers.push(members);
  }

  /* ---------- Ghosting ---------- */
  const nextOther = new Int32Array(m);
  if (m > 0) nextOther[m - 1] = m;
  for (let k = m - 2; k >= 0; k--) nextOther[k] = au[k + 1] !== au[k] ? k + 1 : nextOther[k + 1]!;
  for (let c = 0; c < nConv - 1; c++) {
    const e = convEnd[c]!;
    const ender = au[e]!;
    const j = nextOther[e]!;
    const gap = j < m ? tl[j]! - tl[e]! : Infinity;
    let others = convMembers[c]!.filter((p) => p !== ender);
    if (others.length === 0 && np === 2) others = [1 - ender];
    for (const p of others) pp.ghostChances[p]!++;
    if (gap > ghostMs) {
      pp.gotGhosted[ender]!++;
      for (const p of others) pp.ghostedOthers[p]!++;
    }
  }

  /* ---------- Turns: responses, monologues, questions ---------- */
  const rows = ctx.seriesRows;
  const replyMatrix = Array.from({ length: rows }, () => zeros(rows));
  const replyTimes: number[][][] = Array.from({ length: rows }, () => Array.from({ length: rows }, () => [] as number[]));
  const byHourAll: number[][] = Array.from({ length: 24 }, () => []);
  const byHourPerson: number[][][] = Array.from({ length: np }, () => Array.from({ length: 24 }, () => [] as number[]));
  const allRt: number[] = [];
  let turnMsgTotal = 0;
  for (let t = 0; t < nTurns; t++) {
    const k0 = turnStart[t]!;
    const k1 = turnEnd[t]!;
    const a = au[k0]!;
    pp.turns[a]!++;
    const len = k1 - k0 + 1;
    turnMsgTotal += len;
    const mono = pp.longestMonologue[a];
    if (!mono || len > mono.messages) pp.longestMonologue[a] = { messages: len, ts: tl[k0]!, durationMs: tl[k1]! - tl[k0]! };

    // Response to the previous turn (same conversation)
    if (t > 0) {
      const pe = turnEnd[t - 1]!;
      if (conv[pe] === conv[k0]) {
        const prev = au[pe]!;
        const rt = tl[k0]! - tl[pe]!;
        pp.responseTimes[a]!.push(rt);
        pp.responseHist[a]![binOf(rt)]!++;
        allRt.push(rt);
        const h = hour[pe]!;
        byHourAll[h]!.push(rt);
        byHourPerson[a]![h]!.push(rt);
        const r0 = ctx.seriesRow[prev]!;
        const r1 = ctx.seriesRow[a]!;
        replyMatrix[r0]![r1]!++;
        replyTimes[r0]![r1]!.push(rt);
        const q0 = pairPos[prev]!;
        const q1 = pairPos[a]!;
        if (q0 >= 0 && q1 >= 0) {
          pp.pairCount[q0]![q1]!++;
          pp.pairTimes[q0]![q1]!.push(rt);
        }
      }
    }

    // Questions in this turn
    let q = 0;
    for (let k = k0; k <= k1; k++) if (P.flags[ctx.idx[k]!]! & F.QUESTION) q++;
    if (q > 0) {
      pp.questionsAsked[a]! += q;
      if (t + 1 < nTurns && conv[turnStart[t + 1]!] === conv[k1]) {
        pp.questionsAnsweredByOthers[a]! += q;
        pp.questionsAnswered[au[turnStart[t + 1]!]!]!++;
      }
    }
  }

  /* ---------- Double texts ---------- */
  for (let k = 1; k < m; k++) if (au[k] === au[k - 1] && tl[k]! - tl[k - 1]! > doubleMs) pp.doubleTexts[au[k]!]!++;

  pp.responseByHour = byHourPerson.map((hours) => hours.map((arr) => (arr.length >= 3 ? median(arr) : null)));

  /* ---------- Interest trend (per month, main people) ---------- */
  const interest = interestTrend(ctx);

  const sortedLens = Float64Array.from(convLens).sort();
  const sortedDurs = Float64Array.from(convDurs).sort();
  const meanOf = (arr: number[]) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
  return {
    dynamics: {
      conversations: nConv,
      avgConversationMessages: meanOf(convLens),
      medianConversationMessages: sortedLens.length ? sortedLens[Math.floor(sortedLens.length / 2)]! : 0,
      avgConversationDurationMs: meanOf(convDurs),
      medianConversationDurationMs: sortedDurs.length ? sortedDurs[Math.floor(sortedDurs.length / 2)]! : 0,
      conversationLengthBins: convBins,
      longestConversation,
      responseBins: RESPONSE_BINS,
      responseTime: percentiles(allRt),
      responseByHour: byHourAll.map((arr) => (arr.length >= 3 ? median(arr) : null)),
      replyMatrix,
      replyMedianMatrix: replyTimes.map((row) => row.map((arr) => (arr.length >= 5 ? median(arr) : null))),
      matrixPeople: ctx.mainPeople,
      turns: nTurns,
      avgMessagesPerTurn: nTurns ? turnMsgTotal / nTurns : 0,
      interest,
    },
    perPerson: pp,
  };
}

function interestTrend(ctx: Ctx): InterestTrend {
  const { m, tl, au, convStart, nConv, turnStart, turnEnd, nTurns, conv } = ctx;
  const main = ctx.mainPeople;
  if (m === 0) return { months: [], initiationShare: main.map(() => []), medianResponse: main.map(() => []), messages: main.map(() => []) };
  const first = ctx.firstMonth;
  const nMonths = ctx.nMonths;
  const pos = new Int32Array(ctx.np).fill(-1);
  main.forEach((p, i) => (pos[p] = i));
  const convs = zeros(nMonths);
  const inits = main.map(() => zeros(nMonths));
  const msgs = main.map(() => zeros(nMonths));
  const rts = main.map(() => Array.from({ length: nMonths }, () => [] as number[]));
  const mon = ctx.mon;
  for (let c = 0; c < nConv; c++) {
    const k = convStart[c]!;
    const mo = mon[k]!;
    convs[mo]!++;
    const p = pos[au[k]!]!;
    if (p >= 0) inits[p]![mo]!++;
  }
  for (let k = 0; k < m; k++) {
    const p = pos[au[k]!]!;
    if (p >= 0) msgs[p]![mon[k]!]!++;
  }
  for (let t = 1; t < nTurns; t++) {
    const k0 = turnStart[t]!;
    const pe = turnEnd[t - 1]!;
    if (conv[pe] !== conv[k0]) continue;
    const p = pos[au[k0]!]!;
    if (p < 0) continue;
    rts[p]![mon[k0]!]!.push(tl[k0]! - tl[pe]!);
  }
  return {
    months: Array.from({ length: nMonths }, (_, i) => monthStart(first + i)),
    initiationShare: inits.map((row) => row.map((v, i) => (convs[i]! > 0 ? v / convs[i]! : null))),
    medianResponse: rts.map((row) => row.map((arr) => (arr.length >= 3 ? median(arr) : null))),
    messages: msgs,
  };
}
