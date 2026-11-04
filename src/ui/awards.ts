import type { Award, AwardId } from '../engine/types';
import { fmtDuration, fmtFixed, fmtNum, fmtPct } from './format';

export interface AwardMeta {
  emoji: string;
  from: string;
  to: string;
}

export const AWARD_META: Record<AwardId, AwardMeta> = {
  starter: { emoji: '🚀', from: '#6a4bff', to: '#3ba7f0' },
  ghost: { emoji: '👻', from: '#5b5f7a', to: '#9a83ff' },
  novelist: { emoji: '📜', from: '#f5a524', to: '#f0603f' },
  speedrunner: { emoji: '⚡', from: '#ffcf3f', to: '#ff7a2f' },
  nightOwl: { emoji: '🦉', from: '#2a2a72', to: '#7c5cff' },
  earlyBird: { emoji: '🌅', from: '#ffb547', to: '#ff6f91' },
  doubleTexter: { emoji: '📲', from: '#00b4a0', to: '#3b8ef0' },
  emojiAddict: { emoji: '🤩', from: '#ff6fb1', to: '#ffb547' },
  comedian: { emoji: '🎤', from: '#ff5b4a', to: '#c04bd8' },
  voiceNote: { emoji: '🎙️', from: '#7c5cff', to: '#ff6fb1' },
  deleter: { emoji: '🗑️', from: '#6e6a7c', to: '#e34948' },
  editor: { emoji: '✏️', from: '#3b8ef0', to: '#12b38f' },
  questionMachine: { emoji: '❓', from: '#ff7a2f', to: '#ffcf3f' },
  hypeMan: { emoji: '📣', from: '#ff3d77', to: '#ff9a3d' },
  capsLock: { emoji: '🔠', from: '#e34948', to: '#ff9a3d' },
  linkDumper: { emoji: '🔗', from: '#2a78d6', to: '#7c5cff' },
  stickerLord: { emoji: '👑', from: '#ffcf3f', to: '#c04bd8' },
  reviver: { emoji: '🧟', from: '#12b38f', to: '#6a4bff' },
  lastWord: { emoji: '🎬', from: '#16141d', to: '#6a4bff' },
  sunshine: { emoji: '☀️', from: '#ffd34d', to: '#ff8a3d' },
  photographer: { emoji: '📸', from: '#3ba7f0', to: '#ff6fb1' },
  monologue: { emoji: '🎭', from: '#9a3fd6', to: '#ff5b4a' },
  wordsmith: { emoji: '📚', from: '#1baf7a', to: '#2a78d6' },
  laughTrack: { emoji: '😂', from: '#ffc23d', to: '#ff6f91' },
  slowpoke: { emoji: '🐢', from: '#1baf7a', to: '#8bc34a' },
  leftOnRead: { emoji: '👀', from: '#6250d6', to: '#e87ba4' },
  apologizer: { emoji: '🙏', from: '#f5a524', to: '#e87ba4' },
  romantic: { emoji: '💘', from: '#ff3d77', to: '#ff9ac0' },
  weekendWarrior: { emoji: '🎉', from: '#7c5cff', to: '#ffb547' },
  pottyMouth: { emoji: '🤬', from: '#e34948', to: '#6a1f3f' },
  stretcher: { emoji: '🐍', from: '#12b38f', to: '#ffcf3f' },
  lurker: { emoji: '🕵️', from: '#3a3f55', to: '#6e6a7c' },
  caller: { emoji: '📞', from: '#12b38f', to: '#3b8ef0' },
};

export function awardValue(a: Pick<Award, 'unit' | 'value' | 'id'>): string {
  switch (a.unit) {
    case 'pct':
      return fmtPct(a.value);
    case 'ms':
      return fmtDuration(a.value);
    case 'perMsg':
      return a.id === 'pottyMouth' ? fmtFixed(a.value * 100, 1) : fmtFixed(a.value, 2);
    case 'words':
      return fmtFixed(a.value, 1);
    case 'score':
      return fmtFixed(a.value, 2);
    default:
      return fmtNum(a.value);
  }
}

/** Award order for reveals: the most decisive wins first. */
export function rankedAwards(awards: Award[]): Award[] {
  return [...awards].sort((x, y) => y.margin - x.margin);
}
