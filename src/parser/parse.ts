import {
  ChatParseError,
  type DateOrder,
  type Message,
  type MessageMeta,
  type ParseOptions,
  type ParseResult,
  type ParseWarning,
  type Platform,
} from './types';
import { cleanAuthor, cleanText, stripLeadingInvisible } from './clean';
import { extractEmojis, extractLinks, extractMentions } from './extract';
import { classifyContent, matchSystem, SELF_LABELS, stripEdited, type SystemMatch } from './patterns';

/**
 * iOS:     [12/03/2023, 14:05:32] Sarah: Hey!
 *          [3/12/23, 2:05:32 PM] Sarah: Hey!
 * Android: 12/03/2023, 14:05 - Sarah: Hey!
 *          3/12/23, 2:05 PM - Sarah: Hey!
 *
 * Groups: 1 p1, 2 separator, 3 p2, 4 p3, 5 hour, 6 minute, 7 second, 8 a/p, 9 rest
 */
export const IOS_HEADER_RE =
  /^\[(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})[,.]?\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*([AaPp])\.?\s?[Mm]\.?)?\]\s?(.*)$/;
export const ANDROID_HEADER_RE =
  /^(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})[,.]?\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*([AaPp])\.?\s?[Mm]\.?)?\s?[-–—]\s(.*)$/;

interface RawRecord {
  line: number;
  p1: number;
  p2: number;
  p3: number;
  p1len: number;
  h: number;
  mi: number;
  s: number;
  ap: '' | 'a' | 'p';
  rest: string;
  extra: string[] | null;
}

