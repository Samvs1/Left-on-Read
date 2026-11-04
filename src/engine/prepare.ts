/**
 * Turns parsed messages into compact, columnar per-message features that do
 * not depend on settings. This is the expensive step (tokenizing, emoji
 * normalization, sentiment) and runs once per chat; `computeStats` then
 * aggregates over these typed arrays for every settings change.
 */
import type { Message, MessageType, ParseResult, Platform, SystemKind } from '../parser/types';
import { emojiDisplay, emojiKey, emojiSkinTone, linkDomain } from '../parser/extract';
import { STOPWORDS } from './lexicon/stopwords';
import { INTENSIFIERS, NEGATORS, SENTIMENT_EMOJIS, SENTIMENT_WORDS, squash } from './lexicon/sentiment';
import {
  APOLOGIES,
  GOODBYES,
  GOODNIGHTS,
  GREETINGS,
  LAUGH_EMOJIS,
  LOVE_YOUS,
  SWEAR_PREFIXES_NL,
  SWEARS_EN,
  SWEARS_NL,
  laughKind,
  phraseList,
} from './lexicon/phrases';

export const TYPES: MessageType[] = [
  'text', 'image', 'video', 'audio', 'sticker', 'gif', 'document', 'contact', 'location', 'poll', 'deleted', 'system', 'call', 'media',
];
export const T: Record<MessageType, number> = Object.fromEntries(TYPES.map((t, i) => [t, i])) as Record<MessageType, number>;
/** Type codes 1–9 and 13 are media. */
export const isMediaCode = (c: number) => (c >= 1 && c <= 9) || c === 13;

export const F = {
  QUESTION: 1 << 0,
  EXCLAIM: 1 << 1,
  CAPS: 1 << 2,
  ELLIPSIS: 1 << 3,
  LOWER: 1 << 4,
  ELONG: 1 << 5,
  LINK: 1 << 6,
  LAUGH: 1 << 7,
  LAUGH_ONLY: 1 << 8,
  APOLOGY: 1 << 9,
  LOVE: 1 << 10,
  GREETING: 1 << 11,
  GOODBYE: 1 << 12,
  GOODNIGHT: 1 << 13,
  EMOJI_ONLY: 1 << 14,
  EDITED: 1 << 15,
  PERIOD: 1 << 16,
  COMMA: 1 << 17,
  MISSED: 1 << 18,
  VIDEO: 1 << 19,
  VIEW_ONCE: 1 << 20,
  SENTIMENT: 1 << 21,
} as const;

export interface SystemInfo {
  i: number;
  kind: SystemKind;
  actor: string | null;
  targets: string[];
  subject: string | null;
}

export interface PollInfo {
  i: number;
  question: string;
  options: { label: string; votes: number }[];
}

export interface Prepared {
  n: number;
  people: string[];
  isGroup: boolean;
  title: string | null;
  selfIdx: number;
  platform: Platform;
  ts: Float64Array;
  author: Int16Array;
  type: Uint8Array;
  flags: Uint32Array;
  words: Uint32Array;
  chars: Uint32Array;
  letters: Uint32Array;
  exclam: Uint16Array;
  laughs: Uint8Array;
  sentiment: Float32Array;
  swears: Uint8Array;
  callSec: Uint32Array;
  tokStart: Uint32Array;
  tokens: Int32Array;
  emoStart: Uint32Array;
  emoIds: Int32Array;
  emoTone: Uint8Array;
  linkStart: Uint32Array;
  linkDomains: Int32Array;
  vocab: string[];
  vocabStop: Uint8Array;
  vocabLaugh: Int8Array;
  vocabSwear: Uint8Array;
  vocabElong: Uint8Array;
  laughKinds: string[];
  emojiKeys: string[];
  emojiDisplay: string[];
  domains: string[];
  texts: string[];
  systems: SystemInfo[];
  polls: PollInfo[];
}

