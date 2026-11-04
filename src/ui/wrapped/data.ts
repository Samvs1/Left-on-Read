/**
 * Wrapped: turns the statistics of one period into everything the video
 * needs, with every piece of copy already resolved. Pure (no DOM), so it is
 * unit-tested in Node. Message text never ends up in here: only counts, top
 * words, emojis, names and award lines.
 */
import type { ChatStats } from '../../engine/types';
import { translate, type Lang, type TKey, type TParams } from '../../i18n';
import { AWARD_META, awardValue, rankedAwards } from '../awards';
import {
  fmtCompact,
  fmtDate,
  fmtDateRange,
  fmtDuration,
  fmtHour,
  fmtHourShort,
  fmtMonth,
  fmtMonthName,
  fmtMonthNarrow,
  fmtMonthRange,
  fmtNum,
  fmtPct,
  fmtTimes,
  weekdayName,
} from '../format';
import { initials } from '../names';

/** Headlines start with a capital, even where the language writes months and weekdays in lowercase. */
const cap = (s: string) => (s ? s[0]!.toLocaleUpperCase() + s.slice(1) : s);

/* ------------------------------------------------------------------ */
/* Periods                                                              */
/* ------------------------------------------------------------------ */

export type PeriodKind = 'year' | 'last12' | 'all' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** Calendar year for kind 'year'. */
  year: number | null;
  /** Inclusive start / exclusive end (naive ms); null means unbounded. */
  start: number | null;
  end: number | null;
}

export const yearOf = (ts: number) => new Date(ts).getUTCFullYear();

export function yearPeriod(y: number): Period {
  return { kind: 'year', year: y, start: Date.UTC(y, 0, 1), end: Date.UTC(y + 1, 0, 1) };
}

/** The twelve months up to and including the day of the last message. */
export function last12Period(lastTs: number): Period {
  const d = new Date(lastTs);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const start = Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate() + 1);
  return { kind: 'last12', year: null, start, end };
}

export const ALL_TIME: Period = { kind: 'all', year: null, start: null, end: null };

export function customPeriod(startDay: number, endDayInclusive: number): Period {
  const a = Math.min(startDay, endDayInclusive);
  const b = Math.max(startDay, endDayInclusive);
  return { kind: 'custom', year: null, start: a, end: b + 86_400_000 };
}

/** Calendar years that contain messages, most recent first. */
export function yearsBetween(firstTs: number, lastTs: number, monthly?: { starts: number[]; totals: number[] } | null): number[] {
  const out: number[] = [];
  for (let y = yearOf(lastTs); y >= yearOf(firstTs); y--) out.push(y);
  if (!monthly) return out;
  const withData = new Set<number>();
  monthly.starts.forEach((s, i) => {
    if ((monthly.totals[i] ?? 0) > 0) withData.add(yearOf(s));
  });
  return out.filter((y) => withData.has(y));
}

/**
 * The period a Wrapped opens with: the most recent calendar year, unless it
 * has barely started (less than a quarter of the previous year's messages,
 * or under 60 messages), in which case the previous year is the better story.
 */
export function defaultPeriod(firstTs: number, lastTs: number, monthly?: { starts: number[]; totals: number[] } | null): Period {
  const years = yearsBetween(firstTs, lastTs, monthly);
  if (years.length === 0) return ALL_TIME;
  if (monthly && years.length > 1) {
    const per = new Map<number, number>();
    monthly.starts.forEach((s, i) => per.set(yearOf(s), (per.get(yearOf(s)) ?? 0) + (monthly.totals[i] ?? 0)));
    const c0 = per.get(years[0]!) ?? 0;
    const c1 = per.get(years[1]!) ?? 0;
    if (c1 > 0 && (c0 < 0.25 * c1 || (c0 < 60 && c1 >= 60))) return yearPeriod(years[1]!);
  }
  return yearPeriod(years[0]!);
}

export function periodLabel(p: Period, firstTs: number, lastTs: number): string {
  switch (p.kind) {
    case 'year':
      return String(p.year);
    case 'last12':
      return fmtMonthRange(p.start!, p.end!);
    case 'all':
      return fmtMonthRange(firstTs, lastTs + 1);
    case 'custom':
      return fmtDateRange(p.start ?? firstTs, (p.end ?? lastTs + 1) - 1);
  }
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.kind === b.kind && a.year === b.year && a.start === b.start && a.end === b.end;
}

