/**
 * One pass over all messages collecting volume, style, media, emoji, word,
 * laughter and sentiment counters per person. Post-processing (top lists,
 * signature words, n-grams …) happens in the functions below.
 */
import type { Ctx } from '../context';
import { F, T, TYPES, isMediaCode } from '../prepare';
import { HEARTS, LAUGH_EMOJIS } from '../lexicon/phrases';
import type {
  Counted,
  CountedByPerson,
  EmojiStats,
  Excerpt,
  HeartColor,
  LaughStats,
  MediaKind,
  MediaStats,
  SentimentStats,
  WordStats,
} from '../types';
import { MEDIA_KINDS } from '../types';
import { DAY, inc, logOddsZ, monthOf, monthStart, topK, zeros } from '../util';
import { excerptAt } from './common';

export interface ContentPerPerson {
  messages: number[];
  textMessages: number[];
  textWords: number[];
  hearts: number[];
  words: number[];
  chars: number[];
  letters: number[];
  wordHist: Uint32Array[];
  longest: ((Excerpt & { words: number }) | null)[];
  caps: number[];
  exclaimMsgs: number[];
  exclamTotal: number[];
  questions: number[];
  ellipsis: number[];
  lower: number[];
  period: number[];
  comma: number[];
  emojiOnly: number[];
  elong: number[];
  elongWords: Map<number, number>[];
  apologies: number[];
  loves: number[];
  greetings: number[];
  goodbyes: number[];
  goodnights: number[];
  laughMsgs: number[];
  media: Record<MediaKind, number[]>;
  links: number[];
  domains: Map<number, number>[];
  deleted: number[];
  edited: number[];
  calls: number[];
  missed: number[];
  swears: number[];
  emojis: number[];
  emojiCounts: Map<number, number>[];
  skinTones: number[][];
  tokenCounts: Map<number, number>[];
  sentimentSum: number[];
  positive: number[];
  negative: number[];
}

export interface ContentResult {
  pp: ContentPerPerson;
  tokenTotals: Uint32Array;
  emojiTotals: Uint32Array;
  laughKindCounts: Map<string, number>;
  swearTokens: Map<number, number>;
  greetingWords: Map<string, number>;
  goodbyeWords: Map<string, number>;
  callsVideo: number;
  callSec: number;
  viewOnce: number;
  totalWords: number;
  totalChars: number;
  messagesWithEmoji: number;
}

