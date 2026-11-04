/**
 * One-line, plain-language takeaways generated from the stats.
 */
import type { ChatStats, PersonStats } from '../engine/types';
import type { TKey, TParams } from '../i18n';
import { fmtDuration, fmtHour, fmtMonth, fmtMonthRange, fmtNum, fmtPct, fmtTimes, listFormat, weekdayName } from './format';

type T = (k: TKey, p?: TParams) => string;
type N = (i: number) => string;

const SLOT_KEYS: TKey[] = [
  'slots.weekdayMorning',
  'slots.weekdayAfternoon',
  'slots.weekdayEvening',
  'slots.weekdayNight',
  'slots.weekendMorning',
  'slots.weekendAfternoon',
  'slots.weekendEvening',
  'slots.weekendNight',
];

export function active(s: ChatStats): PersonStats[] {
  return s.people.filter((p) => p.messages > 0);
}

export function topBy<K extends keyof PersonStats>(s: ChatStats, key: K, minMessages = 1): PersonStats | null {
  let best: PersonStats | null = null;
  for (const p of s.people) {
    if (p.messages < minMessages) continue;
    const v = p[key] as unknown as number;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (!best || v > (best[key] as unknown as number)) best = p;
  }
  return best;
}

/** The slot where a person over-indexes most on starting conversations. */
export function initiationSlot(s: ChatStats, p: PersonStats): number | null {
  const total = p.initiationSlots.reduce((a, b) => a + b, 0);
  if (total < 8) return null;
  const all = Array.from({ length: 8 }, (_, k) => s.people.reduce((acc, q) => acc + (q.initiationSlots[k] ?? 0), 0));
  const allTotal = all.reduce((a, b) => a + b, 0) || 1;
  let best = -1;
  let bestLift = 1.15;
  for (let k = 0; k < 8; k++) {
    const mine = p.initiationSlots[k]! / total;
    const base = all[k]! / allTotal;
    if (p.initiationSlots[k]! < 3 || base === 0) continue;
    // weight by own share so tiny slots don't win
    const lift = (mine / base) * Math.sqrt(mine * 4);
    if (lift > bestLift) {
      bestLift = lift;
      best = k;
    }
  }
  if (best < 0) {
    // fall back to the slot with most starts
    best = p.initiationSlots.indexOf(Math.max(...p.initiationSlots));
  }
  return best;
}

