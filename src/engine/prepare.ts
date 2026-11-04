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

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
const LINK_STRIP_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
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
    return id;
  };

  const toks: string[] = [];
  const ids: number[] = [];
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
      const lower = text.toLowerCase();
      const noLinks = m.links.length > 0 ? lower.replace(LINK_STRIP_RE, ' ') : lower;
      toks.length = 0;
      ids.length = 0;
      let letterCount = 0;
      TOKEN_RE.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = TOKEN_RE.exec(noLinks)) !== null) {
        let w = mm[0];
        if (w.indexOf('’') !== -1) w = w.replace(/’/g, "'");
        let id = vocabMap.get(w);
        if (id === undefined) id = addWord(w);
        toks.push(w);
        ids.push(id);
        tokens.push(id);
        letterCount += w.length;
      }
      words[i] = ids.length;
      letters[i] = letterCount;

      // Style flags
      if (noLinks.indexOf('?') !== -1) f |= F.QUESTION;
      let ex = 0;
      for (let k = noLinks.indexOf('!'); k !== -1; k = noLinks.indexOf('!', k + 1)) ex++;
      if (ex > 0) {
        f |= F.EXCLAIM;
        exclam[i] = Math.min(ex, 65535);
      }
      if (noLinks.indexOf('...') !== -1 || noLinks.indexOf('…') !== -1) f |= F.ELLIPSIS;
      if (noLinks.indexOf(',') !== -1) f |= F.COMMA;
      const trimmed = noLinks.trimEnd();
      if (trimmed.endsWith('.') && !trimmed.endsWith('..')) f |= F.PERIOD;
      if (m.links.length > 0) f |= F.LINK;
      if (letterCount >= 3) {
        const hasUpper = lower !== text;
        const hasLower = text.toUpperCase() !== text;
        if (hasUpper && !hasLower && letterCount >= 4) f |= F.CAPS;
        else if (!hasUpper && hasLower) f |= F.LOWER;
      }

      // Token-level features
      let laughTok = 0;
      let swearTok = 0;
      let raw = 0;
      let hits = 0;
      let elong = false;
      for (let k = 0; k < ids.length; k++) {
        const id = ids[k]!;
        if (vLaugh[id]! >= 0) laughTok++;
        if (vSwear[id]) swearTok++;
        if (vElong[id]) elong = true;
        const sv = vSent[id]!;
        if (sv !== 0) {
          let v = sv;
          // Intensifier right before
          if (k > 0 && vInt[ids[k - 1]!]) v *= 1.5;
          // Negation within the previous 3 tokens flips and dampens
          for (let b = 1; b <= 3 && k - b >= 0; b++) {
            if (vNeg[ids[k - b]!]) {
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
        const key = emojiKey(e);
        let eid = emojiMap.get(key);
        if (eid === undefined) {
          eid = emojiKeys.length;
          emojiMap.set(key, eid);
          emojiKeys.push(key);
          emojiDisp.push(emojiDisplay(key));
        }
        emoIds.push(eid);
        emoTones.push(emojiSkinTone(e));
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
        if (laughTok === ids.length && otherEmo === 0) f |= F.LAUGH_ONLY;
      }
      if (ids.length === 0 && m.emojis.length > 0) f |= F.EMOJI_ONLY;
      if (hits > 0) {
        f |= F.SENTIMENT;
        sentiment[i] = squash(raw);
      }

      // Phrases
      if (toks.length > 0) {
        if (hasPhrase(GREET, toks, 0, Math.min(2, toks.length))) f |= F.GREETING;
        if (toks.length <= 8 ? hasPhrase(BYE, toks) : endsWithPhrase(BYE, toks)) f |= F.GOODBYE;
        if (toks.length <= 10 ? hasPhrase(NIGHT, toks) : endsWithPhrase(NIGHT, toks)) f |= F.GOODNIGHT;
        if (hasPhrase(SORRY, toks)) f |= F.APOLOGY;
        if (hasPhrase(LOVE, toks)) f |= F.LOVE;
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