export function collectContent(ctx: Ctx): ContentResult {
  const { m, np, idx, au, P } = ctx;
  const z = () => zeros(np);
  const pp: ContentPerPerson = {
    messages: z(), textMessages: z(), textWords: z(), hearts: z(), words: z(), chars: z(), letters: z(),
    wordHist: Array.from({ length: np }, () => new Uint32Array(202)),
    longest: new Array(np).fill(null),
    caps: z(), exclaimMsgs: z(), exclamTotal: z(), questions: z(), ellipsis: z(), lower: z(), period: z(), comma: z(),
    emojiOnly: z(), elong: z(), elongWords: Array.from({ length: np }, () => new Map()),
    apologies: z(), loves: z(), greetings: z(), goodbyes: z(), goodnights: z(), laughMsgs: z(),
    media: Object.fromEntries(MEDIA_KINDS.map((k) => [k, z()])) as Record<MediaKind, number[]>,
    links: z(), domains: Array.from({ length: np }, () => new Map()),
    deleted: z(), edited: z(), calls: z(), missed: z(), swears: z(),
    emojis: z(), emojiCounts: Array.from({ length: np }, () => new Map()), skinTones: Array.from({ length: np }, () => zeros(6)),
    tokenCounts: Array.from({ length: np }, () => new Map()),
    sentimentSum: z(), positive: z(), negative: z(),
  };
  const V = P.vocab.length;
  const tokenTotals = new Uint32Array(V);
  const emojiTotals = new Uint32Array(P.emojiKeys.length);
  const laughKindCounts = new Map<string, number>();
  const swearTokens = new Map<number, number>();
  const greetingWords = new Map<string, number>();
  const goodbyeWords = new Map<string, number>();
  let callsVideo = 0;
  let callSec = 0;
  let viewOnce = 0;
  let totalWords = 0;
  let totalChars = 0;
  let messagesWithEmoji = 0;

  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    const a = au[k]!;
    const code = P.type[i]!;
    const f = P.flags[i]!;
    const w = P.words[i]!;
    pp.messages[a]!++;
    pp.words[a]! += w;
    pp.chars[a]! += P.chars[i]!;
    pp.letters[a]! += P.letters[i]!;
    totalWords += w;
    totalChars += P.chars[i]!;
    if (f & F.EDITED) pp.edited[a]!++;
    if (code === T.text) {
      pp.textMessages[a]!++;
      pp.textWords[a]! += w;
      pp.wordHist[a]![Math.min(w, 201)]!++;
      const cur = pp.longest[a];
      if (!cur || w > cur.words) pp.longest[a] = { ...excerptAt(ctx, k, 600), words: w };
      if (f & F.CAPS) pp.caps[a]!++;
      if (f & F.EXCLAIM) pp.exclaimMsgs[a]!++;
      pp.exclamTotal[a]! += P.exclam[i]!;
      if (f & F.QUESTION) pp.questions[a]!++;
      if (f & F.ELLIPSIS) pp.ellipsis[a]!++;
      if (f & F.LOWER) pp.lower[a]!++;
      if (f & F.PERIOD) pp.period[a]!++;
      if (f & F.COMMA) pp.comma[a]!++;
      if (f & F.EMOJI_ONLY) pp.emojiOnly[a]!++;
      if (f & F.ELONG) pp.elong[a]!++;
      const s = P.sentiment[i]!;
      pp.sentimentSum[a]! += s;
      if (s > 0.05) pp.positive[a]!++;
      else if (s < -0.05) pp.negative[a]!++;
    } else if (isMediaCode(code)) {
      pp.media[TYPES[code] as MediaKind][a]!++;
      if (f & F.VIEW_ONCE) viewOnce++;
    } else if (code === T.deleted) {
      pp.deleted[a]!++;
    } else if (code === T.call) {
      pp.calls[a]!++;
      if (f & F.MISSED) pp.missed[a]!++;
      if (f & F.VIDEO) callsVideo++;
      callSec += P.callSec[i]!;
    }
    if (f & F.APOLOGY) pp.apologies[a]!++;
    if (f & F.LOVE) pp.loves[a]!++;
    if (f & F.LAUGH) pp.laughMsgs[a]!++;

    // Tokens
    const t0 = P.tokStart[i]!;
    const t1 = P.tokStart[i + 1]!;
    if (t1 > t0) {
      const tc = pp.tokenCounts[a]!;
      for (let t = t0; t < t1; t++) {
        const id = P.tokens[t]!;
        tokenTotals[id]!++;
        tc.set(id, (tc.get(id) ?? 0) + 1);
        const lk = P.vocabLaugh[id]!;
        if (lk >= 0) inc(laughKindCounts, P.laughKinds[lk]!);
        if (P.vocabSwear[id]) inc(swearTokens, id);
        if (P.vocabElong[id]) inc(pp.elongWords[a]!, id);
      }
      pp.swears[a]! += P.swears[i]!;
      if (f & F.GREETING) {
        pp.greetings[a]!++;
        inc(greetingWords, P.vocab[P.tokens[t0]!]!);
      }
      if (f & (F.GOODBYE | F.GOODNIGHT)) {
        if (f & F.GOODBYE) pp.goodbyes[a]!++;
        if (f & F.GOODNIGHT) pp.goodnights[a]!++;
        inc(goodbyeWords, P.vocab[P.tokens[t1 - 1]!]!);
      }
    }

    // Emojis
    const e0 = P.emoStart[i]!;
    const e1 = P.emoStart[i + 1]!;
    if (e1 > e0) {
      messagesWithEmoji++;
      const ec = pp.emojiCounts[a]!;
      for (let e = e0; e < e1; e++) {
        const id = P.emoIds[e]!;
        emojiTotals[id]!++;
        ec.set(id, (ec.get(id) ?? 0) + 1);
        pp.skinTones[a]![P.emoTone[e]!]!++;
        const key = P.emojiKeys[id]!;
        if (LAUGH_EMOJIS.has(key)) inc(laughKindCounts, key);
        else if (HEARTS.has(key) && key !== '💔') pp.hearts[a]!++;
      }
      pp.emojis[a]! += e1 - e0;
    }

    // Links
    const l0 = P.linkStart[i]!;
    const l1 = P.linkStart[i + 1]!;
    if (l1 > l0) {
      pp.links[a]! += l1 - l0;
      for (let l = l0; l < l1; l++) inc(pp.domains[a]!, P.linkDomains[l]!);
    }
  }
  return {
    pp, tokenTotals, emojiTotals, laughKindCounts, swearTokens, greetingWords, goodbyeWords,
    callsVideo, callSec, viewOnce, totalWords, totalChars, messagesWithEmoji,
  };
}