/* ------------------------------------------------------------------ */
/* Personality                                                          */
/* ------------------------------------------------------------------ */

export type PersonaId = 'night' | 'rapid' | 'story' | 'emoji' | 'comedy' | 'slow' | 'daily' | 'weekend' | 'morning' | 'voice';
export const PERSONA_IDS: PersonaId[] = ['night', 'rapid', 'story', 'emoji', 'comedy', 'slow', 'daily', 'weekend', 'morning', 'voice'];

export const PERSONA_STYLE: Record<PersonaId, { emoji: string; c1: string; c2: string }> = {
  night: { emoji: '🌙', c1: '#6a4bff', c2: '#ff4fd8' },
  rapid: { emoji: '⚡', c1: '#ffd23f', c2: '#ff5c39' },
  story: { emoji: '📜', c1: '#ff9f43', c2: '#c24bd8' },
  emoji: { emoji: '🤩', c1: '#ff8fd2', c2: '#ffd23f' },
  comedy: { emoji: '😂', c1: '#ffd23f', c2: '#ff4fd8' },
  slow: { emoji: '🕯️', c1: '#ff9f43', c2: '#6a4bff' },
  daily: { emoji: '☕', c1: '#5dffb2', c2: '#3dd6ff' },
  weekend: { emoji: '🎉', c1: '#ff5c39', c2: '#ffd23f' },
  morning: { emoji: '🌅', c1: '#ffb547', c2: '#ff6f91' },
  voice: { emoji: '🎙️', c1: '#3dd6ff', c2: '#6a4bff' },
};

/**
 * Each score is "how unusual is this chat on that axis": 1 means clearly
 * above what a typical chat shows. The highest score names the personality.
 */
export function personaScores(s: ChatStats): Record<PersonaId, number> {
  const n = Math.max(1, s.meta.totalMessages);
  const rt = s.dynamics.responseTime;
  const audio = s.media.byType.audio ?? 0;
  const active = s.time.activeDaysPct;
  return {
    night: s.time.nightOwlPct / 0.09,
    morning: s.time.earlyBirdPct / 0.12,
    rapid: rt && rt.count >= 20 ? Math.min(3, 150_000 / Math.max(rt.median, 20_000)) * (s.meta.messagesPerDay >= 5 ? 1 : 0.7) : 0,
    story: s.words.avgWordsPerMessage / 11,
    emoji: s.emojis.perMessage / 0.45,
    comedy: s.laughter.laughMessages / n / 0.07,
    daily: active / 0.75,
    slow: active < 0.3 ? 0.2 + ((0.3 - active) / 0.3) * 1.1 : 0,
    weekend: s.time.weekendPct / 0.4,
    voice: audio / n / 0.05,
  };
}

