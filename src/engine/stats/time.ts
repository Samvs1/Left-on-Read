import type { Ctx } from '../context';
import { T } from '../prepare';
import type { Excerpt, TimeStats } from '../types';
import { DAY, monthOf, monthStart, weekOfDay, weekStart, weekdayOfDay, zeros } from '../util';
import { emptySeries, excerptAt } from './common';

export interface TimePerPerson {
  hourly: number[][];
  weekday: number[][];
  weekdayHour: number[][];
  activeDays: number[];
  night: number[];
  early: number[];
  weekend: number[];
  firstMessage: (Excerpt | null)[];
}

export function computeTime(ctx: Ctx): { time: TimeStats; perPerson: TimePerPerson } {
  const { m, np, day, hour, wd, au, tl, seriesRow } = ctx;
  const P = ctx.P;
  const nDays = m > 0 ? ctx.lastDay - ctx.firstDay + 1 : 0;

  const daily = emptySeries(ctx, nDays);
  for (let d = 0; d < nDays; d++) daily.starts[d] = (ctx.firstDay + d) * DAY;

  const firstWeek = weekOfDay(ctx.firstDay);
  const nWeeks = m > 0 ? weekOfDay(ctx.lastDay) - firstWeek + 1 : 0;
  const weekly = emptySeries(ctx, nWeeks);
  for (let w = 0; w < nWeeks; w++) weekly.starts[w] = weekStart(firstWeek + w);

  const firstMonth = m > 0 ? monthOf(ctx.firstDay * DAY) : 0;
  const nMonths = m > 0 ? monthOf(ctx.lastDay * DAY) - firstMonth + 1 : 0;
  const monthly = emptySeries(ctx, nMonths);
  for (let k = 0; k < nMonths; k++) monthly.starts[k] = monthStart(firstMonth + k);
  const dayMonth = new Int32Array(nDays);
  for (let d = 0; d < nDays; d++) dayMonth[d] = monthOf((ctx.firstDay + d) * DAY) - firstMonth;

  const hourly = zeros(24);
  const weekday = zeros(7);
  const weekdayHour = zeros(168);
  const pp: TimePerPerson = {
    hourly: Array.from({ length: np }, () => zeros(24)),
    weekday: Array.from({ length: np }, () => zeros(7)),
    weekdayHour: Array.from({ length: np }, () => zeros(168)),
    activeDays: zeros(np),
    night: zeros(np),
    early: zeros(np),
    weekend: zeros(np),
    firstMessage: new Array<Excerpt | null>(np).fill(null),
  };
  const lastActive = new Int32Array(np).fill(-1);
  let night = 0;
  let early = 0;
  let weekend = 0;

  for (let k = 0; k < m; k++) {
    const a = au[k]!;
    const d = day[k]! - ctx.firstDay;
    const h = hour[k]!;
    const w = wd[k]!;
    const row = seriesRow[a]!;
    daily.totals[d]!++;
    daily.byPerson[row]![d]!++;
    const wk = weekOfDay(day[k]!) - firstWeek;
    weekly.totals[wk]!++;
    weekly.byPerson[row]![wk]!++;
    const mo = dayMonth[d]!;
    monthly.totals[mo]!++;
    monthly.byPerson[row]![mo]!++;
    hourly[h]!++;
    weekday[w]!++;
    weekdayHour[w * 24 + h]!++;
    pp.hourly[a]![h]!++;
    pp.weekday[a]![w]!++;
    pp.weekdayHour[a]![w * 24 + h]!++;
    if (lastActive[a] !== d) {
      lastActive[a] = d;
      pp.activeDays[a]!++;
    }
    if (h < 5) {
      night++;
      pp.night[a]!++;
    } else if (h < 8) {
      early++;
      pp.early[a]!++;
    }
    if (w >= 5) {
      weekend++;
      pp.weekend[a]!++;
    }
    if (pp.firstMessage[a] === null) pp.firstMessage[a] = excerptAt(ctx, k);
  }

  // Busiest day
  let busiest = -1;
  for (let d = 0; d < nDays; d++) if (busiest < 0 || daily.totals[d]! > daily.totals[busiest]!) busiest = d;
  let busiestDay: TimeStats['busiestDay'] = null;
  if (busiest >= 0 && daily.totals[busiest]! > 0) {
    const dayNum = ctx.firstDay + busiest;
    const byPerson = zeros(np);
    const hourCounts = zeros(24);
    const tokenCounts = new Map<number, number>();
    const emojiCounts = new Map<number, number>();
    let first = -1;
    let last = -1;
    for (let k = 0; k < m; k++) {
      if (day[k] !== dayNum) continue;
      if (first < 0) first = k;
      last = k;
      byPerson[au[k]!]!++;
      hourCounts[hour[k]!]!++;
      const i = ctx.idx[k]!;
      for (let t = P.tokStart[i]!; t < P.tokStart[i + 1]!; t++) {
        const id = P.tokens[t]!;
        if (!ctx.isStop(id) && P.vocab[id]!.length > 2) tokenCounts.set(id, (tokenCounts.get(id) ?? 0) + 1);
      }
      for (let e = P.emoStart[i]!; e < P.emoStart[i + 1]!; e++) emojiCounts.set(P.emoIds[e]!, (emojiCounts.get(P.emoIds[e]!) ?? 0) + 1);
    }
    let bh = 0;
    for (let h = 1; h < 24; h++) if (hourCounts[h]! > hourCounts[bh]!) bh = h;
    const excerpt: Excerpt[] = [];
    for (let k = first; k <= last && excerpt.length < 6; k++) {
      if (hour[k]! < bh) continue;
      if (P.type[ctx.idx[k]!] !== T.text || !P.texts[ctx.idx[k]!]) continue;
      excerpt.push(excerptAt(ctx, k, 120));
    }
    const keywords = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, c]) => c >= 2).map(([id]) => P.vocab[id]!);
    const topE = [...emojiCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    busiestDay = {
      day: dayNum * DAY,
      count: daily.totals[busiest]!,
      byPerson,
      keywords,
      topEmoji: topE ? P.emojiDisplay[topE[0]]! : null,
      excerpt,
    };
  }

  // Streaks
  let longest = { days: 0, start: 0, end: 0 };
  let run = 0;
  let runStart = 0;
  for (let d = 0; d < nDays; d++) {
    if (daily.totals[d]! > 0) {
      if (run === 0) runStart = d;
      run++;
      if (run > longest.days) longest = { days: run, start: (ctx.firstDay + runStart) * DAY, end: (ctx.firstDay + d) * DAY };
    } else run = 0;
  }
  const currentStreak = run;

  // Longest silence
  let longestSilence: TimeStats['longestSilence'] = null;
  for (let k = 1; k < m; k++) {
    const gap = tl[k]! - tl[k - 1]!;
    if (!longestSilence || gap > longestSilence.ms) {
      longestSilence = { ms: gap, start: tl[k - 1]!, end: tl[k]!, brokenBy: au[k]!, startedBy: au[k - 1]! };
    }
  }

  // Weekend ratio: per-day rates
  let weekendDays = 0;
  let weekDays = 0;
  for (let d = 0; d < nDays; d++) (weekdayOfDay(ctx.firstDay + d) >= 5 ? weekendDays++ : weekDays++);
  const weekendRate = weekendDays > 0 ? weekend / weekendDays : 0;
  const weekdayRate = weekDays > 0 ? (m - weekend) / weekDays : 0;

  let busiestMonth: TimeStats['busiestMonth'] = null;
  for (let k = 0; k < nMonths; k++) {
    if (!busiestMonth || monthly.totals[k]! > busiestMonth.count) busiestMonth = { start: monthly.starts[k]!, count: monthly.totals[k]! };
  }
  const activeDays = daily.totals.reduce((acc, c) => acc + (c > 0 ? 1 : 0), 0);
  const total = m || 1;
  return {
    time: {
      daily,
      weekly,
      monthly,
      firstDay: ctx.firstDay * DAY,
      hourly,
      weekday,
      weekdayHour,
      busiestDay,
      busiestHour: hourly.indexOf(Math.max(...hourly)),
      busiestWeekday: weekday.indexOf(Math.max(...weekday)),
      busiestMonth,
      longestStreak: longest,
      currentStreak,
      longestSilence,
      nightOwlPct: night / total,
      earlyBirdPct: early / total,
      weekendPct: weekend / total,
      weekendRatio: weekdayRate > 0 ? weekendRate / weekdayRate : 0,
      chatAgeDays: nDays,
      firstMessage: m > 0 ? excerptAt(ctx, 0) : null,
      activeDaysPct: nDays > 0 ? activeDays / nDays : 0,
    },
    perPerson: pp,
  };
}
