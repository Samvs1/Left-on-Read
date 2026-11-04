import type { DateOrder, ParseErrorCode, ParseWarning, Platform } from '../parser/types';
import type { ChatStats, Settings, WordSearchResult } from '../engine/types';

export interface ChatSummary {
  chatId: string;
  title: string | null;
  people: string[];
  isGroup: boolean;
  platform: Platform;
  /** All parsed lines, including system messages. */
  messages: number;
  /** Messages written by people (no system notices). */
  personMessages: number;
  firstTs: number;
  lastTs: number;
  dateOrder: DateOrder;
  warnings: ParseWarning[];
  sourceName: string;
  isDemo: boolean;
  parseMs: number;
}

export type ProgressPhase = 'reading' | 'parsing' | 'preparing' | 'computing';
export interface Progress {
  phase: ProgressPhase;
  fraction: number;
}
export type ProgressFn = (p: Progress) => void;

export type LoadOutcome =
  | { ok: true; summary: ChatSummary }
  | { ok: false; error: { code: ParseErrorCode | 'UNKNOWN'; message: string } };

export interface LoadOptions {
  dateOrder?: DateOrder | 'auto';
}

export interface EngineApi {
  loadFile(file: Blob, name: string, onProgress?: ProgressFn, opts?: LoadOptions): Promise<LoadOutcome>;
  loadText(text: string, name: string, onProgress?: ProgressFn, opts?: LoadOptions): Promise<LoadOutcome>;
  loadDemo(kind: 'duo' | 'group', onProgress?: ProgressFn, targetMessages?: number): Promise<LoadOutcome>;
  /** Re-parses a loaded chat with a different date order. */
  reparse(chatId: string, dateOrder: DateOrder | 'auto', onProgress?: ProgressFn): Promise<LoadOutcome>;
  compute(chatId: string, settings: Partial<Settings>): Promise<ChatStats>;
  search(chatId: string, settings: Partial<Settings>, query: string): Promise<WordSearchResult>;
  release(chatId: string): Promise<void>;
}