export function medianFromHist(h: Uint32Array): number {
  let total = 0;
  for (let i = 0; i < h.length; i++) total += h[i]!;
  if (total === 0) return 0;
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < h.length; i++) {
    acc += h[i]!;
    if (acc >= half) return i;
  }
  return h.length - 1;
}

/** Mean unique words per 1,000-word segment of a person's token stream. */
export function lexicalRichness(ctx: Ctx): (number | null)[] {
  const { P, m, idx, au, np } = ctx;
  const SEG = 1000;
  const seen = new Int32Array(P.vocab.length).fill(-1);
  // Every (person, segment) pair gets a unique stamp so `seen` can be shared.
  let nextStamp = 0;
  const stamp = Array.from({ length: np }, () => nextStamp++);
  const inSeg = zeros(np);
  const uniq = zeros(np);
  const sumUnique = zeros(np);
  const segments = zeros(np);
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    const a = au[k]!;
    for (let t = P.tokStart[i]!; t < P.tokStart[i + 1]!; t++) {
      const id = P.tokens[t]!;
      const st = stamp[a]!;
      if (seen[id] !== st) {
        seen[id] = st;
        uniq[a]!++;
      }
      inSeg[a]!++;
      if (inSeg[a] === SEG) {
        sumUnique[a]! += uniq[a]!;
        segments[a]!++;
        stamp[a] = nextStamp++;
        inSeg[a] = 0;
        uniq[a] = 0;
      }
    }
  }
  return sumUnique.map((s, a) => (segments[a]! > 0 ? s / segments[a]! : null));
}

/* ------------------------------------------------------------------ */
/* Words                                                                */
/* ------------------------------------------------------------------ */