/** Lazily filled BMP tables: 1 = letter/number/mark, 2 = other. */
const WORD_TABLE = new Uint8Array(65536);
const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}]/u;
function isWordCode(c: number): boolean {
  if (c < 128) return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57);
  if (c >= 0xd800 && c <= 0xdfff) return false;
  let k = WORD_TABLE[c]!;
  if (k === 0) {
    k = WORD_CHAR_RE.test(String.fromCharCode(c)) ? 1 : 2;
    WORD_TABLE[c] = k;
  }
  return k === 1;
}
/** 1 = upper case, 2 = lower case, 3 = caseless. */
const CASE_TABLE = new Uint8Array(65536);
function caseCode(c: number): number {
  let k = CASE_TABLE[c]!;
  if (k === 0) {
    const ch = String.fromCharCode(c);
    k = ch.toLowerCase() !== ch ? 1 : ch.toUpperCase() !== ch ? 2 : 3;
    CASE_TABLE[c] = k;
  }
  return k;
}
const ELONG_RE = /(\p{L})\1\1/u;
const ONE_LETTER_RE = /^(\p{L})\1*$/u;

interface PhraseMatcher {
  byFirst: Map<string, string[][]>;
}

function matcher(src: string): PhraseMatcher {
  const byFirst = new Map<string, string[][]>();
  for (const p of phraseList(src)) {
    const list = byFirst.get(p[0]!) ?? [];
    list.push(p);
    byFirst.set(p[0]!, list);
  }
  return { byFirst };
}

function matchAt(toks: string[], i: number, p: string[]): boolean {
  if (i + p.length > toks.length) return false;
  for (let k = 0; k < p.length; k++) if (toks[i + k] !== p[k]) return false;
  return true;
}

/** Does any phrase occur in toks[from..to)? */
function hasPhrase(m: PhraseMatcher, toks: string[], from = 0, to = toks.length): boolean {
  for (let i = from; i < to; i++) {
    const list = m.byFirst.get(toks[i]!);
    if (!list) continue;
    for (const p of list) if (matchAt(toks, i, p)) return true;
  }
  return false;
}

/** Does a phrase end exactly at the last token? */
function endsWithPhrase(m: PhraseMatcher, toks: string[]): boolean {
  const n = toks.length;
  for (let len = 1; len <= Math.min(4, n); len++) {
    const list = m.byFirst.get(toks[n - len]!);
    if (!list) continue;
    for (const p of list) if (p.length === len && matchAt(toks, n - len, p)) return true;
  }
  return false;
}

const GREET = matcher(GREETINGS);
const BYE = matcher(GOODBYES);
const NIGHT = matcher(GOODNIGHTS);
const SORRY = matcher(APOLOGIES);
const LOVE = matcher(LOVE_YOUS);
const SWEAR_SET = new Set([...phraseList(SWEARS_EN), ...phraseList(SWEARS_NL)].map((p) => p.join(' ')));

/** Growable Int32 buffer. */
class IntBuf {
  a: Int32Array;
  n = 0;
  constructor(cap: number) {
    this.a = new Int32Array(Math.max(16, cap));
  }
  push(v: number) {
    if (this.n === this.a.length) {
      const b = new Int32Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.n++] = v;
  }
  done(): Int32Array {
    return this.a.slice(0, this.n);
  }
}

export interface PrepareOptions {
  titleHint?: string | null;
  onProgress?: (f: number) => void;
}

