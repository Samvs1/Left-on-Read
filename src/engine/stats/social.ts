/**
 * Group- and duo-specific statistics.
 */
import type { Ctx } from '../context';
import { F } from '../prepare';
import type { DuoStats, GroupStats, MembershipEvent } from '../types';
import { DAY, HOUR, median, monthOf, monthStart, zeros } from '../util';
import type { DynamicsPerPerson } from './dynamics';
import type { ContentPerPerson } from './content';
import { firstUses } from '../search';

/** Who sends the first morning message (05:00–12:00) and the last goodnight of each night. */
export function morningAndNight(ctx: Ctx): { morningFirsts: number[]; goodnightLasts: number[] } {
  const { m, np, au, day, hour, tl, idx, P } = ctx;
  const morningFirsts = zeros(np);
  const goodnightLasts = zeros(np);
  let lastMorningDay = -1;
  const nightLast = new Map<number, number>();
  for (let k = 0; k < m; k++) {
    const h = hour[k]!;
    if (h >= 5 && h < 12 && day[k] !== lastMorningDay) {
      lastMorningDay = day[k]!;
      morningFirsts[au[k]!]!++;
    }
    if (P.flags[idx[k]!]! & F.GOODNIGHT && (h >= 18 || h < 5)) {
      const night = Math.floor((tl[k]! - 5 * HOUR) / DAY);
      nightLast.set(night, au[k]!);
    }
  }
  for (const a of nightLast.values()) goodnightLasts[a]!++;
  return { morningFirsts, goodnightLasts };
}