export function computeWords(ctx: Ctx, c: ContentResult): {
  words: Omit<WordStats, 'longestMessage' | 'avgWordsPerMessage'>;
  topWordsPP: Counted[][];
  signaturePP: { key: string; score: number; count: number }[][];
  catchphrasesPP: { key: string; count: number; share: number }[][];
  vocabularyPP: number[];
} {
  const { P, np, m, idx, au } = ctx;
  const V = P.vocab.length;
  const totals = c.tokenTotals;
  let N = 0;
  for (let v = 0; v < V; v++) N += totals[v]!;

  // Top words overall
  const overall = new Map<number, number>();
  for (let v = 0; v < V; v++) if (totals[v]! > 0 && !ctx.isStop(v)) overall.set(v, totals[v]!);
  const top = topK(overall, 50);
  const topWords: CountedByPerson[] = top.map(({ key, count }) => ({
    key: P.vocab[key]!,
    count,
    byPerson: c.pp.tokenCounts.map((tc) => tc.get(key) ?? 0),
  }));

  const topWordsPP: Counted[][] = c.pp.tokenCounts.map((tc) =>
    topK(tc, 15, (id) => !ctx.isStop(id)).map(({ key, count }) => ({ key: P.vocab[key]!, count })),
  );
  const vocabularyPP = c.pp.tokenCounts.map((tc) => tc.size);

  // Signature words (log-odds, informative Dirichlet prior)
  const PRIOR = 500;
  const signaturePP = c.pp.tokenCounts.map((tc, a) => {
    const ni = c.pp.words[a]!;
    if (ni < 200 || np < 2) return [];
    const nj = N - ni;
    const out: { key: string; score: number; count: number }[] = [];
    for (const [id, yi] of tc) {
      if (yi < 3 || ctx.isStop(id)) continue;
      const total = totals[id]!;
      if (total < 5) continue;
      const aw = (PRIOR * total) / N;
      const z = logOddsZ(yi, ni, total - yi, nj, aw, PRIOR);
      if (z > 1.96) out.push({ key: P.vocab[id]!, score: z, count: yi });
    }
    out.sort((x, y) => y.score - x.score);
    return out.slice(0, 10);
  });

  // N-grams
  const canUseTrigram = V < 200_000;
  const bigrams = new Map<number, number>();
  const trigrams = new Map<number, number>();
  const okTok = (id: number) => P.vocabLaugh[id]! < 0 && !/^\d+$/.test(P.vocab[id]!);
  const okTokCache = new Uint8Array(V);
  for (let v = 0; v < V; v++) okTokCache[v] = okTok(v) ? 1 : 0;
  const stopCache = new Uint8Array(V);
  for (let v = 0; v < V; v++) stopCache[v] = ctx.isStop(v) && P.vocabLaugh[v]! < 0 && !/^\d+$/.test(P.vocab[v]!) ? 1 : 0;
  const content = (id: number) => okTokCache[id] === 1 && stopCache[id] === 0;
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    const t0 = P.tokStart[i]!;
    const t1 = P.tokStart[i + 1]!;
    for (let t = t0; t + 1 < t1; t++) {
      const x = P.tokens[t]!;
      const y = P.tokens[t + 1]!;
      if (!okTokCache[x] || !okTokCache[y] || x === y) continue;
      const key = x * V + y;
      bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
      if (canUseTrigram && t + 2 < t1) {
        const zt = P.tokens[t + 2]!;
        if (okTokCache[zt]) {
          const key3 = key * V + zt;
          trigrams.set(key3, (trigrams.get(key3) ?? 0) + 1);
        }
      }
    }
  }
  const bigramLabel = (key: number) => `${P.vocab[Math.floor(key / V)]!} ${P.vocab[key % V]!}`;
  const trigramLabel = (key: number) => {
    const zt = key % V;
    const xy = Math.floor(key / V);
    return `${P.vocab[Math.floor(xy / V)]!} ${P.vocab[xy % V]!} ${P.vocab[zt]!}`;
  };
  // A bigram must contain at least one non-stopword; prefer those with both
  const bigramFilter = (key: number, count: number) => count >= 2 && content(Math.floor(key / V)) && content(key % V);
  const topBigramsK = topK(bigrams, 25, (key, cnt) => bigramFilter(key, cnt));
  if (topBigramsK.length < 10) {
    topBigramsK.push(
      ...topK(bigrams, 25 - topBigramsK.length, (key, cnt) => cnt >= 2 && !bigramFilter(key, cnt) && (content(Math.floor(key / V)) || content(key % V))),
    );
  }
  const trigramHasContent = (key: number) => {
    const zt = key % V;
    const xy = Math.floor(key / V);
    return content(Math.floor(xy / V)) || content(xy % V) || content(zt);
  };
  const topTrigramsK = topK(trigrams, 25, (key, cnt) => cnt >= 2 && trigramHasContent(key));

  // Candidate n-grams for catchphrases + per-person counts for top lists
  const candidates = new Map<number, { label: string; n: number; byPerson: number[] }>();
  const addCand = (key: number, n: number, label: string) => {
    const tag = n === 2 ? key * 2 : key * 2 + 1; // keep bigram/trigram keys apart
    if (!candidates.has(tag)) candidates.set(tag, { label, n, byPerson: zeros(np) });
  };
  for (const { key } of topK(bigrams, 1500, (_k, cnt) => cnt >= 3)) addCand(key, 2, bigramLabel(key));
  if (canUseTrigram) for (const { key } of topK(trigrams, 1500, (_k, cnt) => cnt >= 3)) addCand(key, 3, trigramLabel(key));
  for (const { key } of topBigramsK) addCand(key, 2, bigramLabel(key));
  for (const { key } of topTrigramsK) addCand(key, 3, trigramLabel(key));
  if (candidates.size > 0) {
    for (let k = 0; k < m; k++) {
      const i = idx[k]!;
      const a = au[k]!;
      const t0 = P.tokStart[i]!;
      const t1 = P.tokStart[i + 1]!;
      for (let t = t0; t + 1 < t1; t++) {
        const x = P.tokens[t]!;
        const y = P.tokens[t + 1]!;
        const c2 = candidates.get((x * V + y) * 2);
        if (c2) c2.byPerson[a]!++;
        if (canUseTrigram && t + 2 < t1) {
          const c3 = candidates.get(((x * V + y) * V + P.tokens[t + 2]!) * 2 + 1);
          if (c3) c3.byPerson[a]!++;
        }
      }
    }
  }
  const toCounted = (key: number, n: number): CountedByPerson => {
    const cand = candidates.get(n === 2 ? key * 2 : key * 2 + 1)!;
    return { key: cand.label, count: cand.byPerson.reduce((x, y) => x + y, 0), byPerson: cand.byPerson };
  };

  const shares = c.pp.messages.map((x) => x / Math.max(1, m));
  const catchphrasesPP = Array.from({ length: np }, (_, a) => {
    if (np < 2) return [];
    const list: { key: string; count: number; share: number; score: number }[] = [];
    for (const cand of candidates.values()) {
      const total = cand.byPerson.reduce((x, y) => x + y, 0);
      const mine = cand.byPerson[a]!;
      if (mine < 3 || total === 0) continue;
      const share = mine / total;
      if (share < Math.max(0.7, Math.min(0.95, shares[a]! * 1.6))) continue;
      list.push({ key: cand.label, count: mine, share, score: mine * share * share * (cand.n === 3 ? 1.5 : 1) });
    }
    list.sort((x, y) => y.score - x.score);
    // Drop bigrams contained in a chosen trigram
    const out: { key: string; count: number; share: number }[] = [];
    for (const it of list) {
      if (out.some((o) => o.key.includes(it.key) || it.key.includes(o.key))) continue;
      out.push({ key: it.key, count: it.count, share: it.share });
      if (out.length === 5) break;
    }
    return out;
  });

  // Swears
  const swearTop = topK(c.swearTokens, 10).map(({ key, count }) => ({ key: P.vocab[key]!, count }));
  let vocabulary = 0;
  for (let v = 0; v < V; v++) if (totals[v]! > 0) vocabulary++;

  return {
    words: {
      totalWords: c.totalWords,
      vocabulary,
      topWords,
      topBigrams: topBigramsK.map(({ key }) => toCounted(key, 2)),
      topTrigrams: topTrigramsK.map(({ key }) => toCounted(key, 3)),
      greetings: topK(c.greetingWords, 8),
      goodbyes: topK(c.goodbyeWords, 8),
      swears: { total: c.pp.swears.reduce((x, y) => x + y, 0), byPerson: c.pp.swears, top: swearTop },
    },
    topWordsPP,
    signaturePP,
    catchphrasesPP,
    vocabularyPP,
  };
}