export function prepare(parsed: ParseResult, opts: PrepareOptions = {}): Prepared {
  const msgs: Message[] = parsed.messages;
  const n = msgs.length;
  const people = parsed.participants;
  const personIdx = new Map(people.map((p, i) => [p, i]));

  const ts = new Float64Array(n);
  const author = new Int16Array(n);
  const type = new Uint8Array(n);
  const flags = new Uint32Array(n);
  const words = new Uint32Array(n);
  const chars = new Uint32Array(n);
  const letters = new Uint32Array(n);
  const exclam = new Uint16Array(n);
  const laughs = new Uint8Array(n);
  const sentiment = new Float32Array(n);
  const swears = new Uint8Array(n);
  const callSec = new Uint32Array(n);
  const tokStart = new Uint32Array(n + 1);
  const emoStart = new Uint32Array(n + 1);
  const linkStart = new Uint32Array(n + 1);
  const tokens = new IntBuf(n * 6);
  const emoIds = new IntBuf(n / 2);
  const emoTones: number[] = [];
  const linkDomains = new IntBuf(64);
  const texts: string[] = new Array(n);
  const systems: SystemInfo[] = [];
  const polls: PollInfo[] = [];

  const vocabMap = new Map<string, number>();
  const vocab: string[] = [];
  const vStop: number[] = [];
  const vLaugh: number[] = [];
  const vSwear: number[] = [];
  const vElong: number[] = [];
  const vSent: number[] = [];
  const vNeg: number[] = [];
  const vInt: number[] = [];
  /** Bit set of phrase lists (greeting, bye, night, sorry, love) this word can start. */
  const vPhrase: number[] = [];
  const laughKinds: string[] = [];
  const laughKindIdx = new Map<string, number>();

  const emojiMap = new Map<string, number>();
  const emojiKeys: string[] = [];
  const emojiDisp: string[] = [];
  const domainMap = new Map<string, number>();
  const domains: string[] = [];

  const addWord = (w: string): number => {
    const id = vocab.length;
    vocabMap.set(w, id);
    vocab.push(w);
    vStop.push(STOPWORDS.has(w) ? 1 : 0);
    const lk = laughKind(w);
    if (lk) {
      let li = laughKindIdx.get(lk);
      if (li === undefined) {
        li = laughKinds.length;
        laughKinds.push(lk);
        laughKindIdx.set(lk, li);
      }
      vLaugh.push(li);
    } else vLaugh.push(-1);
    let sw = SWEAR_SET.has(w) ? 1 : 0;
    if (!sw) for (const p of SWEAR_PREFIXES_NL) if (w.length > p.length + 1 && w.startsWith(p)) sw = 1;
    vSwear.push(sw);
    vElong.push(!lk && w.length >= 3 && ELONG_RE.test(w) && !ONE_LETTER_RE.test(w) && !/^\d+$/.test(w) ? 1 : 0);
    vSent.push(SENTIMENT_WORDS.get(w) ?? 0);
    vNeg.push(NEGATORS.has(w) ? 1 : 0);
    vInt.push(INTENSIFIERS.has(w) ? 1 : 0);
    vPhrase.push(
      (GREET.byFirst.has(w) ? 1 : 0) | (BYE.byFirst.has(w) ? 2 : 0) | (NIGHT.byFirst.has(w) ? 4 : 0) | (SORRY.byFirst.has(w) ? 8 : 0) | (LOVE.byFirst.has(w) ? 16 : 0),
    );
    return id;
  };

  const toks: string[] = [];
  let idsBuf = new Int32Array(1024);
  let nIds = 0;
  const spans = new Int32Array(64);
  const flushToken = (text: string, a: number, b: number, hasUpper: boolean, curly: boolean): number => {
    let w = text.slice(a, b);
    if (hasUpper) w = w.toLowerCase();
    if (curly) w = w.replace(/’/g, "'");
    const id = vocabMap.get(w);
    return id === undefined ? addWord(w) : id;
  };
  const rawEmoji = new Map<string, number>();
  const rawTone = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const m = msgs[i]!;
    ts[i] = m.timestamp;
    const code = T[m.type];
    type[i] = code;
    author[i] = m.author !== null && m.type !== 'system' ? (personIdx.get(m.author) ?? -1) : -1;
    texts[i] = m.text;
    let f = 0;
    if (m.edited) f |= F.EDITED;
    if (m.meta?.viewOnce) f |= F.VIEW_ONCE;
    if (m.type === 'call') {
      if (m.meta?.missed) f |= F.MISSED;
      if (m.meta?.video) f |= F.VIDEO;
      callSec[i] = m.meta?.durationSec ?? 0;
    }
    if (m.type === 'system') {
      systems.push({
        i,
        kind: m.meta?.systemKind ?? 'other',
        actor: m.meta?.actor ?? null,
        targets: m.meta?.targets ?? [],
        subject: m.meta?.subject ?? null,
      });
    } else if (m.type === 'poll') {
      polls.push({ i, question: m.meta?.pollQuestion ?? m.text, options: m.meta?.pollOptions ?? [] });
    }

    const text = m.text;
    tokStart[i] = tokens.n;
    emoStart[i] = emoIds.n;
    linkStart[i] = linkDomains.n;
    if (text.length > 0 && m.type !== 'system') {
      chars[i] = text.length;
      // ---- Single-pass scan: tokens, case, punctuation (URLs skipped) ----
      let spanAt = 0;
      let spanStart = Infinity;
      let spanEnd = 0;
      let nSpans = 0;
      if (m.links.length > 0) {
        let from = 0;
        for (const l of m.links) {
          const at = text.indexOf(l, from);
          if (at < 0) continue;
          spans[nSpans * 2] = at;
          spans[nSpans * 2 + 1] = at + l.length;
          nSpans++;
          from = at + l.length;
        }
        if (nSpans > 0) {
          spanStart = spans[0]!;
          spanEnd = spans[1]!;
        }
      }
      nIds = 0;
      let letterCount = 0;
      let phraseBits = 0;
      let up = 0;
      let lo = 0;
      let qMarks = 0;
      let ex = 0;
      let commas = 0;
      let dots = 0;
      let ellipsis = false;
      let lastNS = 0;
      let prevNS = 0;
      let tStart = -1;
      let tUpper = false;
      let tCurly = false;
      const L = text.length;
      for (let q = 0; q <= L; q++) {
        if (q === spanStart) {
          if (tStart >= 0) {
            const id = flushToken(text, tStart, q, tUpper, tCurly);
            idsBuf[nIds++] = id;
            tokens.push(id);
            phraseBits |= vPhrase[id]!;
            letterCount += q - tStart;
            tStart = -1;
          }
          q = spanEnd - 1;
          spanAt++;
          spanStart = spanAt < nSpans ? spans[spanAt * 2]! : Infinity;
          spanEnd = spanAt < nSpans ? spans[spanAt * 2 + 1]! : 0;
          lastNS = 120; // a URL counts as non-space content
          prevNS = 0;
          dots = 0;
          continue;
        }
        const c = q < L ? text.charCodeAt(q) : 32;
        let word = false;
        let upper = false;
        if (c < 128) {
          if (c >= 97 && c <= 122) {
            word = true;
            lo++;
          } else if (c >= 65 && c <= 90) {
            word = true;
            upper = true;
            up++;
          } else if (c >= 48 && c <= 57) {
            word = true;
          } else if (c === 39 && tStart >= 0 && q + 1 < L && isWordCode(text.charCodeAt(q + 1))) {
            word = true;
          } else if (c === 63) qMarks++;
          else if (c === 33) ex++;
          else if (c === 44) commas++;
          if (c === 46) {
            if (++dots >= 3) ellipsis = true;
          } else dots = 0;
        } else {
          dots = 0;
          if (c >= 0xd800 && c <= 0xdfff) {
            word = false;
          } else if (c === 0x2019 && tStart >= 0 && q + 1 < L && isWordCode(text.charCodeAt(q + 1))) {
            word = true;
            tCurly = true;
          } else if (c === 0x2026) {
            ellipsis = true;
          } else if (isWordCode(c)) {
            word = true;
            const k = caseCode(c);
            if (k === 1) {
              upper = true;
              up++;
            } else if (k === 2) lo++;
          }
        }
        if (c !== 32 && c !== 10 && c !== 9 && c !== 13 && c !== 160 && q < L) {
          prevNS = lastNS;
          lastNS = c;
        }
        if (word) {
          if (tStart < 0) {
            tStart = q;
            tUpper = false;
            tCurly = c === 0x2019;
          }
          if (upper) tUpper = true;
        } else if (tStart >= 0) {
          const id = flushToken(text, tStart, q, tUpper, tCurly);
          idsBuf[nIds++] = id;
          tokens.push(id);
          phraseBits |= vPhrase[id]!;
          letterCount += q - tStart;
          tStart = -1;
          if (nIds === idsBuf.length) {
            const bigger = new Int32Array(idsBuf.length * 2);
            bigger.set(idsBuf);
            idsBuf = bigger;
          }
        }
      }
      words[i] = nIds;
      letters[i] = letterCount;

      // Style flags
      if (qMarks > 0) f |= F.QUESTION;
      if (ex > 0) {
        f |= F.EXCLAIM;
        exclam[i] = Math.min(ex, 65535);
      }
      if (ellipsis) f |= F.ELLIPSIS;
      if (commas > 0) f |= F.COMMA;
      if (lastNS === 46 && prevNS !== 46) f |= F.PERIOD;
      if (m.links.length > 0) f |= F.LINK;
      if (letterCount >= 3) {
        if (up >= 4 && lo === 0) f |= F.CAPS;
        else if (lo >= 3 && up === 0) f |= F.LOWER;
      }

      // Token-level features
      let laughTok = 0;
      let swearTok = 0;
      let raw = 0;
      let hits = 0;
      let elong = false;
      for (let k = 0; k < nIds; k++) {
        const id = idsBuf[k]!;
        if (vLaugh[id]! >= 0) laughTok++;
        if (vSwear[id]) swearTok++;
        if (vElong[id]) elong = true;
        const sv = vSent[id]!;
        if (sv !== 0) {
          let v = sv;
          // Intensifier right before
          if (k > 0 && vInt[idsBuf[k - 1]!]) v *= 1.5;
          // Negation within the previous 3 tokens flips and dampens
          for (let b = 1; b <= 3 && k - b >= 0; b++) {
            if (vNeg[idsBuf[k - b]!]) {
              v *= -0.75;
              break;
            }
          }
          raw += v;
          hits++;
        }
      }
      if (elong) f |= F.ELONG;
      swears[i] = Math.min(255, swearTok);

      // Emojis
      let laughEmo = 0;
      let otherEmo = 0;
      for (const e of m.emojis) {
        let eid = rawEmoji.get(e);
        if (eid === undefined) {
          const key = emojiKey(e);
          eid = emojiMap.get(key);
          if (eid === undefined) {
            eid = emojiKeys.length;
            emojiMap.set(key, eid);
            emojiKeys.push(key);
            emojiDisp.push(emojiDisplay(key));
          }
          rawEmoji.set(e, eid);
          rawTone.set(e, emojiSkinTone(e));
        }
        const key = emojiKeys[eid]!;
        emoIds.push(eid);
        emoTones.push(rawTone.get(e)!);
        if (LAUGH_EMOJIS.has(key)) laughEmo++;
        else otherEmo++;
        const es = SENTIMENT_EMOJIS.get(key);
        if (es !== undefined) {
          raw += es;
          hits++;
        }
      }
      const laughTotal = laughTok + laughEmo;
      laughs[i] = Math.min(255, laughTotal);
      if (laughTotal > 0) {
        f |= F.LAUGH;
        if (laughTok === nIds && otherEmo === 0) f |= F.LAUGH_ONLY;
      }
      if (nIds === 0 && m.emojis.length > 0) f |= F.EMOJI_ONLY;
      if (hits > 0) {
        f |= F.SENTIMENT;
        sentiment[i] = squash(raw);
      }

      // Phrases (only when some token can start a phrase)
      if (phraseBits !== 0) {
        toks.length = 0;
        for (let k = 0; k < nIds; k++) toks.push(vocab[idsBuf[k]!]!);
        if (phraseBits & 1 && hasPhrase(GREET, toks, 0, Math.min(2, toks.length))) f |= F.GREETING;
        if (phraseBits & 2 && (toks.length <= 8 ? hasPhrase(BYE, toks) : endsWithPhrase(BYE, toks))) f |= F.GOODBYE;
        if (phraseBits & 4 && (toks.length <= 10 ? hasPhrase(NIGHT, toks) : endsWithPhrase(NIGHT, toks))) f |= F.GOODNIGHT;
        if (phraseBits & 8 && hasPhrase(SORRY, toks)) f |= F.APOLOGY;
        if (phraseBits & 16 && hasPhrase(LOVE, toks)) f |= F.LOVE;
      }

      // Links
      for (const l of m.links) {
        const d = linkDomain(l);
        if (!d) continue;
        let did = domainMap.get(d);
        if (did === undefined) {
          did = domains.length;
          domainMap.set(d, did);
          domains.push(d);
        }
        linkDomains.push(did);
      }
    }
    flags[i] = f;
    if (opts.onProgress && (i & 16383) === 0) opts.onProgress(i / n);
  }
  tokStart[n] = tokens.n;
  emoStart[n] = emoIds.n;
  linkStart[n] = linkDomains.n;

  const selfIdx = parsed.selfAuthor ? (personIdx.get(parsed.selfAuthor) ?? -1) : -1;
  opts.onProgress?.(1);
  return {
    n,
    people,
    isGroup: parsed.isGroup,
    title: parsed.chatTitle ?? opts.titleHint ?? null,
    selfIdx,
    platform: parsed.platform,
    ts,
    author,
    type,
    flags,
    words,
    chars,
    letters,
    exclam,
    laughs,
    sentiment,
    swears,
    callSec,
    tokStart,
    tokens: tokens.done(),
    emoStart,
    emoIds: emoIds.done(),
    emoTone: Uint8Array.from(emoTones),
    linkStart,
    linkDomains: linkDomains.done(),
    vocab,
    vocabStop: Uint8Array.from(vStop),
    vocabLaugh: Int8Array.from(vLaugh),
    vocabSwear: Uint8Array.from(vSwear),
    vocabElong: Uint8Array.from(vElong),
    laughKinds,
    emojiKeys,
    emojiDisplay: emojiDisp,
    domains,
    texts,
    systems,
    polls,
  };
}