export function pickPersona(s: ChatStats): PersonaId {
  const scores = personaScores(s);
  let best: PersonaId = s.time.activeDaysPct >= 0.4 ? 'daily' : 'slow';
  let bestScore = 0.6;
  for (const id of PERSONA_IDS) {
    if (scores[id] > bestScore + 1e-9) {
      best = id;
      bestScore = scores[id];
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

export type SceneId = 'intro' | 'messages' | 'months' | 'hour' | 'talk' | 'speed' | 'emojis' | 'words' | 'streak' | 'awards' | 'persona' | 'summary';

export interface WPerson {
  /** Person index (also picks the avatar colour). */
  id: number;
  name: string;
  initials: string;
  messages: number;
  share: number;
  row: string;
}

export interface WBar {
  label: string;
  sub: string | null;
  value: number;
  top: boolean;
}

export interface WTile {
  label: string;
  value: string;
  sub: string;
  emoji?: boolean;
}

export interface WrappedData {
  lang: Lang;
  scenes: SceneId[];
  isGroup: boolean;
  title: string;
  /** "2025" for a calendar year, null for other periods. */
  year: string | null;
  periodLabel: string;
  people: WPerson[];
  messages: number;
  bars: WBar[];
  hourly: number[];
  peakHour: number;
  emojis: { emoji: string; count: number; label: string }[];
  words: { word: string; count: number; label: string }[];
  fastest: { person: number; name: string; ms: number; label: string }[];
  streakDays: number;
  awards: { emoji: string; title: string; winner: string; line: string; from: string; to: string }[];
  persona: { id: PersonaId; name: string; line: string; emoji: string; c1: string; c2: string };
  tiles: WTile[];
  copy: Record<string, string>;
  /** One line per scene, for screen readers and the text version. */
  transcript: { scene: SceneId; text: string }[];
}

export interface BuildInput {
  stats: ChatStats;
  lang: Lang;
  name: (i: number) => string;
  title: string;
  period: Period;
  /** Bounds of the whole chat (for "all time" labels). */
  firstTs: number;
  lastTs: number;
}

/** Fewer messages than this and there is no story to tell. */
export const MIN_MESSAGES = 20;

function buildBars(p: Period, starts: number[], totals: number[]): { bars: WBar[]; topIdx: number } {
  let topIdx = -1;
  for (let i = 0; i < totals.length; i++) if (topIdx < 0 || totals[i]! > totals[topIdx]!) topIdx = i;
  if (p.kind === 'year' && p.year !== null) {
    // Always Jan–Dec for a calendar year, so the shape reads like a year.
    const byMonth = new Map(starts.map((s, i) => [new Date(s).getUTCMonth(), totals[i]!]));
    const topMonth = topIdx >= 0 ? new Date(starts[topIdx]!).getUTCMonth() : -1;
    const bars = Array.from({ length: 12 }, (_, m) => ({
      label: fmtMonthNarrow(Date.UTC(p.year!, m, 1)),
      sub: null,
      value: byMonth.get(m) ?? 0,
      top: m === topMonth,
    }));
    return { bars, topIdx };
  }
  if (starts.length <= 14) {
    return { bars: starts.map((s, i) => ({ label: fmtMonthNarrow(s), sub: null, value: totals[i]!, top: i === topIdx })), topIdx };
  }
  const years = new Set(starts.map(yearOf));
  const groups = new Map<number, WBar>();
  starts.forEach((s, i) => {
    const d = new Date(s);
    const y = d.getUTCFullYear();
    const q = Math.floor(d.getUTCMonth() / 3);
    const key = years.size >= 3 ? y : y * 4 + q;
    const g = groups.get(key) ?? {
      label: years.size >= 3 ? String(y) : `Q${q + 1}`,
      sub: years.size >= 3 ? null : q === 0 || groups.size === 0 ? `’${String(y).slice(2)}` : null,
      value: 0,
      top: false,
    };
    g.value += totals[i]!;
    if (i === topIdx) g.top = true;
    groups.set(key, g);
  });
  return { bars: [...groups.values()], topIdx };
}

export function buildWrapped(inp: BuildInput): WrappedData | null {
  const { stats: s, lang, name, title, period } = inp;
  const total = s.meta.totalMessages;
  if (total < MIN_MESSAGES) return null;
  const tr = (key: string, params?: TParams) => translate(lang, `wrapped.${key}` as TKey, params);
  const t = (key: TKey, params?: TParams) => translate(lang, key, params);
  const copy: Record<string, string> = {};
  const isGroup = s.meta.isGroup;

  /* People */
  const people: WPerson[] = s.people
    .filter((p) => p.messages > 0)
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: name(p.id),
      initials: initials(name(p.id)),
      messages: p.messages,
      share: p.share,
      row: tr('talkRow', { n: fmtNum(p.messages), pct: fmtPct(p.share) }),
    }));
  const label = periodLabel(period, inp.firstTs, inp.lastTs);
  const year = period.kind === 'year' && period.year !== null ? String(period.year) : null;

  /* Intro */
  copy['your'] = tr('your');
  copy['word'] = tr('word');
  copy['heading'] = year ?? label;
  // Exports rarely say who "you" are; only then can we say "with Noor".
  const other = s.meta.selfIdx >= 0 ? people.find((p) => p.id !== s.meta.selfIdx) : undefined;
  copy['introLine'] = isGroup
    ? tr('introGroup', { title })
    : other
      ? tr('introDuo', { name: other.name })
      : people.map((p) => p.name).join(' & ');

  /* Messages */
  copy['msgKicker'] = isGroup ? tr('msgKickerGroup') : tr('msgKickerDuo');
  copy['msgNumber'] = fmtNum(total);
  copy['msgWord'] = tr('msgWord');
  copy['msgLine'] = tr('msgLine', { perDay: fmtNum(s.meta.messagesPerDay, s.meta.messagesPerDay < 10 ? 1 : 0), days: fmtNum(s.meta.activeDays) });

  /* Months */
  const monthly = s.time.monthly;
  const { bars, topIdx } = buildBars(period, monthly.starts, monthly.totals);
  const topCount = topIdx >= 0 ? monthly.totals[topIdx]! : 0;
  const avg = monthly.totals.reduce((a, b) => a + b, 0) / Math.max(1, monthly.totals.length);
  const topStart = topIdx >= 0 ? monthly.starts[topIdx]! : 0;
  copy['monthKicker'] = tr('monthKicker');
  copy['monthName'] = topIdx >= 0 ? cap(year ? fmtMonthName(topStart) : fmtMonth(topStart)) : '';
  copy['monthCount'] = fmtNum(topCount);
  copy['monthLine'] = tr('monthLine', { count: fmtNum(topCount), times: fmtTimes(avg > 0 ? topCount / avg : 1) });

  /* Hours */
  const peakHour = s.time.busiestHour;
  copy['hourKicker'] = tr('hourKicker');
  copy['hourLabel'] = fmtHour(peakHour);
  copy['hourLine'] = tr('hourLine', { hour: fmtHour(peakHour) });
  copy['weekdayLine'] = tr('weekdayLine', { weekday: weekdayName(s.time.busiestWeekday) });
  copy['hourTicks'] = [0, 6, 12, 18].map((h) => fmtHourShort(h)).join(';');

  /* Talk */
  copy['talkKicker'] = isGroup ? tr('talkKickerGroup') : tr('talkKickerDuo');
  copy['talkLine'] = people[0] ? tr('talkLine', { name: people[0].name, pct: fmtPct(people[0].share) }) : '';

  /* Speed + starts */
  const fastest = s.people
    .filter((p) => p.responseTime && p.responseTime.count >= 5)
    .sort((a, b) => a.responseTime!.median - b.responseTime!.median)
    .slice(0, 4)
    .map((p) => ({ person: p.id, name: name(p.id), ms: p.responseTime!.median, label: fmtDuration(p.responseTime!.median) }));
  copy['speedKicker'] = tr('speedKicker');
  copy['speedLabel'] = tr('speedLabel');
  const starter = s.dynamics.conversations >= 5 ? [...s.people].filter((p) => p.initiations > 0).sort((a, b) => b.initiationShare - a.initiationShare)[0] : undefined;
  copy['starterLine'] = starter ? tr('starterLine', { name: name(starter.id), pct: fmtPct(starter.initiationShare) }) : '';

  /* Emojis + words */
  const emojis = s.emojis.top.slice(0, 5).map((e) => ({ emoji: e.display || e.key, count: e.count, label: tr('emojiLine', { n: fmtNum(e.count) }) }));
  copy['emojiKicker'] = tr('emojiKicker');
  const words = s.words.topWords.slice(0, 5).map((w) => ({ word: w.key, count: w.count, label: fmtNum(w.count) }));
  copy['wordsKicker'] = tr('wordsKicker');
  copy['wordsNote'] = tr('wordsNote');

  /* Streak + busiest day */
  const st = s.time.longestStreak;
  copy['streakKicker'] = tr('streakKicker');
  copy['streakUnit'] = tr('streakUnit');
  copy['streakRange'] = st.days > 0 ? fmtDateRange(st.start, st.end) : '';
  const bd = s.time.busiestDay;
  copy['busiestLine'] = bd ? tr('busiestLine', { date: fmtDate(bd.day), n: fmtNum(bd.count) }) : '';

  /* Awards */
  const awards = rankedAwards(s.awards)
    .slice(0, 3)
    .map((a) => ({
      emoji: AWARD_META[a.id].emoji,
      title: t(`awards.${a.id}.title` as TKey),
      winner: name(a.winner),
      line: t(`awards.${a.id}.line` as TKey, { value: awardValue(a) }),
      from: AWARD_META[a.id].from,
      to: AWARD_META[a.id].to,
    }));
  copy['awardsKicker'] = tr('awardsKicker');

  /* Persona */
  const pid = pickPersona(s);
  const [pName, pLine] = translate(lang, `wrapped.personas.${pid}` as TKey).split(';');
  const persona = { id: pid, name: pName ?? pid, line: pLine ?? '', ...PERSONA_STYLE[pid] };
  copy['personaKicker'] = tr('personaKicker');

  /* Summary tiles: the six strongest facts we have. */
  copy['summaryKicker'] = tr('summaryKicker', { period: year ?? label });
  copy['madeOnDevice'] = tr('madeOnDevice');
  const tiles: WTile[] = [];
  tiles.push({ label: tr('sumMessages'), value: fmtCompact(total), sub: tr('perDayShort', { n: fmtNum(s.meta.messagesPerDay, s.meta.messagesPerDay < 10 ? 1 : 0) }) });
  if (topIdx >= 0 && bars.length >= 2) tiles.push({ label: tr('sumMonth'), value: copy['monthName'], sub: t('common.messages', { n: fmtNum(topCount) }) });
  tiles.push({ label: tr('sumHour'), value: fmtHour(peakHour), sub: cap(weekdayName(s.time.busiestWeekday)) });
  if (emojis[0]) tiles.push({ label: tr('sumEmoji'), value: emojis[0].emoji, sub: emojis[0].label, emoji: true });
  if (st.days >= 2) tiles.push({ label: tr('sumStreak'), value: tr('sumDays', { n: fmtNum(st.days) }), sub: copy['streakRange']! });
  if (fastest[0] && people.length >= 2) tiles.push({ label: tr('sumFastest'), value: fastest[0].name, sub: fastest[0].label });
  if (words[0]) tiles.push({ label: tr('sumWord'), value: words[0].word, sub: tr('timesShort', { n: fmtNum(words[0].count) }) });
  if (tiles.length < 6) tiles.push({ label: t('stats.activeDays'), value: fmtNum(s.meta.activeDays), sub: fmtPct(s.time.activeDaysPct) });
  if (tiles.length < 6) tiles.push({ label: t('stats.words'), value: fmtCompact(s.meta.totalWords), sub: '' });

  /* Which scenes have enough material */
  const scenes: SceneId[] = ['intro', 'messages'];
  if (bars.filter((b) => b.value > 0).length >= 3 && topCount >= 5) scenes.push('months');
  if (total >= 30) scenes.push('hour');
  if (people.length >= 2) scenes.push('talk');
  if (fastest.length >= 1 && people.length >= 2) scenes.push('speed');
  if (emojis.length >= 3) scenes.push('emojis');
  if (words.length >= 3) scenes.push('words');
  if (st.days >= 3) scenes.push('streak');
  if (awards.length >= 1) scenes.push('awards');
  scenes.push('persona', 'summary');

  /* Text version of every scene */
  const transcript: { scene: SceneId; text: string }[] = [];
  const say = (scene: SceneId, ...parts: (string | undefined)[]) => {
    if (scenes.includes(scene)) transcript.push({ scene, text: parts.filter(Boolean).join(' ') });
  };
  say('intro', `${copy['your']} ${copy['heading']} ${copy['word']},`, `${copy['introLine']}.`);
  say('messages', `${copy['msgKicker']} ${copy['msgNumber']} ${copy['msgWord']}.`, copy['msgLine']);
  say('months', `${copy['monthKicker']}: ${copy['monthName']}.`, copy['monthLine']);
  say('hour', `${copy['hourKicker']}: ${copy['hourLabel']}.`, copy['weekdayLine']);
  say('talk', `${copy['talkKicker']}:`, people.map((p) => `${p.name} (${p.row})`).join(', ') + '.');
  say('speed', `${copy['speedKicker']}:`, fastest.map((f) => `${f.name} ${f.label}`).join(', ') + '.', copy['starterLine']);
  say('emojis', `${copy['emojiKicker']}:`, emojis.map((e) => `${e.emoji} ${e.label.toLowerCase()}`).join(', ') + '.');
  say('words', `${copy['wordsKicker']}:`, words.map((w) => `“${w.word}” (${w.label})`).join(', ') + '.');
  say('streak', `${copy['streakKicker']}: ${fmtNum(st.days)} ${copy['streakUnit']}, ${copy['streakRange']}.`, copy['busiestLine']);
  say('awards', copy['awardsKicker'], awards.map((a) => `${a.title}: ${a.winner}. ${a.line}`).join(' '));
  say('persona', `${copy['personaKicker']}: ${persona.name}.`, persona.line);
  say('summary', tiles.map((x) => `${x.label}: ${x.value}${x.sub ? ` (${x.sub})` : ''}`).join('. ') + '.');

  return {
    lang,
    scenes,
    isGroup,
    // A duo is about the two of you; a group has its own name.
    title: isGroup || people.length < 2 ? title : people.slice(0, 2).map((p) => p.name).join(' & '),
    year,
    periodLabel: label,
    people,
    messages: total,
    bars,
    hourly: s.time.hourly,
    peakHour,
    emojis,
    words,
    fastest,
    streakDays: st.days,
    awards,
    persona,
    tiles: tiles.slice(0, 6),
    copy,
    transcript,
  };
}
