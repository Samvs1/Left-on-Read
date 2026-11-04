/**
 * The Wrapped soundtrack as an AudioBuffer. The samples are synthesised in a
 * worker (see synth.ts); this module only hands the timeline over and wraps
 * the result. Nothing is downloaded: there are no audio files at all.
 */
import SynthWorker from './audio.worker.ts?worker&inline';
import { renderSoundtrackPCM, type Rendered } from './synth';
import type { Timeline } from './timeline';

interface Reply {
  id: number;
  left?: Float32Array;
  right?: Float32Array;
  sampleRate?: number;
  error?: string;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: Rendered) => void; reject: (e: Error) => void }>();

function synthWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new SynthWorker();
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error || !e.data.left || !e.data.right) p.reject(new Error(e.data.error ?? 'synth failed'));
      else p.resolve({ left: e.data.left, right: e.data.right, sampleRate: e.data.sampleRate ?? 48_000 });
    };
    worker.onerror = () => {
      pending.forEach((p) => p.reject(new Error('synth worker failed')));
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

function synthesise(tl: Timeline): Promise<Rendered> {
  const scenes = tl.scenes.map((s) => ({ id: s.id, bars: s.bars }));
  const w = synthWorker();
  if (!w) return Promise.resolve(renderSoundtrackPCM(scenes, tl.duration));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, scenes, duration: tl.duration });
  });
}

const cache = new WeakMap<Timeline, Promise<AudioBuffer>>();

export function renderSoundtrack(tl: Timeline): Promise<AudioBuffer> {
  let p = cache.get(tl);
  if (!p) {
    p = synthesise(tl).then((r) => {
      const buf = new AudioBuffer({ length: r.left.length, numberOfChannels: 2, sampleRate: r.sampleRate });
      buf.copyToChannel(r.left as Float32Array<ArrayBuffer>, 0);
      buf.copyToChannel(r.right as Float32Array<ArrayBuffer>, 1);
      return buf;
    });
    cache.set(tl, p);
    p.catch(() => cache.delete(tl));
  }
  return p;
}
