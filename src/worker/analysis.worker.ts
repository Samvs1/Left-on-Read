/**
 * Runs the parser and the stats engine off the main thread. Loaded as an
 * inline (blob:) worker so it inherits the page's Content-Security-Policy:
 * `connect-src 'none'` applies here too, so nothing can be sent anywhere.
 */
import * as Comlink from 'comlink';
import { ChatParseError, parseChat, readChatFile, type DateOrder, type ParseResult } from '../parser';
import { computeStats, prepare, search, type Prepared } from '../engine';
import { generateDemoChat } from '../demo/generator';
import type { ChatSummary, EngineApi, LoadOptions, LoadOutcome, ProgressFn } from './protocol';

interface Entry {
  text: string;
  sourceName: string;
  titleHint: string | null;
  isDemo: boolean;
  ready: Promise<Prepared>;
}

const chats = new Map<string, Entry>();
let counter = 0;

function fail(e: unknown): LoadOutcome {
  if (e instanceof ChatParseError) return { ok: false, error: { code: e.code, message: e.message } };
  return { ok: false, error: { code: 'UNKNOWN', message: e instanceof Error ? e.message : String(e) } };
}

function summarize(chatId: string, parsed: ParseResult, entry: Pick<Entry, 'sourceName' | 'titleHint' | 'isDemo'>, parseMs: number): ChatSummary {
  let first = 0;
  let last = 0;
  let personMessages = 0;
  for (const m of parsed.messages) {
    if (m.type === 'system') continue;
    if (!first) first = m.timestamp;
    last = m.timestamp;
    personMessages++;
  }
  return {
    chatId,
    title: parsed.chatTitle ?? entry.titleHint,
    people: parsed.participants,
    isGroup: parsed.isGroup,
    platform: parsed.platform,
    messages: parsed.messages.length,
    personMessages,
    firstTs: first,
    lastTs: last,
    dateOrder: parsed.dateOrder,
    warnings: parsed.warnings,
    sourceName: entry.sourceName,
    isDemo: entry.isDemo,
    parseMs,
  };
}

function ingest(
  text: string,
  meta: { sourceName: string; titleHint: string | null; isDemo: boolean },
  onProgress: ProgressFn | undefined,
  dateOrder: DateOrder | 'auto' | undefined,
  reuseId?: string,
): LoadOutcome {
  const t0 = performance.now();
  let parsed: ParseResult;
  try {
    parsed = parseChat(text, { dateOrder: dateOrder ?? 'auto', onProgress: (f) => onProgress?.({ phase: 'parsing', fraction: f }) });
  } catch (e) {
    return fail(e);
  }
  const parseMs = performance.now() - t0;
  const chatId = reuseId ?? `chat-${++counter}`;
  // Feature preparation is queued right after we answer, so the UI can already
  // show the first screen while the heavy lifting continues here.
  const ready = new Promise<Prepared>((resolve, reject) => {
    setTimeout(() => {
      try {
        const P = prepare(parsed, { titleHint: meta.titleHint, onProgress: (f) => onProgress?.({ phase: 'preparing', fraction: f }) });
        resolve(P);
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
  ready.catch(() => undefined);
  chats.set(chatId, { text, ...meta, ready });
  return { ok: true, summary: summarize(chatId, parsed, meta, parseMs) };
}

async function getPrepared(chatId: string): Promise<Prepared> {
  const entry = chats.get(chatId);
  if (!entry) throw new Error(`Unknown chat ${chatId}`);
  return entry.ready;
}

const api: EngineApi = {
  async loadFile(file, name, onProgress, opts?: LoadOptions) {
    try {
      onProgress?.({ phase: 'reading', fraction: 0 });
      const f = await readChatFile(file, name);
      onProgress?.({ phase: 'reading', fraction: 1 });
      return ingest(f.text, { sourceName: f.sourceName, titleHint: f.titleHint, isDemo: false }, onProgress, opts?.dateOrder);
    } catch (e) {
      return fail(e);
    }
  },
  async loadText(text, name, onProgress, opts?: LoadOptions) {
    return ingest(text, { sourceName: name, titleHint: null, isDemo: false }, onProgress, opts?.dateOrder);
  },
  async loadDemo(kind, onProgress, targetMessages) {
    onProgress?.({ phase: 'reading', fraction: 0.5 });
    const demo = generateDemoChat({ kind, targetMessages });
    return ingest(demo.text, { sourceName: demo.fileName, titleHint: demo.title, isDemo: true }, onProgress, 'auto');
  },
  async reparse(chatId, dateOrder, onProgress) {
    const entry = chats.get(chatId);
    if (!entry) return { ok: false, error: { code: 'UNKNOWN', message: 'Unknown chat' } };
    return ingest(entry.text, entry, onProgress, dateOrder, chatId);
  },
  async compute(chatId, settings) {
    const P = await getPrepared(chatId);
    return computeStats(P, settings);
  },
  async search(chatId, settings, query) {
    const P = await getPrepared(chatId);
    return search(P, settings, query);
  },
  async release(chatId) {
    chats.delete(chatId);
  },
};

Comlink.expose(api);