const QUOTE_RE = /["“”„«»]/;

/** Shared empty array for messages without links/emojis/mentions (saves ~3 allocations per message). */
const EMPTY: string[] = Object.freeze([]) as unknown as string[];
const orEmpty = (a: string[]) => (a.length === 0 ? EMPTY : a);

/** Parallel arrays describing every header line. */
interface Recs {
  line: number[];
  p1: number[];
  p2: number[];
  p3: number[];
  p1len: number[];
  h: number[];
  mi: number[];
  s: number[];
  /** 0 none, 1 am, 2 pm */
  ap: number[];
  rest: string[];
  extra: (string[] | null)[];
}
const COLON_PREFIX_RE = /^([^:\n]{1,30}): /;

export interface Header {
  p1: number;
  p2: number;
  p3: number;
  p1len: number;
  h: number;
  mi: number;
  s: number;
  ap: '' | 'a' | 'p';
  restStart: number;
}

const isSpaceCode = (c: number) =>
  c === 32 || c === 9 || c === 160 || c === 0x202f || (c >= 0x2000 && c <= 0x200a) || c === 0x205f || c === 0x3000 || c === 0xfeff || c === 0x1680 || c === 11 || c === 12;
const isDigit = (c: number) => c >= 48 && c <= 57;

/**
 * Hand-written equivalent of IOS_HEADER_RE / ANDROID_HEADER_RE. Avoids regex
 * match arrays and substring allocations on the hottest path of the parser.
 * Returns false when the line is not a message header.
 */
export function scanHeader(line: string, ios: boolean, out: Header): boolean {
  const n = line.length;
  let i = 0;
  if (ios) {
    if (line.charCodeAt(0) !== 91 /* [ */) return false;
    i = 1;
  }
  // number helper
  let c = line.charCodeAt(i);
  if (!isDigit(c)) return false;
  let v = 0;
  let len = 0;
  while (i < n && isDigit((c = line.charCodeAt(i))) && len < 5) {
    v = v * 10 + (c - 48);
    i++;
    len++;
  }
  if (len > 4) return false;
  out.p1 = v;
  out.p1len = len;
  const sep = line.charCodeAt(i);
  if (sep !== 46 && sep !== 47 && sep !== 45) return false; // . / -
  i++;
  v = 0;
  len = 0;
  while (i < n && isDigit((c = line.charCodeAt(i))) && len < 3) {
    v = v * 10 + (c - 48);
    i++;
    len++;
  }
  if (len < 1 || len > 2) return false;
  out.p2 = v;
  if (line.charCodeAt(i) !== sep) return false;
  i++;
  v = 0;
  len = 0;
  while (i < n && isDigit((c = line.charCodeAt(i))) && len < 5) {
    v = v * 10 + (c - 48);
    i++;
    len++;
  }
  if (len < 1 || len > 4) return false;
  out.p3 = v;
  c = line.charCodeAt(i);
  if (c === 44 || c === 46) i++; // , or .
  while (i < n && isSpaceCode(line.charCodeAt(i))) i++;
  // hour
  v = 0;
  len = 0;
  while (i < n && isDigit((c = line.charCodeAt(i))) && len < 3) {
    v = v * 10 + (c - 48);
    i++;
    len++;
  }
  if (len < 1 || len > 2) return false;
  out.h = v;
  c = line.charCodeAt(i);
  if (c !== 58 && c !== 46) return false; // : or .
  i++;
  if (!isDigit(line.charCodeAt(i)) || !isDigit(line.charCodeAt(i + 1))) return false;
  out.mi = (line.charCodeAt(i) - 48) * 10 + (line.charCodeAt(i + 1) - 48);
  i += 2;
  out.s = 0;
  c = line.charCodeAt(i);
  if ((c === 58 || c === 46) && isDigit(line.charCodeAt(i + 1)) && isDigit(line.charCodeAt(i + 2))) {
    out.s = (line.charCodeAt(i + 1) - 48) * 10 + (line.charCodeAt(i + 2) - 48);
    i += 3;
  }
  // optional AM/PM: \s*([AaPp])\.?\s?[Mm]\.?
  out.ap = '';
  let j = i;
  while (j < n && isSpaceCode(line.charCodeAt(j))) j++;
  c = line.charCodeAt(j);
  if (c === 65 || c === 97 || c === 80 || c === 112) {
    let k = j + 1;
    if (line.charCodeAt(k) === 46) k++;
    if (isSpaceCode(line.charCodeAt(k))) k++;
    const mc = line.charCodeAt(k);
    if (mc === 77 || mc === 109) {
      k++;
      if (line.charCodeAt(k) === 46) k++;
      out.ap = c === 65 || c === 97 ? 'a' : 'p';
      i = k;
    }
  }
  if (ios) {
    if (line.charCodeAt(i) !== 93 /* ] */) return false;
    i++;
    if (i < n && isSpaceCode(line.charCodeAt(i))) i++;
    out.restStart = i;
    return true;
  }
  if (isSpaceCode(line.charCodeAt(i))) i++;
  c = line.charCodeAt(i);
  if (c !== 45 && c !== 0x2013 && c !== 0x2014) return false; // - – —
  i++;
  if (!isSpaceCode(line.charCodeAt(i))) return false;
  out.restStart = i + 1;
  return true;
}

const probe: Header = { p1: 0, p2: 0, p3: 0, p1len: 0, h: 0, mi: 0, s: 0, ap: '', restStart: 0 };

export function detectPlatform(lines: string[]): Platform {
  let ios = 0;
  let android = 0;
  let checked = 0;
  for (let i = 0; i < lines.length && checked < 600; i++) {
    const l = stripLeadingInvisible(lines[i]!);
    if (l.length < 10) continue;
    checked++;
    if (scanHeader(l, true, probe)) ios++;
    else if (scanHeader(l, false, probe)) android++;
    if (ios + android >= 60) break;
  }
  if (ios === 0 && android === 0) {
    // The first lines could be one giant multi-line message; look further.
    for (let i = 0; i < lines.length && i < 50000; i++) {
      const l = stripLeadingInvisible(lines[i]!);
      if (l.length < 10) continue;
      if (scanHeader(l, true, probe)) ios++;
      else if (scanHeader(l, false, probe)) android++;
      if (ios + android >= 5) break;
    }
  }
  if (ios === 0 && android === 0) throw new ChatParseError('UNRECOGNIZED_FORMAT', 'No message headers found');
  return ios >= android ? 'ios' : 'android';
}

function dayKey(p1: number, p2: number, p3: number, order: DateOrder): number {
  let y: number;
  let mo: number;
  let d: number;
  if (order === 'YMD') {
    y = p1; mo = p2; d = p3;
  } else if (order === 'DMY') {
    d = p1; mo = p2; y = p3;
  } else {
    mo = p1; d = p2; y = p3;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return -1;
  return y * 512 + mo * 32 + d;
}

function countBackwards(R: DateRecs, order: DateOrder): number {
  let bad = 0;
  let prev = -1;
  for (let r = 0; r < R.p1.length; r++) {
    const k = dayKey(R.p1[r]!, R.p2[r]!, R.p3[r]!, order);
    if (k < 0) {
      bad += 5;
      continue;
    }
    if (prev >= 0 && k < prev) bad++;
    prev = k;
  }
  return bad;
}

/** The date components of every header line. */
export interface DateRecs {
  p1: number[];
  p2: number[];
  p3: number[];
  p1len: number[];
}

export function detectDateOrder(recs: DateRecs, has12h: boolean): { order: DateOrder; ambiguous: boolean } {
  const n = recs.p1.length;
  if (n === 0) return { order: 'DMY', ambiguous: true };
  let ymd = 0;
  let max1 = 0;
  let max2 = 0;
  for (let r = 0; r < n; r++) {
    if (recs.p1len[r] === 4) ymd++;
    if (recs.p1[r]! > max1) max1 = recs.p1[r]!;
    if (recs.p2[r]! > max2) max2 = recs.p2[r]!;
  }
  if (ymd > n / 2) return { order: 'YMD', ambiguous: false };
  if (max1 > 12 && max2 <= 12) return { order: 'DMY', ambiguous: false };
  if (max2 > 12 && max1 <= 12) return { order: 'MDY', ambiguous: false };
  const dmy = countBackwards(recs, 'DMY');
  const mdy = countBackwards(recs, 'MDY');
  if (dmy !== mdy) return { order: dmy < mdy ? 'DMY' : 'MDY', ambiguous: max1 <= 12 && max2 <= 12 };
  return { order: has12h ? 'MDY' : 'DMY', ambiguous: true };
}

function toTimestamp(r: RawRecord, order: DateOrder): number {
  let y: number;
  let mo: number;
  let d: number;
  if (order === 'YMD') {
    y = r.p1; mo = r.p2; d = r.p3;
  } else if (order === 'DMY') {
    d = r.p1; mo = r.p2; y = r.p3;
  } else {
    mo = r.p1; d = r.p2; y = r.p3;
  }
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
  let h = r.h;
  if (r.ap) {
    if (h < 1 || h > 12) return NaN;
    if (r.ap === 'p' && h < 12) h += 12;
    else if (r.ap === 'a' && h === 12) h = 0;
  }
  if (h > 23 || r.mi > 59 || r.s > 59) return NaN;
  const t = Date.UTC(y, mo - 1, d, h, r.mi, r.s);
  // Reject roll-overs such as 31/02.
  if (new Date(t).getUTCDate() !== d) return NaN;
  return t;
}

const GROUP_KINDS = new Set(['created', 'added', 'removed', 'joined', 'left', 'subject', 'icon', 'description']);

export function parseChat(input: string, options: ParseOptions = {}): ParseResult {
  if (!input || !input.trim()) throw new ChatParseError('EMPTY', 'The file is empty');
  const onProgress = options.onProgress;
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const lines = (text.indexOf('\r') === -1 ? text : text.replace(/\r\n?/g, '\n')).split('\n');
  const platform = detectPlatform(lines);
  const isIos = platform === 'ios';
  const hdr: Header = { p1: 0, p2: 0, p3: 0, p1len: 0, h: 0, mi: 0, s: 0, ap: '', restStart: 0 };
  const fileHasLRM = text.indexOf('‎') !== -1;

  /* ---------- Pass 1: headers + continuation lines (parallel arrays, no per-line objects) ---------- */
  const R: Recs = { line: [], p1: [], p2: [], p3: [], p1len: [], h: [], mi: [], s: [], ap: [], rest: [], extra: [] };
  let has12h = false;
  let nonEmpty = 0;
  const n = lines.length;
  let cur = -1;
  for (let i = 0; i < n; i++) {
    const line = stripLeadingInvisible(lines[i]!);
    if (line.length > 0) nonEmpty++;
    if (line.length >= 12 && scanHeader(line, isIos, hdr)) {
      if (hdr.ap) has12h = true;
      R.line.push(i);
      R.p1.push(hdr.p1);
      R.p2.push(hdr.p2);
      R.p3.push(hdr.p3);
      R.p1len.push(hdr.p1len);
      R.h.push(hdr.h);
      R.mi.push(hdr.mi);
      R.s.push(hdr.s);
      R.ap.push(hdr.ap === 'a' ? 1 : hdr.ap === 'p' ? 2 : 0);
      R.rest.push(line.slice(hdr.restStart));
      R.extra.push(null);
      cur++;
    } else if (cur >= 0) {
      (R.extra[cur] ??= []).push(line);
    }
    if (onProgress && (i & 32767) === 0) onProgress((i / n) * 0.5);
  }
  const nRecs = R.line.length;
  if (nRecs === 0) throw new ChatParseError('UNRECOGNIZED_FORMAT', 'No message headers found');
  if (nonEmpty > 300 && nRecs / nonEmpty < 0.01) {
    throw new ChatParseError('UNRECOGNIZED_FORMAT', 'Too few message headers for a chat export');
  }

  /* ---------- Date order ---------- */
  const warnings: ParseWarning[] = [];
  let dateOrder: DateOrder;
  if (options.dateOrder && options.dateOrder !== 'auto') {
    dateOrder = options.dateOrder;
  } else {
    const d = detectDateOrder(R, has12h);
    dateOrder = d.order;
    if (d.ambiguous) warnings.push({ code: 'AMBIGUOUS_DATE_ORDER', detail: dateOrder });
  }

  /* ---------- Pass 2: timestamps, author split ---------- */
  const preTs: number[] = [];
  const preAuthor: (string | null)[] = [];
  const preBody: string[] = [];
  const preRec: number[] = [];
  let invalidDates = 0;
  const authorCount = new Map<string, number>();
  // Detect names that contain ": " (e.g. "Dr: Who"): all their messages share the same "X: " prefix.
  const authorPrefix = new Map<string, string | false>();
  const authorCache = new Map<string, string>();
  let cKey = -1;
  let cBase = NaN;
  const tmp: RawRecord = { line: 0, p1: 0, p2: 0, p3: 0, p1len: 0, h: 0, mi: 0, s: 0, ap: '', rest: '', extra: null };
  for (let r = 0; r < nRecs; r++) {
    // Consecutive messages usually share the date and hour: cache the expensive part.
    // Collision-free composite key (p3 ≤ 9999, p2 ≤ 99, p1 ≤ 9999, h ≤ 99, ap ≤ 2): < 2^53
    const key = (((R.p3[r]! * 100 + R.p2[r]!) * 10000 + R.p1[r]!) * 100 + R.h[r]!) * 3 + R.ap[r]!;
    if (key !== cKey) {
      cKey = key;
      tmp.p1 = R.p1[r]!;
      tmp.p2 = R.p2[r]!;
      tmp.p3 = R.p3[r]!;
      tmp.h = R.h[r]!;
      tmp.ap = R.ap[r] === 1 ? 'a' : R.ap[r] === 2 ? 'p' : '';
      cBase = toTimestamp(tmp, dateOrder);
    }
    const mi = R.mi[r]!;
    const sec = R.s[r]!;
    const ts = Number.isNaN(cBase) || mi > 59 || sec > 59 ? NaN : cBase + mi * 60_000 + sec * 1000;
    const extra = R.extra[r];
    if (Number.isNaN(ts)) {
      // Not a real header (e.g. a pasted date inside a message): treat as continuation.
      invalidDates++;
      const last = preBody.length - 1;
      if (last >= 0) {
        preBody[last] += `\n${stripLeadingInvisible(lines[R.line[r]!]!)}`;
        if (extra) preBody[last] += `\n${extra.join('\n')}`;
      }
      continue;
    }
    const rest = R.rest[r]!;
    let rawAuthor: string | null = null;
    let firstBody: string;
    const idx = rest.indexOf(': ');
    if (idx > 0) {
      rawAuthor = rest.slice(0, idx);
      firstBody = rest.slice(idx + 2);
    } else if (rest.length > 1 && rest.length < 80 && rest.endsWith(':')) {
      rawAuthor = rest.slice(0, -1);
      firstBody = '';
    } else {
      firstBody = rest;
    }
    let author: string | null = null;
    if (rawAuthor !== null) {
      author = authorCache.get(rawAuthor) ?? null;
      if (author === null) {
        author = cleanAuthor(rawAuthor);
        authorCache.set(rawAuthor, author);
      }
      if (!author) author = null;
    }
    if (author) {
      authorCount.set(author, (authorCount.get(author) ?? 0) + 1);
      const known = authorPrefix.get(author);
      if (known !== false) {
        const pm = firstBody.indexOf(': ') !== -1 ? COLON_PREFIX_RE.exec(stripLeadingInvisible(firstBody)) : null;
        const pfx = pm ? pm[1]! : false;
        if (known === undefined) authorPrefix.set(author, pfx);
        else if (known !== pfx) authorPrefix.set(author, false);
      }
    }
    preTs.push(ts);
    preAuthor.push(author);
    preBody.push(extra ? `${firstBody}\n${extra.join('\n')}` : firstBody);
    preRec.push(r);
  }
  if (invalidDates > nRecs * 0.5) warnings.push({ code: 'UNPARSEABLE_DATES', detail: String(invalidDates) });
  if (preTs.length === 0) throw new ChatParseError('UNRECOGNIZED_FORMAT', 'No valid dates found');

  const colonAuthors = new Map<string, string>();
  for (const [a, pfx] of authorPrefix) {
    if (pfx !== false && (authorCount.get(a) ?? 0) >= 2) colonAuthors.set(a, pfx);
  }
  if (colonAuthors.size > 0) warnings.push({ code: 'MERGED_COLON_AUTHOR', detail: [...colonAuthors.keys()].join(', ') });

  const knownAuthors = new Set<string>();
  for (const [a, c] of authorCount) if (c >= 2) knownAuthors.add(colonAuthors.has(a) ? `${a}: ${colonAuthors.get(a)}` : a);
  for (const sl of SELF_LABELS) knownAuthors.add(sl);

  /* ---------- Pass 3: classification ---------- */
  const messages: Message[] = [];
  const systemAuthors = new Map<string, number>();
  const total = preTs.length;
  const isAndroid = platform === 'android';
  for (let i = 0; i < total; i++) {
    const ts = preTs[i]!;
    const rawAuthor = preAuthor[i]!;
    let author = rawAuthor;
    let body = preBody[i]!;
    if (author && colonAuthors.size > 0 && colonAuthors.has(author)) {
      const prefix = colonAuthors.get(author)!;
      author = `${author}: ${prefix}`;
      body = stripLeadingInvisible(body).slice(prefix.length + 2);
    }

    let sys: SystemMatch | null = null;
    if (author === null) {
      sys = matchSystem(cleanText(body)) ?? { kind: 'other' };
    } else if (isAndroid && (author.length > 50 || QUOTE_RE.test(author)) && (authorCount.get(rawAuthor!) ?? 0) < 3) {
      const r = preRec[i]!;
      const ex = R.extra[r];
      const full = ex ? `${R.rest[r]!}\n${ex.join('\n')}` : R.rest[r]!;
      const sm = matchSystem(cleanText(full));
      if (sm) {
        sys = sm;
        body = full;
      }
    }

    if (sys) {
      messages.push(systemMessage(ts, cleanText(body).trim(), sys));
      continue;
    }

    const startsWithLRM = body.charCodeAt(0) === 0x200e;
    const cleaned = cleanText(body);
    const se = stripEdited(cleaned);
    const unedited = se.text;
    const cls = classifyContent(unedited);

    if (!cls && !isAndroid && (startsWithLRM || !fileHasLRM) && unedited.length < 300 && unedited.indexOf('\n') === -1) {
      const sm = matchSystem(unedited);
      if (sm && (startsWithLRM || plausibleSystem(sm, knownAuthors))) {
        systemAuthors.set(author!, (systemAuthors.get(author!) ?? 0) + 1);
        messages.push(systemMessage(ts, unedited.trim(), sm));
        continue;
      }
    }

    if (cls) {
      if (cls.type === 'system') {
        messages.push({
          id: 0,
          timestamp: ts,
          author: null,
          text: '',
          type: 'system',
          edited: false,
          links: EMPTY,
          emojis: EMPTY,
          mentions: EMPTY,
          meta: { ...cls.meta, actor: author ?? undefined },
        });
        continue;
      }
      const type = cls.type;
      const msgText = type === 'deleted' || type === 'call' ? '' : cls.text.trim();
      const hasContent = msgText.length > 0;
      messages.push({
        id: 0,
        timestamp: ts,
        author,
        text: msgText,
        type,
        edited: se.edited,
        links: hasContent && type !== 'location' ? orEmpty(extractLinks(msgText)) : EMPTY,
        emojis: hasContent ? orEmpty(extractEmojis(msgText)) : EMPTY,
        mentions: hasContent ? orEmpty(extractMentions(body)) : EMPTY,
        meta: cls.meta,
      });
    } else {
      const msgText = unedited.trim();
      const hasContent = msgText.length > 0;
      messages.push({
        id: 0,
        timestamp: ts,
        author,
        text: msgText,
        type: 'text',
        edited: se.edited,
        links: hasContent ? orEmpty(extractLinks(msgText)) : EMPTY,
        emojis: hasContent ? orEmpty(extractEmojis(msgText)) : EMPTY,
        mentions: hasContent ? orEmpty(extractMentions(body)) : EMPTY,
        meta: undefined,
      });
    }
    if (onProgress && (i & 16383) === 0) onProgress(0.5 + (i / total) * 0.5);
  }

  /* ---------- Ordering ---------- */
  let inversions = 0;
  for (let i = 1; i < messages.length; i++) if (messages[i]!.timestamp < messages[i - 1]!.timestamp) inversions++;
  if (inversions > 0) {
    messages.sort((a, b) => a.timestamp - b.timestamp); // stable
    if (inversions > messages.length * 0.005) warnings.push({ code: 'UNSORTED', detail: String(inversions) });
  }
  for (let i = 0; i < messages.length; i++) messages[i]!.id = i;

  /* ---------- Participants, group detection, title ---------- */
  const counts = new Map<string, number>();
  let groupEvents = 0;
  let title: string | null = null;
  for (const m of messages) {
    if (m.type === 'system') {
      const k = m.meta?.systemKind;
      if (k && GROUP_KINDS.has(k)) groupEvents++;
      if ((k === 'created' || k === 'subject') && m.meta?.subject) title = m.meta.subject;
      continue;
    }
    if (m.author) counts.set(m.author, (counts.get(m.author) ?? 0) + 1);
  }
  const participants = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([a]) => a);
  if (participants.length === 0) throw new ChatParseError('NO_MESSAGES', 'The chat contains no messages');
  if (!title && systemAuthors.size > 0) {
    const nonParticipant = [...systemAuthors.entries()].filter(([a]) => !counts.has(a)).sort((a, b) => b[1] - a[1]);
    if (nonParticipant[0]) title = nonParticipant[0][0];
  }
  const selfAuthor = participants.find((p) => SELF_LABELS.has(p)) ?? null;

  onProgress?.(1);
  return {
    messages,
    participants,
    platform,
    dateOrder,
    timeFormat: has12h ? '12h' : '24h',
    isGroup: participants.length > 2 || groupEvents > 0,
    chatTitle: title,
    selfAuthor,
    warnings,
    lineCount: n,
  };
}

function plausibleSystem(s: SystemMatch, known: Set<string>): boolean {
  if (s.kind === 'encryption' || s.kind === 'created' || s.kind === 'security' || s.kind === 'disappearing') return true;
  if (s.actor && known.has(s.actor)) return true;
  if (s.targets && s.targets.length > 0 && s.targets.every((t) => known.has(t))) return true;
  return false;
}

function systemMessage(ts: number, text: string, s: SystemMatch): Message {
  const meta: MessageMeta = { systemKind: s.kind };
  if (s.actor) meta.actor = s.actor;
  if (s.targets) meta.targets = s.targets;
  if (s.subject) meta.subject = s.subject;
  return {
    id: 0,
    timestamp: ts,
    author: null,
    text,
    type: 'system',
    edited: false,
    links: [],
    emojis: [],
    mentions: [],
    meta,
  };
}
