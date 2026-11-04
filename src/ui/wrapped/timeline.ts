/**
 * The Wrapped timeline. Everything is locked to one tempo so cuts, reveals
 * and the soundtrack land on the beat: scenes last whole bars at 128 BPM.
 */
import type { SceneId } from './data';

export const BPM = 128;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const FPS = 30;
/** Each scene is revealed over the end of the previous one for this long. */
export const TRANSITION = BEAT * 0.9;

const BARS: Record<SceneId, number> = {
  intro: 2,
  messages: 2,
  months: 2,
  hour: 2,
  talk: 2,
  speed: 2,
  emojis: 2,
  words: 2,
  streak: 2,
  awards: 3,
  persona: 2,
  summary: 4,
};

export interface TimelineScene {
  id: SceneId;
  /** Seconds from the start of the video. */
  start: number;
  dur: number;
  bars: number;
  startBar: number;
}

export interface Timeline {
  scenes: TimelineScene[];
  duration: number;
  bars: number;
}

export function buildTimeline(ids: SceneId[], awardCount = 3): Timeline {
  let bar = 0;
  const scenes: TimelineScene[] = [];
  for (const id of ids) {
    const bars = id === 'awards' ? (awardCount >= 2 ? 3 : 2) : BARS[id];
    scenes.push({ id, start: bar * BAR, dur: bars * BAR, bars, startBar: bar });
    bar += bars;
  }
  return { scenes, duration: bar * BAR, bars: bar };
}

/** Scene index and local time at `t` seconds (clamped to the video). */
export function sceneAt(tl: Timeline, t: number): { index: number; local: number } {
  const tt = Math.min(Math.max(0, t), Math.max(0, tl.duration - 1e-6));
  let lo = 0;
  let hi = tl.scenes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tl.scenes[mid]!.start <= tt) lo = mid;
    else hi = mid - 1;
  }
  return { index: lo, local: tt - (tl.scenes[lo]?.start ?? 0) };
}

export function frameCount(tl: Timeline, fps = FPS): number {
  return Math.round(tl.duration * fps);
}

/** "0:48" */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