/* ------------------------------------------------------------------ */
/* Emojis                                                               */
/* ------------------------------------------------------------------ */

export function computeEmojis(ctx: Ctx, c: ContentResult): {
  emojis: EmojiStats;
  topPP: Counted[][];
  signaturePP: ({ key: string; score: number; count: number } | null)[];
} {
  const { P, np, m, idx } = ctx;
  const E = P.emojiKeys.length;
  const totals = c.emojiTotals;
  let total = 0;
  let distinct = 0;
  const overall = new Map<number, number>();
  for (let e = 0; e < E; e++) {
    if (totals[e]! > 0) {
      total += totals[e]!;
      distinct++;
      overall.set(e, totals[e]!);
    }
  }
  const top = topK(overall, 30).map(({ key, count }) => ({
    key: P.emojiKeys[key]!,
    display: P.emojiDisplay[key]!,
    count,
    byPerson: c.pp.emojiCounts.map((ec) => ec.get(key) ?? 0),
  }));
  const topPP = c.pp.emojiCounts.map((ec) => topK(ec, 15).map(({ key, count }) => ({ key: P.emojiDisplay[key]!, count })));
  const PRIOR = 50;
  const signaturePP = c.pp.emojiCounts.map((ec, a) => {
    const ni = c.pp.emojis[a]!;
    if (ni < 20 || np < 2) return null;
    const nj = total - ni;
    let best: { key: string; score: number; count: number } | null = null;
    for (const [id, yi] of ec) {
      if (yi < 3) continue;
      const tot = totals[id]!;
      const aw = (PRIOR * tot) / total;
      const z = logOddsZ(yi, ni, tot - yi, nj, aw, PRIOR);
      if (z > 1.5 && (!best || z > best.score)) best = { key: P.emojiDisplay[id]!, score: z, count: yi };
    }
    return best;
  });

  // Monthly series for the top 5 emojis
  const top5 = topK(overall, 5).map((x) => x.key);
  const pos = new Map(top5.map((id, i) => [id, i]));
  const firstMonth = m > 0 ? monthOf(ctx.firstDay * DAY) : 0;
  const nMonths = m > 0 ? monthOf(ctx.lastDay * DAY) - firstMonth + 1 : 0;
  const series = top5.map((id) => ({ key: P.emojiKeys[id]!, display: P.emojiDisplay[id]!, counts: zeros(nMonths) }));
  if (top5.length > 0) {
    let curDay = -1;
    let curMonth = 0;
    for (let k = 0; k < m; k++) {
      const i = idx[k]!;
      const e0 = P.emoStart[i]!;
      const e1 = P.emoStart[i + 1]!;
      if (e1 === e0) continue;
      if (ctx.day[k] !== curDay) {
        curDay = ctx.day[k]!;
        curMonth = monthOf(curDay * DAY) - firstMonth;
      }
      for (let e = e0; e < e1; e++) {
        const p = pos.get(P.emoIds[e]!);
        if (p !== undefined) series[p]!.counts[curMonth]!++;
      }
    }
  }

  const skinTones = zeros(6);
  for (const st of c.pp.skinTones) for (let t = 0; t < 6; t++) skinTones[t]! += st[t]!;
  const heartMap = new Map<string, { color: HeartColor; display: string; count: number }>();
  for (let e = 0; e < E; e++) {
    const color = HEARTS.get(P.emojiKeys[e]!);
    if (!color || totals[e] === 0) continue;
    const cur = heartMap.get(color);
    if (cur) cur.count += totals[e]!;
    else heartMap.set(color, { color: color as HeartColor, display: P.emojiDisplay[e]!, count: totals[e]! });
  }
  return {
    emojis: {
      total,
      distinct,
      perMessage: m > 0 ? total / m : 0,
      messagesWithEmoji: c.messagesWithEmoji,
      top,
      monthly: { starts: Array.from({ length: nMonths }, (_, i) => monthStart(firstMonth + i)), series },
      skinTones,
      hearts: [...heartMap.values()].sort((a, b) => b.count - a.count),
    },
    topPP,
    signaturePP,
  };
}

