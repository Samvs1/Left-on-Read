/**
 * Global app state (tiny external store + selector hook) and the actions that
 * talk to the analysis worker. The worker client is imported lazily so the
 * landing page stays light.
 */
import { useSyncExternalStore } from 'react';
import type { ChatStats, Settings, WordSearchResult } from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/settings';
import type { DateOrder } from '../parser/types';
import type { ChatSummary, LoadOutcome, Progress } from '../worker/protocol';
import { go } from './router';

export interface ChatSlot {
  summary: ChatSummary;
  stats: ChatStats | null;
  computing: boolean;
}

export interface AppState {
  chat: ChatSlot | null;
  compare: ChatSlot | null;
  settings: Settings;
  dateOrder: DateOrder | 'auto';
  anonymize: boolean;
  loading: boolean;
  compareLoading: boolean;
  progress: Progress | null;
  error: { code: string; message: string } | null;
  settingsOpen: boolean;
  pasteOpen: boolean;
  /** Chat id the story was last played for. */
  storyFor: string | null;
}

function initialAnon(): boolean {
  try {
    return localStorage.getItem('lor.anon') === '1';
  } catch {
    return false;
  }
}

let state: AppState = {
  chat: null,
  compare: null,
  settings: DEFAULT_SETTINGS,
  dateOrder: 'auto',
  anonymize: false,
  loading: false,
  compareLoading: false,
  progress: null,
  error: null,
  settingsOpen: false,
  pasteOpen: false,
  storyFor: null,
};
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function initStore() {
  state = { ...state, anonymize: initialAnon() };
}

/* ------------------------------------------------------------------ */
/* Lazy modules                                                         */
/* ------------------------------------------------------------------ */

type ClientMod = typeof import('../worker/client');
let clientPromise: Promise<ClientMod> | null = null;
function client(): Promise<ClientMod> {
  clientPromise ??= import('../worker/client');
  return clientPromise;
}

/**
 * Loads every code chunk the analysis flow needs. Called on first
 * interaction and always awaited *before* any chat data is read, so no
 * network request can happen after your data is in memory.
 */
let warm: Promise<unknown> | null = null;
export function warmup(): Promise<unknown> {
  warm ??= Promise.all([
    client().then((c) => c.engine()),
    import('./pages/StoryPage'),
    import('./pages/DashboardPage'),
    import('./pages/PersonPage'),
    import('./pages/ComparePage'),
    import('./wrapped/WrappedPage'),
    import('./wrapped/encode'),
    import('./wrapped/fonts').then((m) => m.loadWrappedFonts()),
    import('./lib/echarts').then((m) => m.loadECharts()),
    import('./lib/share'),
  ]);
  return warm;
}

/* ------------------------------------------------------------------ */
/* Actions                                                              */
/* ------------------------------------------------------------------ */

async function finishLoad(outcome: LoadOutcome, target: 'chat' | 'compare') {
  if (!outcome.ok) {
    setState({ loading: false, compareLoading: false, progress: null, error: outcome.error });
    return;
  }
  const slot: ChatSlot = { summary: outcome.summary, stats: null, computing: true };
  if (target === 'chat') {
    const old = state.chat;
    if (old && old.summary.chatId !== slot.summary.chatId) void client().then((c) => c.engine().release(old.summary.chatId));
    setState({ chat: slot, error: null, settings: { ...state.settings, dateStart: null, dateEnd: null } });
    // First screen right away: the story intro only needs the parse summary.
    setState({ loading: false, progress: null, storyFor: slot.summary.chatId });
    go('story');
  } else {
    setState({ compare: slot, compareLoading: false, error: null });
  }
  await recompute(target);
}

function onProgress(p: Progress) {
  setState({ progress: p });
}

export async function loadFile(file: Blob, name: string) {
  setState({ loading: true, error: null, progress: { phase: 'reading', fraction: 0 } });
  await warmup();
  const c = await client();
  const outcome = await c.engine().loadFile(file, name, c.progressProxy(onProgress), { dateOrder: state.dateOrder });
  await finishLoad(outcome, 'chat');
}

