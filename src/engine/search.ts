/**
 * Word / phrase / emoji search over the prepared chat, plus "firsts".
 */
import type { Ctx } from './context';
import { emojiKey, extractEmojis } from '../parser/extract';
import type { Excerpt, FirstUse, WordSearchResult } from './types';
import { DAY, monthOf, monthStart, zeros } from './util';
import { excerptAt } from './stats/common';

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

type Query =
  | { kind: 'tokens'; seq: (number[] | null)[] } // each position: allowed vocab ids (null = unknown word)
  | { kind: 'emoji'; ids: number[] }
  | { kind: 'empty' };

function compile(ctx: Ctx, raw: string): Query {
  const q = raw.trim().toLowerCase();
  if (!q) return { kind: 'empty' };
  const P = ctx.P;
  const words = q.replace(/’/g, "'").match(TOKEN_RE);
  if (!words || words.length === 0) {
    const emojis = extractEmojis(q).map(emojiKey);
    if (emojis.length === 0) return { kind: 'empty' };
    const ids: number[] = [];
    P.emojiKeys.forEach((k, i) => {
      if (emojis.includes(k)) ids.push(i);
    });
    return { kind: 'emoji', ids };
  }
  const wildcard = /\*\s*$/.test(q);
  const seq = words.map((w, i) => {
    if (wildcard && i === words.length - 1) {
      const ids: number[] = [];
      for (let v = 0; v < P.vocab.length; v++) if (P.vocab[v]!.startsWith(w)) ids.push(v);
      return ids.length ? ids : null;
    }
    const id = vocabIndex(ctx).get(w);
    return id === undefined ? null : [id];
  });
  return { kind: 'tokens', seq };
}

const indexCache = new WeakMap<object, Map<string, number>>();
function vocabIndex(ctx: Ctx): Map<string, number> {
  let m = indexCache.get(ctx.P);
  if (!m) {
    m = new Map(ctx.P.vocab.map((w, i) => [w, i]));
    indexCache.set(ctx.P, m);
  }
  return m;
}

/** Number of occurrences of the query in message `i`. */
function occurrences(ctx: Ctx, query: Query, i: number): number {
  const P = ctx.P;
  if (query.kind === 'emoji') {
    let n = 0;
    for (let e = P.emoStart[i]!; e < P.emoStart[i + 1]!; e++) if (query.ids.includes(P.emoIds[e]!)) n++;
    return n;
  }
  if (query.kind !== 'tokens') return 0;
  const seq = query.seq;
  if (seq.some((s) => s === null)) return 0;
  const t0 = P.tokStart[i]!;
  const t1 = P.tokStart[i + 1]!;
  const L = seq.length;
  let n = 0;
  for (let t = t0; t + L <= t1; t++) {
    let ok = true;
    for (let j = 0; j < L; j++) {
      const allowed = seq[j]!;
      const tok = P.tokens[t + j]!;
      if (allowed.length === 1 ? allowed[0] !== tok : !allowed.includes(tok)) {
        ok = false;
        break;
      }
    }
    if (ok) n++;
  }
  return n;
}

export function searchWord(ctx: Ctx, raw: string): WordSearchResult {
  const query = compile(ctx, raw);
  const { m, np, idx, au } = ctx;
  const firstMonth = m > 0 ? monthOf(ctx.firstDay * DAY) : 0;
  const nMonths = m > 0 ? monthOf(ctx.lastDay * DAY) - firstMonth + 1 : 0;
  const res: WordSearchResult = {
    query: raw.trim(),
    total: 0,
    messages: 0,
    byPerson: zeros(np),
    monthly: { starts: Array.from({ length: nMonths }, (_, i) => monthStart(firstMonth + i)), counts: zeros(nMonths) },
    first: null,
    last: null,
    examples: [],
  };
  if (query.kind === 'empty') return res;
  const hits: number[] = [];
  let curDay = -1;
  let curMonth = 0;
  for (let k = 0; k < m; k++) {
    const n = occurrences(ctx, query, idx[k]!);
    if (n === 0) continue;
    if (ctx.day[k] !== curDay) {
      curDay = ctx.day[k]!;
      curMonth = monthOf(curDay * DAY) - firstMonth;
    }
    res.total += n;
    res.messages++;
    res.byPerson[au[k]!]! += n;
    res.monthly.counts[curMonth]! += n;
    hits.push(k);
  }
  if (hits.length > 0) {
    res.first = excerptAt(ctx, hits[0]!, 160);
    res.last = excerptAt(ctx, hits[hits.length - 1]!, 160);
    const step = Math.max(1, Math.floor(hits.length / 5));
    for (let h = 0; h < hits.length && res.examples.length < 5; h += step) res.examples.push(excerptAt(ctx, hits[h]!, 160));
  }
  return res;
}

/** First time each person used each word/phrase/emoji. */
export function firstUses(ctx: Ctx, words: string[]): FirstUse[] {
  const out: FirstUse[] = [];
  for (const w of words) {
    const query = compile(ctx, w);
    const byPerson: (Excerpt | null)[] = new Array(ctx.np).fill(null);
    if (query.kind !== 'empty') {
      let found = 0;
      for (let k = 0; k < ctx.m && found < ctx.np; k++) {
        const a = ctx.au[k]!;
        if (byPerson[a] !== null) continue;
        if (occurrences(ctx, query, ctx.idx[k]!) > 0) {
          byPerson[a] = excerptAt(ctx, k, 160);
          found++;
        }
      }
    }
    if (byPerson.some((x) => x !== null)) out.push({ word: w, byPerson });
  }
  return out;
}