/* ------------------------------------------------------------------ */
/* Laughter (incl. The Comedian)                                        */
/* ------------------------------------------------------------------ */

export function computeLaughter(ctx: Ctx, c: ContentResult): LaughStats {
  const { P, np, m, idx, au, conv, tl } = ctx;
  const triggered = zeros(np);
  const jokeLaughs = new Map<number, number>();
  const lastCredit = new Int32Array(np).fill(-1);
  let total = 0;
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    const f = P.flags[i]!;
    if (!(f & F.LAUGH)) continue;
    total += P.laughs[i]!;
    const laugher = au[k]!;
    // Find the closest preceding non-laugh message by someone else in the same conversation.
    for (let b = k - 1, steps = 0; b >= 0 && steps < 6; b--, steps++) {
      if (conv[b] !== conv[k] || tl[k]! - tl[b]! > 30 * 60_000) break;
      if (au[b] === laugher) continue;
      if (P.flags[idx[b]!]! & F.LAUGH_ONLY) continue;
      if (lastCredit[laugher] !== b) {
        lastCredit[laugher] = b;
        triggered[au[b]!]!++;
        jokeLaughs.set(b, (jokeLaughs.get(b) ?? 0) + 1);
      }
      break;
    }
  }
  const byPerson = c.pp.laughMsgs;
  const best = topK(jokeLaughs, 40)
    .filter(({ key }) => P.type[idx[key]!] === T.text && (P.texts[idx[key]!] ?? '').length > 3)
    .slice(0, 5)
    .map(({ key, count }) => ({ ...excerptAt(ctx, key, 160), laughs: count }));
  let comedian = -1;
  for (let a = 0; a < np; a++) if (triggered[a]! > 0 && (comedian < 0 || triggered[a]! > triggered[comedian]!)) comedian = a;
  return {
    total,
    laughMessages: byPerson.reduce((x, y) => x + y, 0),
    byPerson,
    ratePer100: byPerson.map((l, a) => (c.pp.messages[a]! > 0 ? (l / c.pp.messages[a]!) * 100 : 0)),
    kinds: topK(c.laughKindCounts, 12),
    comedian,
    triggeredByPerson: triggered,
    bestJokes: best,
  };
}

