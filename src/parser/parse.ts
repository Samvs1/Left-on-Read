import {
  ChatParseError,
  type DateOrder,
  type Message,
  type MessageMeta,
  type MessageType,
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

interface PreMessage {
  ts: number;
  author: string | null;
  body: string;
  rest: string;
}

const QUOTE_RE = /["“”„«»]/;
const COLON_PREFIX_RE = /^([^:\n]{1,30}): /;

export function detectPlatform(lines: string[]): Platform {
  let ios = 0;
  let android = 0;
  let checked = 0;
  for (let i = 0; i < lines.length && checked < 600; i++) {
    const l = stripLeadingInvisible(lines[i]!);
    if (l.length < 10) continue;
    checked++;
    if (IOS_HEADER_RE.test(l)) ios++;
    else if (ANDROID_HEADER_RE.test(l)) android++;
    if (ios + android >= 60) break;
  }
  if (ios === 0 && android === 0) {
    // The first lines could be one giant multi-line message; look further.
    for (let i = 0; i < lines.length && i < 50000; i++) {
      const l = stripLeadingInvisible(lines[i]!);
      if (l.length < 10) continue;
      if (IOS_HEADER_RE.test(l)) ios++;
      else if (ANDROID_HEADER_RE.test(l)) android++;
      if (ios + android >= 5) break;
    }
  }
  if (ios === 0 && android === 0) throw new ChatParseError('UNRECOGNIZED_FORMAT', 'No message headers found');
  return ios >= android ? 'ios' : 'android';
}

function dayKey(r: RawRecord, order: DateOrder): number {
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
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return -1;
  return y * 512 + mo * 32 + d;
}

function countBackwards(recs: RawRecord[], order: DateOrder): number {
  let bad = 0;
  let prev = -1;
  for (const r of recs) {
    const k = dayKey(r, order);
    if (k < 0) {
      bad += 5;
      continue;
    }
    if (prev >= 0 && k < prev) bad++;
    prev = k;
  }
  return bad;
}

export function detectDateOrder(recs: RawRecord[], has12h: boolean): { order: DateOrder; ambiguous: boolean } {
  if (recs.length === 0) return { order: 'DMY', ambiguous: true };
  let ymd = 0;
  let max1 = 0;
  let max2 = 0;
  for (const r of recs) {
    if (r.p1len === 4) ymd++;
    if (r.p1 > max1) max1 = r.p1;
    if (r.p2 > max2) max2 = r.p2;
  }
  if (ymd > recs.length / 2) return { order: 'YMD', ambiguous: false };
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

function splitAuthor(rest: string): { author: string | null; body: string } {
  const idx = rest.indexOf(': ');
  if (idx > 0) return { author: rest.slice(0, idx), body: rest.slice(idx + 2) };
  if (rest.length > 1 && rest.endsWith(':') && rest.length < 80) return { author: rest.slice(0, -1), body: '' };
  return { author: null, body: rest };
}

const GROUP_KINDS = new Set(['created', 'added', 'removed', 'joined', 'left', 'subject', 'icon', 'description']);

export function parseChat(input: string, options: ParseOptions = {}): ParseResult {
  if (!input || !input.trim()) throw new ChatParseError('EMPTY', 'The file is empty');
  const onProgress = options.onProgress;
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const lines = text.split(/\r\n|\n|\r/);
  const platform = detectPlatform(lines);
  const re = platform === 'ios' ? IOS_HEADER_RE : ANDROID_HEADER_RE;
  const fileHasLRM = text.indexOf('‎') !== -1;

  /* ---------- Pass 1: headers + continuation lines ---------- */
  const recs: RawRecord[] = [];
  let cur: RawRecord | null = null;
  let has12h = false;
  let nonEmpty = 0;
  const n = lines.length;
  for (let i = 0; i < n; i++) {
    const line = stripLeadingInvisible(lines[i]!);
    if (line.length > 0) nonEmpty++;
    const c0 = line.charCodeAt(0);
    const m = line.length >= 12 && ((c0 >= 48 && c0 <= 57) || c0 === 91) ? re.exec(line) : null;
    if (m) {
      const ap = m[8] ? (m[8].toLowerCase() as 'a' | 'p') : '';
      if (ap) has12h = true;
      cur = {
        line: i,
        p1: +m[1]!,
        p2: +m[3]!,
        p3: +m[4]!,
        p1len: m[1]!.length,
        h: +m[5]!,
        mi: +m[6]!,
        s: m[7] ? +m[7] : 0,
        ap,
        rest: m[9]!,
        extra: null,
      };
      recs.push(cur);
    } else if (cur) {
      (cur.extra ??= []).push(line);
    }
    if (onProgress && (i & 32767) === 0) onProgress((i / n) * 0.5);
  }
  if (recs.length === 0) throw new ChatParseError('UNRECOGNIZED_FORMAT', 'No message headers found');
  if (nonEmpty > 300 && recs.length / nonEmpty < 0.01) {
    throw new ChatParseError('UNRECOGNIZED_FORMAT', 'Too few message headers for a chat export');
  }

  /* ---------- Date order ---------- */
  const warnings: ParseWarning[] = [];
  let dateOrder: DateOrder;
  if (options.dateOrder && options.dateOrder !== 'auto') {
    dateOrder = options.dateOrder;
  } else {
    const d = detectDateOrder(recs, has12h);
    dateOrder = d.order;
    if (d.ambiguous) warnings.push({ code: 'AMBIGUOUS_DATE_ORDER', detail: dateOrder });
  }

  /* ---------- Pass 2: timestamps, author split ---------- */
  const pre: PreMessage[] = [];
  let invalidDates = 0;
  const authorCount = new Map<string, number>();
  // Detect names that contain ": " (e.g. "Dr: Who"): all their messages share the same "X: " prefix.
  const authorPrefix = new Map<string, string | false>();
  for (const r of recs) {
    const ts = toTimestamp(r, dateOrder);
    if (Number.isNaN(ts)) {
      // Not a real header (e.g. a pasted date inside a message): treat as continuation.
      invalidDates++;
      const prev = pre[pre.length - 1];
      if (prev) {
        prev.body += `\n${stripLeadingInvisible(lines[r.line]!)}`;
        if (r.extra) prev.body += `\n${r.extra.join('\n')}`;
      }
      continue;
    }
    const { author: rawAuthor, body: firstBody } = splitAuthor(r.rest);
    const body = r.extra ? `${firstBody}\n${r.extra.join('\n')}` : firstBody;
    const author = rawAuthor === null ? null : cleanAuthor(rawAuthor);
    if (author) {
      authorCount.set(author, (authorCount.get(author) ?? 0) + 1);
      const pm = COLON_PREFIX_RE.exec(stripLeadingInvisible(firstBody));
      const p = pm ? pm[1]! : false;
      const known = authorPrefix.get(author);
      if (known === undefined) authorPrefix.set(author, p);
      else if (known !== p) authorPrefix.set(author, false);
    }
    pre.push({ ts, author: author || null, body, rest: r.extra ? `${r.rest}\n${r.extra.join('\n')}` : r.rest });
  }
  if (invalidDates > recs.length * 0.5) warnings.push({ code: 'UNPARSEABLE_DATES', detail: String(invalidDates) });
  if (pre.length === 0) throw new ChatParseError('UNRECOGNIZED_FORMAT', 'No valid dates found');

  const colonAuthors = new Map<string, string>();
  for (const [a, p] of authorPrefix) {
    if (p !== false && (authorCount.get(a) ?? 0) >= 2) colonAuthors.set(a, p);
  }
  if (colonAuthors.size > 0) warnings.push({ code: 'MERGED_COLON_AUTHOR', detail: [...colonAuthors.keys()].join(', ') });

  const knownAuthors = new Set<string>();
  for (const [a, c] of authorCount) if (c >= 2) knownAuthors.add(colonAuthors.has(a) ? `${a}: ${colonAuthors.get(a)}` : a);
  for (const s of SELF_LABELS) knownAuthors.add(s);

  /* ---------- Pass 3: classification ---------- */
  const messages: Message[] = [];
  const systemAuthors = new Map<string, number>();
  const total = pre.length;
  for (let i = 0; i < total; i++) {
    const p = pre[i]!;
    let author = p.author;
    let body = p.body;
    if (author && colonAuthors.has(author)) {
      const prefix = colonAuthors.get(author)!;
      author = `${author}: ${prefix}`;
      const b = stripLeadingInvisible(body);
      body = b.slice(prefix.length + 2);
    }

    let sys: SystemMatch | null = null;
    if (author === null) {
      sys = matchSystem(cleanText(body)) ?? { kind: 'other' };
    } else if (
      platform === 'android' &&
      (authorCount.get(p.author!) ?? 0) < 3 &&
      (QUOTE_RE.test(author) || author.length > 50)
    ) {
      const s = matchSystem(cleanText(p.rest));
      if (s) {
        sys = s;
        body = p.rest;
      }
    }

    if (sys) {
      messages.push(systemMessage(p.ts, cleanText(body).trim(), sys));
      continue;
    }

    const startsWithLRM = body.charCodeAt(0) === 0x200e;
    const cleaned = cleanText(body);
    const { text: unedited, edited } = stripEdited(cleaned);
    const cls = classifyContent(unedited);

    if (!cls && platform === 'ios' && unedited.length < 300 && unedited.indexOf('\n') === -1 && (startsWithLRM || !fileHasLRM)) {
      const s = matchSystem(unedited);
      if (s && (startsWithLRM || plausibleSystem(s, knownAuthors))) {
        systemAuthors.set(author!, (systemAuthors.get(author!) ?? 0) + 1);
        messages.push(systemMessage(p.ts, unedited.trim(), s));
        continue;
      }
    }

    let type: MessageType = 'text';
    let msgText = unedited;
    let meta: MessageMeta | undefined;
    if (cls) {
      type = cls.type;
      msgText = cls.text;
      meta = cls.meta;
      if (type === 'system') {
        messages.push({
          id: 0,
          timestamp: p.ts,
          author: null,
          text: '',
          type: 'system',
          edited: false,
          links: [],
          emojis: [],
          mentions: [],
          meta: { ...meta, actor: author ?? undefined },
        });
        continue;
      }
    }
    msgText = msgText.trim();
    const hasContent = msgText.length > 0 && type !== 'deleted' && type !== 'call';
    messages.push({
      id: 0,
      timestamp: p.ts,
      author,
      text: type === 'deleted' || type === 'call' ? '' : msgText,
      type,
      edited,
      links: hasContent && type !== 'location' ? extractLinks(msgText) : [],
      emojis: hasContent ? extractEmojis(msgText) : [],
      mentions: hasContent ? extractMentions(body) : [],
      ...(meta ? { meta } : {}),
    });
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