export function computeGroup(ctx: Ctx, dyn: DynamicsPerPerson, content: ContentPerPerson): GroupStats {
  const { P, np, m } = ctx;
  const memberEvents: MembershipEvent[] = [];
  const subjectChanges: GroupStats['subjectChanges'] = [];
  const sysByIdx = new Map(P.systems.map((x) => [x.i, x]));
  for (const i of ctx.systemIdx) {
    const s = sysByIdx.get(i);
    if (!s) continue;
    const ts = P.ts[i]! + ctx.shift;
    switch (s.kind) {
      case 'created':
        if (s.actor) memberEvents.push({ ts, kind: 'created', person: s.actor, actor: null });
        if (s.subject) subjectChanges.push({ ts, actor: s.actor, subject: s.subject });
        break;
      case 'added':
      case 'removed':
        for (const t of s.targets) memberEvents.push({ ts, kind: s.kind, person: t, actor: s.actor });
        break;
      case 'joined':
      case 'left':
        if (s.actor) memberEvents.push({ ts, kind: s.kind, person: s.actor, actor: null });
        else for (const t of s.targets) memberEvents.push({ ts, kind: s.kind, person: t, actor: null });
        break;
      case 'subject':
        if (s.subject) subjectChanges.push({ ts, actor: s.actor, subject: s.subject });
        break;
      default:
        break;
    }
  }
  // Active members per month (sent at least one message that month)
  const memberCount: GroupStats['memberCount'] = [];
  if (m > 0) {
    const first = monthOf(ctx.firstDay * DAY);
    const last = monthOf(ctx.lastDay * DAY);
    const sets = Array.from({ length: last - first + 1 }, () => new Set<number>());
    let curDay = -1;
    let curMonth = 0;
    for (let k = 0; k < m; k++) {
      if (ctx.day[k] !== curDay) {
        curDay = ctx.day[k]!;
        curMonth = monthOf(curDay * DAY) - first;
      }
      sets[curMonth]!.add(ctx.au[k]!);
    }
    sets.forEach((s, i) => memberCount.push({ ts: monthStart(first + i), count: s.size }));
  }
  const posters = new Set(P.people);
  const silentMembers = [...new Set(memberEvents.filter((e) => e.kind !== 'left' && e.kind !== 'removed').map((e) => e.person))]
    .filter((name) => !posters.has(name) && name !== 'You')
    .slice(0, 30);

  const total = Math.max(1, m);
  const avgShare = 1 / Math.max(1, np);
  const lurkers =
    np >= 4
      ? content.messages
          .map((c, a) => ({ a, share: c / total }))
          .filter((x) => x.share > 0 && x.share < avgShare * 0.25)
          .sort((x, y) => x.share - y.share)
          .slice(0, 6)
          .map((x) => x.a)
      : [];

  // Network & pairs (top people)
  const people = dyn.pairPeople;
  const nP = people.length;
  const edges: GroupStats['network']['edges'] = [];
  for (let x = 0; x < nP; x++) {
    for (let y = x + 1; y < nP; y++) {
      const w = dyn.pairCount[x]![y]! + dyn.pairCount[y]![x]!;
      if (w > 0) edges.push({ a: people[x]!, b: people[y]!, weight: w });
    }
  }
  edges.sort((p, q) => q.weight - p.weight);
  const fastestPairs: GroupStats['fastestPairs'] = [];
  for (let x = 0; x < nP; x++) {
    for (let y = 0; y < nP; y++) {
      if (x === y) continue;
      const arr = dyn.pairTimes[x]![y]!;
      if (arr.length < 10) continue;
      fastestPairs.push({ from: people[x]!, to: people[y]!, medianMs: median(arr)!, samples: arr.length });
    }
  }
  fastestPairs.sort((p, q) => p.medianMs - q.medianMs);

  // Cliques: lift of "b replies to a" relative to a's share of turns among b's possible targets.
  const turnsOf = people.map((p) => dyn.turns[p]!);
  const totalTurns = turnsOf.reduce((x, y) => x + y, 0);
  const lift = (x: number, y: number) => {
    // y replying to x
    const repliesByY = dyn.pairCount.reduce((acc, row) => acc + row[y]!, 0);
    if (repliesByY === 0) return 0;
    const observed = dyn.pairCount[x]![y]! / repliesByY;
    const expected = turnsOf[x]! / Math.max(1, totalTurns - turnsOf[y]!);
    return expected > 0 ? observed / expected : 0;
  };
  const cliques: GroupStats['cliques'] = [];
  if (np >= 3) {
    for (let x = 0; x < nP; x++) {
      for (let y = x + 1; y < nP; y++) {
        const replies = dyn.pairCount[x]![y]! + dyn.pairCount[y]![x]!;
        if (replies < 15) continue;
        const score = Math.sqrt(lift(x, y) * lift(y, x));
        if (score > 1.3) cliques.push({ a: people[x]!, b: people[y]!, score, replies });
      }
    }
    cliques.sort((p, q) => q.score - p.score);
  }
  let glue = -1;
  for (let a = 0; a < np; a++) if (dyn.revives[a]! > 0 && (glue < 0 || dyn.revives[a]! > dyn.revives[glue]!)) glue = a;
  return {
    memberEvents,
    memberCount,
    lurkers,
    silentMembers,
    network: {
      nodes: people.slice(0, 24).map((p) => ({ id: p, messages: content.messages[p]! })),
      edges: edges.filter((e) => people.indexOf(e.a) < 24 && people.indexOf(e.b) < 24).slice(0, 80),
    },
    fastestPairs: fastestPairs.slice(0, 8),
    cliques: cliques.slice(0, 6),
    glue,
    revivesByPerson: dyn.revives,
    subjectChanges,
  };
}

export function computeDuo(ctx: Ctx, content: ContentPerPerson, mn: { morningFirsts: number[]; goodnightLasts: number[] }): DuoStats {
  const a = ctx.mainPeople[0] ?? 0;
  const b = ctx.mainPeople[1] ?? 1;
  const pair = (arr: number[]): [number, number] => [arr[a] ?? 0, arr[b] ?? 0];
  return {
    a,
    b,
    morningFirsts: pair(mn.morningFirsts),
    goodnightLasts: pair(mn.goodnightLasts),
    apologies: pair(content.apologies),
    loveYous: pair(content.loves),
    firsts: firstUses(ctx, ctx.s.firstsWords),
  };
}