/* ------------------------------------------------------------------ */
/* Media                                                                */
/* ------------------------------------------------------------------ */

export function computeMedia(ctx: Ctx, c: ContentResult): MediaStats {
  const { P, m, idx } = ctx;
  const byType = Object.fromEntries(MEDIA_KINDS.map((k) => [k, c.pp.media[k].reduce((x, y) => x + y, 0)])) as Record<MediaKind, number>;
  const total = MEDIA_KINDS.reduce((acc, k) => acc + byType[k], 0);
  const domainTotals = new Map<number, number>();
  for (const dm of c.pp.domains) for (const [d, n] of dm) inc(domainTotals, d, n);
  const firstMonth = m > 0 ? monthOf(ctx.firstDay * DAY) : 0;
  const nMonths = m > 0 ? monthOf(ctx.lastDay * DAY) - firstMonth + 1 : 0;
  const monthlyByType = Object.fromEntries(MEDIA_KINDS.map((k) => [k, zeros(nMonths)])) as Record<MediaKind, number[]>;
  let curDay = -1;
  let curMonth = 0;
  for (let k = 0; k < m; k++) {
    const code = P.type[idx[k]!]!;
    if (!isMediaCode(code)) continue;
    if (ctx.day[k] !== curDay) {
      curDay = ctx.day[k]!;
      curMonth = monthOf(curDay * DAY) - firstMonth;
    }
    monthlyByType[TYPES[code] as MediaKind][curMonth]!++;
  }
  const inView = new Set<number>();
  for (let k = 0; k < m; k++) if (P.type[idx[k]!] === T.poll) inView.add(idx[k]!);
  const polls = P.polls
    .filter((p) => inView.has(p.i))
    .slice(-50)
    .map((p) => ({ question: p.question, author: P.author[p.i]!, ts: P.ts[p.i]! + ctx.shift, options: p.options }));
  return {
    byType,
    byPerson: c.pp.media,
    total,
    links: { total: c.pp.links.reduce((x, y) => x + y, 0), byPerson: c.pp.links, topDomains: topK(domainTotals, 10).map(({ key, count }) => ({ key: P.domains[key]!, count })) },
    deleted: { total: c.pp.deleted.reduce((x, y) => x + y, 0), byPerson: c.pp.deleted },
    edited: { total: c.pp.edited.reduce((x, y) => x + y, 0), byPerson: c.pp.edited },
    calls: {
      total: c.pp.calls.reduce((x, y) => x + y, 0),
      missed: c.pp.missed.reduce((x, y) => x + y, 0),
      video: c.callsVideo,
      byPerson: c.pp.calls,
      missedByPerson: c.pp.missed,
      durationSec: c.callSec,
    },
    polls,
    locations: byType.location,
    viewOnce: c.viewOnce,
    monthly: { starts: Array.from({ length: nMonths }, (_, i) => monthStart(firstMonth + i)), byType: monthlyByType },
  };
}

/* ------------------------------------------------------------------ */
/* Sentiment                                                            */
/* ------------------------------------------------------------------ */

