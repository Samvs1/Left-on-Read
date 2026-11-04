import type { ParseResult } from '../parser/types';
import { buildContext, type Ctx } from './context';
import { prepare, type Prepared, type PrepareOptions } from './prepare';
import { normalizeSettings } from './settings';
import { computeAwards } from './stats/awards';
import {
  collectContent,
  computeEmojis,
  computeLaughter,
  computeMedia,
  computeSentiment,
  computeWords,
  lexicalRichness,
  medianFromHist,
} from './stats/content';
import { computeDynamics } from './stats/dynamics';
import { computeEras } from './stats/eras';
import { computeDuo, computeGroup, morningAndNight } from './stats/social';
import { computeTime } from './stats/time';
import { searchWord } from './search';
import type { ChatStats, EffortBalance, MediaKind, PersonStats, Settings, WordSearchResult } from './types';
import { MEDIA_KINDS } from './types';
import { DAY, monthOf, percentiles, safeDiv, topK, weekOfDay } from './util';

export function computeStats(P: Prepared, settingsIn: Partial<Settings> = {}): ChatStats {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const s = normalizeSettings(settingsIn);
  const ctx = buildContext(P, s);
  const { m, np } = ctx;
  const isGroup = P.isGroup || np > 2;

  const timings: Record<string, number> = {};
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let tick = now();
  const lap = (label: string) => {
    const t = now();
    timings[label] = t - tick;
    tick = t;
  };
  lap('context');
  const { time, perPerson: tpp } = computeTime(ctx);
  lap('time');
  const { dynamics, perPerson: dpp } = computeDynamics(ctx);
  lap('dynamics');
  const content = collectContent(ctx);
  const cpp = content.pp;
  lap('content');
  const words = computeWords(ctx, content);
  lap('words');
  const emojis = computeEmojis(ctx, content);
  const laughter = computeLaughter(ctx, content);
  const media = computeMedia(ctx, content);
  lap('emoji/laugh/media');
  const sentiment = computeSentiment(ctx, content);
  lap('sentiment');
  const eras = computeEras(ctx, content);
  lap('eras');
  const richness = lexicalRichness(ctx);
  const mn = morningAndNight(ctx);
  lap('richness');

  const people: PersonStats[] = P.people.map((name, a) => {
    const msgs = cpp.messages[a]!;
    const tm = cpp.textMessages[a]!;
    const w = cpp.words[a]!;
    const mediaRec = Object.fromEntries(MEDIA_KINDS.map((k) => [k, cpp.media[k][a]!])) as Record<MediaKind, number>;
    const elongTop = topK(cpp.elongWords[a]!, 3).map((x) => P.vocab[x.key]!);
    return {
      id: a,
      name,
      messages: msgs,
      textMessages: tm,
      words: w,
      chars: cpp.chars[a]!,
      share: safeDiv(msgs, m),
      wordShare: safeDiv(w, content.totalWords),
      activeDays: tpp.activeDays[a]!,
      messagesPerActiveDay: safeDiv(msgs, tpp.activeDays[a]!),
      avgWords: safeDiv(cpp.textWords[a]!, tm),
      medianWords: medianFromHist(cpp.wordHist[a]!),
      longestMessage: cpp.longest[a] ?? null,
      turns: dpp.turns[a]!,
      messagesPerTurn: safeDiv(msgs, dpp.turns[a]!),
      vocabulary: words.vocabularyPP[a]!,
      uniqueWordRatio: safeDiv(words.vocabularyPP[a]!, w),
      lexicalRichness: richness[a] ?? null,
      avgWordLength: safeDiv(cpp.letters[a]!, w),
      capsRate: safeDiv(cpp.caps[a]!, tm),
      exclamationRate: safeDiv(cpp.exclaimMsgs[a]!, tm),
      exclamationsPerMessage: safeDiv(cpp.exclamTotal[a]!, tm),
      questionRate: safeDiv(cpp.questions[a]!, tm),
      ellipsisRate: safeDiv(cpp.ellipsis[a]!, tm),
      lowercaseRate: safeDiv(cpp.lower[a]!, tm),
      periodRate: safeDiv(cpp.period[a]!, tm),
      commaRate: safeDiv(cpp.comma[a]!, tm),
      emojiOnlyRate: safeDiv(cpp.emojiOnly[a]!, tm),
      elongations: cpp.elong[a]!,
      elongationExamples: elongTop,
      media: mediaRec,
      mediaTotal: MEDIA_KINDS.reduce((acc, k) => acc + mediaRec[k], 0),
      links: cpp.links[a]!,
      topDomains: topK(cpp.domains[a]!, 5).map(({ key, count }) => ({ key: P.domains[key]!, count })),
      deleted: cpp.deleted[a]!,
      edited: cpp.edited[a]!,
      calls: cpp.calls[a]!,
      missedCalls: cpp.missed[a]!,
      emojis: cpp.emojis[a]!,
      emojisPerMessage: safeDiv(cpp.emojis[a]!, msgs),
      topEmojis: emojis.topPP[a]!,
      signatureEmoji: emojis.signaturePP[a] ?? null,
      skinTones: cpp.skinTones[a]!,
      topWords: words.topWordsPP[a]!,
      signatureWords: words.signaturePP[a]!,
      catchphrases: words.catchphrasesPP[a]!,
      swears: cpp.swears[a]!,
      swearsPer100: safeDiv(cpp.swears[a]! * 100, tm),
      apologies: cpp.apologies[a]!,
      loveYous: cpp.loves[a]!,
      hearts: cpp.hearts[a]!,
      greetings: cpp.greetings[a]!,
      goodbyes: cpp.goodbyes[a]! + cpp.goodnights[a]!,
      laughs: cpp.laughMsgs[a]!,
      laughRate: safeDiv(cpp.laughMsgs[a]! * 100, msgs),
      laughsTriggered: laughter.triggeredByPerson[a]!,
      initiations: dpp.initiations[a]!,
      initiationShare: safeDiv(dpp.initiations[a]!, dynamics.conversations),
      endings: dpp.endings[a]!,
      endingShare: safeDiv(dpp.endings[a]!, dynamics.conversations),
      ghostedOthers: dpp.ghostedOthers[a]!,
      gotGhosted: dpp.gotGhosted[a]!,
      ghostRate: safeDiv(dpp.ghostedOthers[a]!, dpp.ghostChances[a]!),
      responseTime: percentiles(dpp.responseTimes[a]!),
      responseHistogram: dpp.responseHist[a]!,
      responseByHour: dpp.responseByHour[a]!,
      doubleTexts: dpp.doubleTexts[a]!,
      longestMonologue: dpp.longestMonologue[a] ?? null,
      questionsAsked: dpp.questionsAsked[a]!,
      questionsAnsweredByOthers: dpp.questionsAnsweredByOthers[a]!,
      questionsAnswered: dpp.questionsAnswered[a]!,
      revives: dpp.revives[a]!,
      hourly: tpp.hourly[a]!,
      weekday: tpp.weekday[a]!,
      weekdayHour: tpp.weekdayHour[a]!,
      nightOwlPct: safeDiv(tpp.night[a]!, msgs),
      earlyBirdPct: safeDiv(tpp.early[a]!, msgs),
      weekendPct: safeDiv(tpp.weekend[a]!, msgs),
      firstMessage: tpp.firstMessage[a] ?? null,
      sentiment: sentiment.byPerson[a]!,
      positiveShare: safeDiv(cpp.positive[a]!, tm),
      negativeShare: safeDiv(cpp.negative[a]!, tm),
      morningFirsts: mn.morningFirsts[a]!,
      goodnightLasts: mn.goodnightLasts[a]!,
    };
  });

  lap('people');
  const effort = !isGroup && np === 2 ? effortBalance(people) : null;
  const group = isGroup ? computeGroup(ctx, dpp, cpp) : null;
  const duo = !isGroup && np === 2 ? computeDuo(ctx, cpp, mn) : null;
  const awards = computeAwards(people, isGroup);
  lap('group/duo/awards');

  // Optional: count system messages in totals
  let totalMessages = m;
  if (s.includeSystem && ctx.systemIdx.length > 0 && m > 0) {
    const firstWeek = weekOfDay(ctx.firstDay);
    const firstMonth = monthOf(ctx.firstDay * DAY);
    for (const i of ctx.systemIdx) {
      const t = P.ts[i]! + ctx.shift;
      const d = Math.floor(t / DAY) - ctx.firstDay;
      if (d < 0 || d >= time.daily.totals.length) continue;
      time.daily.totals[d]!++;
      const wk = weekOfDay(d + ctx.firstDay) - firstWeek;
      if (time.weekly.totals[wk] !== undefined) time.weekly.totals[wk]!++;
      const mo = monthOf(t) - firstMonth;
      if (time.monthly.totals[mo] !== undefined) time.monthly.totals[mo]!++;
      totalMessages++;
    }
  }

  let fullFirst = Infinity;
  let fullLast = -Infinity;
  for (let i = 0; i < P.n; i++) {
    if (P.author[i]! < 0) continue;
    const t = P.ts[i]! + ctx.shift;
    if (t < fullFirst) fullFirst = t;
    if (t > fullLast) fullLast = t;
  }
  const activeDays = time.daily.totals.reduce((acc, c) => acc + (c > 0 ? 1 : 0), 0);
  const spanDays = Math.max(1, time.chatAgeDays);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    meta: {
      title: P.title,
      isGroup,
      platform: P.platform,
      people: P.people,
      selfIdx: P.selfIdx,
      mainPeople: ctx.mainPeople,
      otherPeople: ctx.otherPeople,
      firstTs: m > 0 ? ctx.tl[0]! : 0,
      lastTs: m > 0 ? ctx.tl[m - 1]! : 0,
      fullFirstTs: Number.isFinite(fullFirst) ? fullFirst : 0,
      fullLastTs: Number.isFinite(fullLast) ? fullLast : 0,
      spanDays,
      totalMessages,
      totalWords: content.totalWords,
      totalChars: content.totalChars,
      totalMedia: media.total,
      activeDays,
      messagesPerDay: m / spanDays,
      messagesPerActiveDay: safeDiv(m, activeDays),
      excludedMessages: ctx.excluded,
      unknownMediaShare: safeDiv(media.byType.media, media.total),
      systemMessages: ctx.systemIdx.length,
    },
    people,
    time,
    dynamics: { ...dynamics, effort },
    words: {
      ...words.words,
      avgWordsPerMessage: safeDiv(content.totalWords, m),
      longestMessage: people.reduce<PersonStats['longestMessage']>((best, p) => (p.longestMessage && (!best || p.longestMessage.words > best.words) ? p.longestMessage : best), null),
    },
    emojis: emojis.emojis,
    laughter,
    media,
    sentiment,
    eras,
    group,
    duo,
    awards,
    computeMs: t1 - t0,
    timings,
  };
}