export const tk = {
  timeline(s: ChatStats, t: T): string | null {
    const m = s.time.busiestMonth;
    return m ? t('takeaways.timelinePeak', { month: fmtMonth(m.start), n: fmtNum(m.count) }) : null;
  },
  calendar(s: ChatStats, t: T): string {
    return t('takeaways.calendar', { pct: fmtPct(s.time.activeDaysPct), streak: t('common.days', { n: s.time.longestStreak.days }) });
  },
  weekdayHour(s: ChatStats, t: T): string | null {
    const cells = s.time.weekdayHour;
    let best = 0;
    for (let i = 1; i < cells.length; i++) if (cells[i]! > cells[best]!) best = i;
    if (!cells[best]) return null;
    return t('takeaways.weekdayHour', { weekday: weekdayName(Math.floor(best / 24)), hour: fmtHour(best % 24) });
  },
  hourly(s: ChatStats, t: T): string {
    return t('takeaways.hourly', { hour: fmtHour(s.time.busiestHour), night: fmtPct(s.time.nightOwlPct) });
  },
  weekday(s: ChatStats, t: T): string {
    return t('takeaways.weekday', { weekday: weekdayName(s.time.busiestWeekday), ratio: fmtTimes(s.time.weekendRatio) });
  },
  initiations(s: ChatStats, t: T, name: N): string | null {
    const p = topBy(s, 'initiationShare', 5);
    if (!p || s.dynamics.conversations < 3) return null;
    const slot = initiationSlot(s, p);
    return slot !== null
      ? t('takeaways.initiations', { name: name(p.id), pct: fmtPct(p.initiationShare), slot: t(SLOT_KEYS[slot]!) })
      : t('takeaways.initiationsPlain', { name: name(p.id), pct: fmtPct(p.initiationShare) });
  },
  reply(s: ChatStats, t: T, name: N): string | null {
    const ps = active(s).filter((p) => p.responseTime && p.responseTime.count >= 5);
    if (ps.length === 0) return null;
    ps.sort((a, b) => a.responseTime!.median - b.responseTime!.median);
    const fast = ps[0]!;
    const slow = ps[ps.length - 1]!;
    if (ps.length === 1 || slow.responseTime!.median < fast.responseTime!.median * 1.25) {
      return t('takeaways.replySame', { t: fmtDuration(s.dynamics.responseTime?.median ?? fast.responseTime!.median) });
    }
    return t('takeaways.replyFast', { fast: name(fast.id), t1: fmtDuration(fast.responseTime!.median), slow: name(slow.id), t2: fmtDuration(slow.responseTime!.median) });
  },
  replyHist(s: ChatStats, t: T): string | null {
    const total = s.people.reduce((a, p) => a + p.responseHistogram.reduce((x, y) => x + y, 0), 0);
    if (!total) return null;
    const fast = s.people.reduce((a, p) => a + (p.responseHistogram[0] ?? 0) + (p.responseHistogram[1] ?? 0), 0);
    return t('takeaways.replyHist', { pct: fmtPct(fast / total) });
  },
  replyHour(s: ChatStats, t: T): string | null {
    const arr = s.dynamics.responseByHour;
    let lo = -1;
    let hi = -1;
    for (let h = 0; h < 24; h++) {
      const v = arr[h];
      if (v === null || v === undefined) continue;
      if (s.time.hourly[h]! < Math.max(10, s.meta.totalMessages * 0.01)) continue;
      if (lo < 0 || v < arr[lo]!) lo = h;
      if (hi < 0 || v > arr[hi]!) hi = h;
    }
    if (lo < 0 || hi < 0 || lo === hi) return null;
    return t('takeaways.replyHour', { fastHour: fmtHour(lo), slowHour: fmtHour(hi) });
  },
  convLength(s: ChatStats, t: T): string {
    return t('takeaways.convLength', { n: fmtNum(s.dynamics.medianConversationMessages), d: fmtDuration(s.dynamics.medianConversationDurationMs) });
  },
  questions(s: ChatStats, t: T, name: N): string | null {
    const p = topBy(s, 'questionsAsked');
    if (!p || p.questionsAsked < 3) return null;
    return t('takeaways.questions', { name: name(p.id), pct: fmtPct(p.questionsAnsweredByOthers / Math.max(1, p.questionsAsked)) });
  },
  doubleGhost(s: ChatStats, t: T, name: N): string | null {
    const d = topBy(s, 'doubleTexts');
    const g = topBy(s, 'ghostedOthers');
    if (!d || !g || (d.doubleTexts === 0 && g.ghostedOthers === 0)) return null;
    return t('takeaways.doubleGhost', { name: name(d.id), n: fmtNum(d.doubleTexts), ghost: name(g.id) });
  },
  effort(s: ChatStats, t: T, name: N): string | null {
    const e = s.dynamics.effort;
    if (!e || s.people.length < 2) return null;
    const a = s.people[0]!;
    const b = s.people[1]!;
    if (Math.abs(e.score - 50) < 4) return t('takeaways.effortBalanced', { pct: fmtPct(e.score / 100), pct2: fmtPct(1 - e.score / 100) });
    const lead = e.score >= 50 ? a : b;
    return t('takeaways.effortDuo', { name: name(lead.id), pct: fmtPct(Math.max(e.score, 100 - e.score) / 100) });
  },
  interestInit(s: ChatStats, t: T, name: N): string | null {
    const it = s.dynamics.interest;
    if (it.months.length < 3) return null;
    let best: { p: number; from: number; to: number; d: number } | null = null;
    it.initiationShare.forEach((row, r) => {
      const vals = row.filter((v): v is number => v !== null);
      if (vals.length < 3) return;
      const k = Math.max(1, Math.floor(vals.length / 3));
      const from = vals.slice(0, k).reduce((a, b) => a + b, 0) / k;
      const to = vals.slice(-k).reduce((a, b) => a + b, 0) / k;
      const d = Math.abs(to - from);
      if (!best || d > best.d) best = { p: s.meta.mainPeople[r]!, from, to, d };
    });
    const b = best as { p: number; from: number; to: number; d: number } | null;
    if (!b) return null;
    return t('takeaways.interestInit', { name: name(b.p), from: fmtPct(b.from), to: fmtPct(b.to) });
  },
  topWords(s: ChatStats, t: T): string | null {
    const w = s.words.topWords[0];
    return w ? t('takeaways.topWords', { word: w.key, n: fmtNum(w.count) }) : null;
  },
  bigrams(s: ChatStats, t: T): string | null {
    const w = s.words.topBigrams[0];
    return w ? t('takeaways.bigrams', { phrase: w.key }) : null;
  },
  signature(s: ChatStats, t: T, name: N): string | null {
    const p = active(s).find((x) => x.signatureWords.length > 0);
    return p ? t('takeaways.signature', { name: name(p.id), word: p.signatureWords[0]!.key }) : null;
  },
  catchphrases(s: ChatStats, t: T, name: N): string | null {
    const p = active(s).find((x) => x.catchphrases.length > 0);
    return p ? t('takeaways.catchphrases', { phrase: p.catchphrases[0]!.key, name: name(p.id), pct: fmtPct(p.catchphrases[0]!.share) }) : null;
  },
  greetings(s: ChatStats, t: T): string | null {
    const h = s.words.greetings[0];
    const b = s.words.goodbyes[0];
    return h && b ? t('takeaways.greetings', { hello: h.key, bye: b.key }) : null;
  },
  swears(s: ChatStats, t: T, name: N): string {
    const sw = s.words.swears;
    if (sw.total < 3) return t('takeaways.swearsNone');
    let top = 0;
    sw.byPerson.forEach((v, i) => {
      if (v > (sw.byPerson[top] ?? 0)) top = i;
    });
    return t('takeaways.swears', { n: fmtNum(sw.total), name: name(top) });
  },
  topEmojis(s: ChatStats, t: T): string | null {
    const e = s.emojis.top[0];
    return e ? t('takeaways.topEmojis', { emoji: e.display, n: fmtNum(e.count) }) : null;
  },
  emojiTime(s: ChatStats, t: T): string | null {
    const ser = s.emojis.monthly.series[0];
    if (!ser) return null;
    let best = 0;
    ser.counts.forEach((v, i) => {
      if (v > ser.counts[best]!) best = i;
    });
    return t('takeaways.emojiTime', { emoji: ser.display, month: fmtMonth(s.emojis.monthly.starts[best]!) });
  },
  hearts(s: ChatStats, t: T): string | null {
    const h = s.emojis.hearts[0];
    return h ? t('takeaways.hearts', { heart: h.display }) : null;
  },
  media(s: ChatStats, t: T, typeName: (k: string) => string): string | null {
    const entries = Object.entries(s.media.byType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    return t('takeaways.mediaTypes', { n: fmtNum(s.media.total), top: typeName(entries[0]![0]) });
  },
  mediaPeople(s: ChatStats, t: T, name: N): string | null {
    const p = topBy(s, 'mediaTotal');
    return p && p.mediaTotal > 0 ? t('takeaways.mediaPeople', { name: name(p.id) }) : null;
  },
  domains(s: ChatStats, t: T): string | null {
    const d = s.media.links.topDomains[0];
    return d ? t('takeaways.domains', { domain: d.key, n: fmtNum(d.count) }) : null;
  },
  mood(s: ChatStats, t: T): string | null {
    const m = s.sentiment.monthly;
    let best = -1;
    m.overall.forEach((v, i) => {
      if (v !== null && (best < 0 || v > m.overall[best]!)) best = i;
    });
    return best >= 0 ? t('takeaways.mood', { month: fmtMonth(m.starts[best]!) }) : null;
  },
  moodPeople(s: ChatStats, t: T, name: N): string | null {
    const g = s.sentiment.goodVibes;
    if (g < 0) return null;
    return t('takeaways.moodPeople', { name: name(g), pct: fmtPct(s.people[g]!.positiveShare) });
  },
  eras(s: ChatStats, t: T, eraName: (k: string, ord: number) => string): string | null {
    if (s.eras.length <= 1) return s.eras.length ? t('takeaways.erasOne') : null;
    const g = s.eras.find((e) => e.kind === 'golden') ?? s.eras[0]!;
    return t('takeaways.eras', { n: s.eras.length, golden: eraName(g.kind, g.ordinal), range: fmtMonthRange(g.start, g.end) });
  },
  style(s: ChatStats, t: T, name: N): string | null {
    const p = topBy(s, 'avgWords', 20);
    return p ? t('takeaways.style', { name: name(p.id), n: fmtNum(p.avgWords, 1) }) : null;
  },
  leaderboard(s: ChatStats, t: T, name: N): string | null {
    const p = topBy(s, 'messages');
    return p ? t('takeaways.leaderboard', { name: name(p.id), n: fmtNum(p.messages) }) : null;
  },
  lurkers(s: ChatStats, t: T, name: N): string {
    const l = s.group?.lurkers ?? [];
    return l.length ? t('takeaways.lurkers', { names: listFormat(l.map(name)) }) : t('takeaways.lurkersNone');
  },
  cliques(s: ChatStats, t: T, name: N): string {
    const c = s.group?.cliques[0];
    return c ? t('takeaways.cliques', { a: name(c.a), b: name(c.b), x: fmtTimes(c.score) }) : t('takeaways.cliquesNone');
  },
  fastestPairs(s: ChatStats, t: T, name: N): string | null {
    const f = s.group?.fastestPairs[0];
    return f ? t('takeaways.fastestPairs', { from: name(f.from), to: name(f.to), t: fmtDuration(f.medianMs) }) : null;
  },
  glue(s: ChatStats, t: T, name: N): string | null {
    const g = s.group?.glue ?? -1;
    return g >= 0 ? t('takeaways.glue', { name: name(g), n: fmtNum(s.people[g]!.revives) }) : null;
  },
  membership(s: ChatStats, t: T): string | null {
    const mc = s.group?.memberCount ?? [];
    if (!mc.length) return null;
    const peak = mc.reduce((a, b) => (b.count > a.count ? b : a), mc[0]!);
    return t('takeaways.membership', { n: peak.count, month: fmtMonth(peak.ts) });
  },
  network(s: ChatStats, t: T, name: N): string | null {
    const g = s.group;
    if (!g || !g.network.edges.length) return null;
    const deg = new Map<number, number>();
    for (const e of g.network.edges) {
      deg.set(e.a, (deg.get(e.a) ?? 0) + e.weight);
      deg.set(e.b, (deg.get(e.b) ?? 0) + e.weight);
    }
    const top = [...deg.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? t('takeaways.network', { a: name(top[0]) }) : null;
  },
  replyMatrix(s: ChatStats, t: T, name: N): string | null {
    const m = s.dynamics.replyMatrix;
    const ppl = s.dynamics.matrixPeople;
    let best: [number, number, number] | null = null;
    for (let i = 0; i < ppl.length; i++) for (let j = i + 1; j < ppl.length; j++) {
      const v = (m[i]?.[j] ?? 0) + (m[j]?.[i] ?? 0);
      if (!best || v > best[2]) best = [ppl[i]!, ppl[j]!, v];
    }
    return best && best[2] > 0 ? t('takeaways.replyMatrix', { a: name(best[0]), b: name(best[1]) }) : null;
  },
  laughs(s: ChatStats, t: T, name: N): string | null {
    const p = topBy(s, 'laughRate', 20);
    return p && p.laughs > 0 ? t('takeaways.laughs', { name: name(p.id), pct: fmtPct(p.laughRate / 100) }) : null;
  },
  comedian(s: ChatStats, t: T, name: N): string | null {
    const c = s.laughter.comedian;
    return c >= 0 ? t('takeaways.comedian', { name: name(c), n: fmtNum(s.laughter.triggeredByPerson[c]!) }) : null;
  },
};
