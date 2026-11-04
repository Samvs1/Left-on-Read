/**
 * Extraction of links, emojis and mentions from message text.
 */

const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCT_RE = /[.,!?;:'"»”’>]+$/;

export function extractLinks(text: string): string[] {
  if (text.indexOf('://') === -1 && text.indexOf('www.') === -1 && text.indexOf('WWW.') === -1) return [];
  const out: string[] = [];
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(text)) !== null) {
    let url = m[0].replace(TRAILING_PUNCT_RE, '');
    // Drop an unbalanced closing parenthesis: "(see https://x.com/a)"
    while (url.endsWith(')') && count(url, '(') < count(url, ')')) url = url.slice(0, -1).replace(TRAILING_PUNCT_RE, '');
    if (url.length > 6) out.push(url);
  }
  return out;
}

function count(s: string, ch: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === ch) n++;
  return n;
}

/** Hostname without "www.", lowercased. Returns null for garbage. */
export function linkDomain(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\d?\./, '').replace(/^m\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Emoji matcher. Handles flags (regional indicator pairs), keycaps,
 * skin-tone modifiers, ZWJ sequences, variation selectors and tag sequences
 * (subdivision flags).
 */
const EMOJI_RE =
  /\p{RI}\p{RI}|[#*0-9]️?⃣|\p{Extended_Pictographic}[︎️]?\p{EMod}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:‍\p{Extended_Pictographic}[︎️]?\p{EMod}?)*/gu;
/** Pictographic code points that are usually typed as text symbols. */
const TEXTY = new Set(['©', '®', '™', '‼', '⁉', '↔', '↕', '↖', '↗', '↘', '↙', '▪', '▫', '◻', '◼', '◽', '◾', '⬛', '⬜']);
// Fast pre-check: any code point >= U+00A9 that could start an emoji or a digit keycap.
const MAYBE_EMOJI_RE = /[©®‼-㊙\uD83C-\uDBFF]|⃣/;

export function extractEmojis(text: string): string[] {
  if (!MAYBE_EMOJI_RE.test(text)) return [];
  const out: string[] = [];
  EMOJI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMOJI_RE.exec(text)) !== null) {
    const e = m[0];
    if (e.length === 1 && TEXTY.has(e)) continue;
    out.push(e);
  }
  return out;
}

const SKIN_TONE_RE = /[\u{1F3FB}-\u{1F3FF}]/gu;
const VARIATION_RE = /[︎️]/g;

/** Canonical key for counting: strips skin tones and variation selectors. */
export function emojiKey(e: string): string {
  return e.replace(SKIN_TONE_RE, '').replace(VARIATION_RE, '');
}

/** 1-5 for Fitzpatrick types 1-2 … 6, 0 when the emoji has no skin tone. */
export function emojiSkinTone(e: string): number {
  const m = e.match(/[\u{1F3FB}-\u{1F3FF}]/u);
  if (!m) return 0;
  return (m[0].codePointAt(0)! - 0x1f3fb) + 1;
}

const PRESENTATION_RE = /\p{Emoji_Presentation}/u;
/** Re-adds U+FE0F to single code point emojis that default to text presentation (❤ → ❤️). */
export function emojiDisplay(key: string): string {
  const cps = Array.from(key);
  if (cps.length === 1 && !PRESENTATION_RE.test(key)) return `${key}️`;
  if (cps.length > 1 && key.includes('‍')) {
    // e.g. ❤‍🔥 → ❤️‍🔥
    return cps.map((c, i) => (i < cps.length - 1 && cps[i + 1] === '‍' && !PRESENTATION_RE.test(c) ? `${c}️` : c)).join('');
  }
  return key;
}

const MENTION_ISOLATE_RE = /@⁨([^⁩\n]{1,64})⁩/g;
const MENTION_NUMBER_RE = /(?:^|[\s(])@(\+?\d[\d ]{5,18}\d)/g;
const MENTION_NAME_RE = /(?:^|[\s(])@([\p{L}\p{N}][\p{L}\p{N}_.\-]{0,30})/gu;

/** Extracts mentions. Must run on raw text (before bidi isolates are stripped). */
export function extractMentions(rawText: string): string[] {
  if (rawText.indexOf('@') === -1) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_ISOLATE_RE.lastIndex = 0;
  while ((m = MENTION_ISOLATE_RE.exec(rawText)) !== null) out.add(m[1]!.replace(/[‎‏‪-‮]/g, '').trim());
  const stripped = rawText.replace(MENTION_ISOLATE_RE, ' ').replace(/[‎‏‪-‮⁦-⁩﻿]/g, '');
  MENTION_NUMBER_RE.lastIndex = 0;
  while ((m = MENTION_NUMBER_RE.exec(stripped)) !== null) out.add(m[1]!.replace(/\s+/g, ''));
  MENTION_NAME_RE.lastIndex = 0;
  while ((m = MENTION_NAME_RE.exec(stripped)) !== null) {
    if (!/^\d+$/.test(m[1]!)) out.add(m[1]!);
  }
  out.delete('');
  return [...out];
}