export function computeSentiment(ctx: Ctx, c: ContentResult): SentimentStats {
  const { P, m, idx, au, np, day } = ctx;
  const main = ctx.mainPeople;
  const pos = new Int32Array(np).fill(-1);
  main.forEach((p, i) => (pos[p] = i));
  const firstMonth = m > 0 ? monthOf(ctx.firstDay * DAY) : 0;
  const nMonths = m > 0 ? monthOf(ctx.lastDay * DAY) - firstMonth + 1 : 0;
  const mSum = zeros(nMonths);
  const mCnt = zeros(nMonths);
  const pSum = main.map(() => zeros(nMonths));
  const pCnt = main.map(() => zeros(nMonths));
  const daySum = new Map<number, number>();
  const dayCnt = new Map<number, number>();
  let curDay = -1;
  let curMonth = 0;
  for (let k = 0; k < m; k++) {
    const i = idx[k]!;
    if (P.type[i] !== T.text) continue;
    const s = P.sentiment[i]!;
    if (day[k] !== curDay) {
      curDay = day[k]!;
      curMonth = monthOf(curDay * DAY) - firstMonth;
    }
    mSum[curMonth]! += s;
    mCnt[curMonth]!++;
    const p = pos[au[k]!]!;
    if (p >= 0) {
      pSum[p]![curMonth]! += s;
      pCnt[p]![curMonth]!++;
    }
    daySum.set(curDay, (daySum.get(curDay) ?? 0) + s);
    dayCnt.set(curDay, (dayCnt.get(curDay) ?? 0) + 1);
  }
  const textTotal = c.pp.textMessages.reduce((x, y) => x + y, 0);
  const sumAll = c.pp.sentimentSum.reduce((x, y) => x + y, 0);
  const byPerson = c.pp.sentimentSum.map((s, a) => (c.pp.textMessages[a]! > 0 ? s / c.pp.textMessages[a]! : 0));

  // Most positive / negative day (enough messages to be meaningful)
  const counts = [...dayCnt.values()].sort((a, b) => a - b);
  // A day needs a reasonable number of messages to be "the most positive day"; adapt to small chats.
  const p75 = counts.length ? counts[Math.floor(counts.length * 0.75)]! : 3;
  const minMsgs = Math.max(3, Math.min(10, p75));
  let bestDay = -1;
  let worstDay = -1;
  let bestScore = -Infinity;
  let worstScore = Infinity;
  for (const [d, cnt] of dayCnt) {
    if (cnt < minMsgs) continue;
    const avg = daySum.get(d)! / cnt;
    if (avg > bestScore) {
      bestScore = avg;
      bestDay = d;
    }
    if (avg < worstScore) {
      worstScore = avg;
      worstDay = d;
    }
  }
  const dayExcerpt = (d: number, dir: 1 | -1): Excerpt[] => {
    const cands: { k: number; s: number }[] = [];
    for (let k = 0; k < m; k++) {
      if (day[k] !== d) continue;
      const i = idx[k]!;
      if (P.type[i] !== T.text || !(P.flags[i]! & F.SENTIMENT)) continue;
      cands.push({ k, s: P.sentiment[i]! * dir });
    }
    return cands.sort((a, b) => b.s - a.s).slice(0, 3).sort((a, b) => a.k - b.k).map(({ k }) => excerptAt(ctx, k, 140));
  };
  let goodVibes = -1;
  for (let a = 0; a < np; a++) {
    if (c.pp.textMessages[a]! < 30) continue;
    if (goodVibes < 0 || byPerson[a]! > byPerson[goodVibes]!) goodVibes = a;
  }
  const pos_ = c.pp.positive.reduce((x, y) => x + y, 0);
  const neg_ = c.pp.negative.reduce((x, y) => x + y, 0);
  return {
    average: textTotal > 0 ? sumAll / textTotal : 0,
    byPerson,
    monthly: {
      starts: Array.from({ length: nMonths }, (_, i) => monthStart(firstMonth + i)),
      overall: mSum.map((s, i) => (mCnt[i]! >= 5 ? s / mCnt[i]! : null)),
      byPerson: pSum.map((row, p) => row.map((s, i) => (pCnt[p]![i]! >= 5 ? s / pCnt[p]![i]! : null))),
    },
    mostPositiveDay: bestDay >= 0 ? { day: bestDay * DAY, score: bestScore, count: dayCnt.get(bestDay)!, excerpt: dayExcerpt(bestDay, 1) } : null,
    mostNegativeDay: worstDay >= 0 && worstDay !== bestDay ? { day: worstDay * DAY, score: worstScore, count: dayCnt.get(worstDay)!, excerpt: dayExcerpt(worstDay, -1) } : null,
    goodVibes,
    positiveShare: textTotal > 0 ? pos_ / textTotal : 0,
    negativeShare: textTotal > 0 ? neg_ / textTotal : 0,
  };
}