export async function loadText(text: string) {
  setState({ loading: true, error: null, pasteOpen: false, progress: { phase: 'parsing', fraction: 0 } });
  await warmup();
  const c = await client();
  const outcome = await c.engine().loadText(text, 'pasted.txt', c.progressProxy(onProgress), { dateOrder: state.dateOrder });
  await finishLoad(outcome, 'chat');
}

export async function loadDemo(kind: 'duo' | 'group', targetMessages?: number) {
  setState({ loading: true, error: null, progress: { phase: 'reading', fraction: 0 } });
  await warmup();
  const c = await client();
  const outcome = await c.engine().loadDemo(kind, c.progressProxy(onProgress), targetMessages);
  await finishLoad(outcome, 'chat');
}

export async function loadCompareFile(file: Blob, name: string) {
  setState({ compareLoading: true, error: null });
  await warmup();
  const c = await client();
  await finishLoad(await c.engine().loadFile(file, name, undefined, { dateOrder: 'auto' }), 'compare');
}

export async function loadCompareDemo(kind: 'duo' | 'group') {
  setState({ compareLoading: true, error: null });
  await warmup();
  const c = await client();
  await finishLoad(await c.engine().loadDemo(kind), 'compare');
}

export function clearCompare() {
  const cmp = state.compare;
  if (cmp) void client().then((c) => c.engine().release(cmp.summary.chatId));
  setState({ compare: null });
}

const versions = { chat: 0, compare: 0 };
export async function recompute(which: 'chat' | 'compare' | 'both' = 'both') {
  const c = await client();
  const targets: ('chat' | 'compare')[] = which === 'both' ? ['chat', 'compare'] : [which];
  await Promise.all(
    targets.map(async (k) => {
      const slot = state[k];
      if (!slot) return;
      const my = ++versions[k];
      setState({ [k]: { ...slot, computing: true } } as Partial<AppState>);
      try {
        // The compare chat ignores the date filter (different time spans).
        const settings = k === 'compare' ? { ...state.settings, dateStart: null, dateEnd: null } : state.settings;
        const stats = await c.engine().compute(slot.summary.chatId, settings);
        const cur = state[k];
        // Drop stale results (a newer recompute is in flight, or the chat changed).
        if (!cur || cur.summary.chatId !== slot.summary.chatId || versions[k] !== my) return;
        setState({ [k]: { ...cur, stats, computing: false } } as Partial<AppState>);
      } catch (e) {
        const cur = state[k];
        if (cur) setState({ [k]: { ...cur, computing: false } } as Partial<AppState>);
        console.error(e);
      }
    }),
  );
}

let settingsTimer: ReturnType<typeof setTimeout> | null = null;
export function updateSettings(patch: Partial<Settings>) {
  setState({ settings: { ...state.settings, ...patch } });
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => void recompute('both'), 140);
}

export function resetSettings() {
  setState({ settings: { ...DEFAULT_SETTINGS } });
  void recompute('both');
}

export async function setDateOrder(order: DateOrder | 'auto') {
  setState({ dateOrder: order });
  const chat = state.chat;
  if (!chat) return;
  const c = await client();
  const outcome = await c.engine().reparse(chat.summary.chatId, order);
  if (outcome.ok) {
    setState({ chat: { summary: outcome.summary, stats: chat.stats, computing: true } });
    await recompute('chat');
  }
}

export function setAnonymize(on: boolean) {
  setState({ anonymize: on });
  try {
    localStorage.setItem('lor.anon', on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export async function searchWord(query: string): Promise<WordSearchResult | null> {
  const chat = state.chat;
  if (!chat) return null;
  const c = await client();
  return c.engine().search(chat.summary.chatId, state.settings, query);
}

export function closeChat() {
  const chat = state.chat;
  if (chat) void client().then((c) => c.engine().release(chat.summary.chatId));
  clearCompare();
  setState({ chat: null, error: null, storyFor: null });
  go('home');
}