/**
 * Effort balance for duos: weighted share of effort by person 0, combining
 * message share (30%), conversation initiations (30%), reply speed (20%) and
 * message length (20%). 50 means perfectly balanced.
 */
export function effortBalance(people: PersonStats[]): EffortBalance {
  const [a, b] = people as [PersonStats, PersonStats];
  const comps: EffortBalance['components'] = [];
  const share = (x: number, y: number) => (x + y > 0 ? x / (x + y) : 0.5);
  if (a.messages + b.messages > 0) comps.push({ key: 'messages', weight: 0.3, share: share(a.messages, b.messages) });
  if (a.initiations + b.initiations > 0) comps.push({ key: 'initiations', weight: 0.3, share: share(a.initiations, b.initiations) });
  if (a.responseTime && b.responseTime && a.responseTime.median + b.responseTime.median > 0) {
    comps.push({ key: 'speed', weight: 0.2, share: share(b.responseTime.median, a.responseTime.median) });
  }
  if (a.avgWords + b.avgWords > 0) comps.push({ key: 'length', weight: 0.2, share: share(a.avgWords, b.avgWords) });
  const wsum = comps.reduce((acc, c) => acc + c.weight, 0);
  const score = wsum > 0 ? (comps.reduce((acc, c) => acc + c.weight * c.share, 0) / wsum) * 100 : 50;
  return { score, components: comps };
}

export interface Analysis {
  prepared: Prepared;
  stats: ChatStats;
}

/** Convenience: prepare + compute in one go. */
export function analyze(parsed: ParseResult, settings: Partial<Settings> = {}, opts: PrepareOptions = {}): Analysis {
  const prepared = prepare(parsed, opts);
  return { prepared, stats: computeStats(prepared, settings) };
}

export function search(P: Prepared, settings: Partial<Settings>, query: string): WordSearchResult {
  const ctx: Ctx = buildContext(P, normalizeSettings(settings));
  return searchWord(ctx, query);
}
