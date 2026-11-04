/**
 * Invisible / formatting characters that WhatsApp sprinkles through exports:
 *  - U+200E LEFT-TO-RIGHT MARK, U+200F RIGHT-TO-LEFT MARK
 *  - U+202A..U+202E bidi embeddings / overrides (around phone numbers)
 *  - U+2066..U+2069 bidi isolates (around @mentions in newer versions)
 *  - U+FEFF byte order mark / zero width no-break space
 * U+200D (zero width joiner) is deliberately kept: emoji sequences need it.
 */
export const INVISIBLE_RE = /[‎‏‪-‮⁦-⁩﻿]/g;
const LEADING_INVISIBLE_RE = /^[‎‏‪-‮⁦-⁩﻿]+/;
/** Exotic spaces (NBSP, narrow NBSP, figure space, thin spaces …) */
const SPACES_RE = /[  -   　]/g;

export function stripInvisible(s: string): string {
  return s.replace(INVISIBLE_RE, '');
}

export function stripLeadingInvisible(s: string): string {
  const c = s.charCodeAt(0);
  if (c === 0x200e || c === 0x200f || c === 0xfeff || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) {
    return s.replace(LEADING_INVISIBLE_RE, '');
  }
  return s;
}

export function normalizeSpaces(s: string): string {
  return s.replace(SPACES_RE, ' ');
}

/** Full cleanup for user-visible text. */
export function cleanText(s: string): string {
  return normalizeSpaces(stripInvisible(s));
}

/**
 * Cleans an author label: removes bidi marks, the "~ " prefix WhatsApp adds
 * for people who are not in your contacts, and surrounding whitespace.
 */
export function cleanAuthor(s: string): string {
  let a = normalizeSpaces(stripInvisible(s)).trim();
  if (a.startsWith('~')) a = a.slice(1).trim();
  return a;
}

/** Lowercase, trimmed, whitespace-collapsed form used for placeholder lookups. */
export function normalizeForLookup(s: string): string {
  return normalizeSpaces(stripInvisible(s))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!。]+$/, '')
    .trim();
}
