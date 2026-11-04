/**
 * Main-thread handle to the analysis worker. The worker is bundled inline
 * (blob: URL) so it is covered by the page CSP.
 */
import * as Comlink from 'comlink';
import AnalysisWorker from './analysis.worker.ts?worker&inline';
import type { EngineApi, ProgressFn } from './protocol';

let remote: Comlink.Remote<EngineApi> | null = null;

export function engine(): Comlink.Remote<EngineApi> {
  if (!remote) remote = Comlink.wrap<EngineApi>(new AnalysisWorker());
  return remote;
}

export function progressProxy(fn: ProgressFn): ProgressFn {
  return Comlink.proxy(fn);
}

export type { ChatSummary, Progress, LoadOutcome, ProgressPhase } from './protocol';
