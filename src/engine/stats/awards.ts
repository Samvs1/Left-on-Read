/**
 * Award selection. Every award has an eligibility rule and a minimum
 * winning value so nothing is handed out on meaningless data.
 */
import type { Award, AwardId, AwardUnit, PersonStats } from '../types';

interface AwardDef {
  id: AwardId;
  unit: AwardUnit;
  /** 1: highest value wins, -1: lowest value wins. */
  dir?: 1 | -1;
  value: (p: PersonStats) => number | null;
  /** Winner must reach this value (for dir = -1: must be at most this). */
  min?: number;
  max?: number;
  minPeople?: number;
  groupOnly?: boolean;
}

export const AWARD_DEFS: AwardDef[] = [
  { id: 'starter', unit: 'pct', value: (p) => (p.initiations >= 5 ? p.initiationShare : null), min: 0.3 },
  { id: 'ghost', unit: 'count', value: (p) => p.ghostedOthers, min: 3 },
  { id: 'novelist', unit: 'words', value: (p) => (p.textMessages >= 30 ? p.avgWords : null), min: 4 },
  { id: 'speedrunner', unit: 'ms', dir: -1, value: (p) => (p.responseTime && p.responseTime.count >= 15 ? p.responseTime.median : null) },
  { id: 'nightOwl', unit: 'pct', value: (p) => (p.messages >= 30 ? p.nightOwlPct : null), min: 0.03 },
  { id: 'earlyBird', unit: 'pct', value: (p) => (p.messages >= 30 ? p.earlyBirdPct : null), min: 0.03 },
  { id: 'doubleTexter', unit: 'count', value: (p) => p.doubleTexts, min: 5 },
  { id: 'emojiAddict', unit: 'perMsg', value: (p) => (p.messages >= 30 ? p.emojisPerMessage : null), min: 0.1 },
  { id: 'comedian', unit: 'count', value: (p) => p.laughsTriggered, min: 5 },
  { id: 'voiceNote', unit: 'count', value: (p) => p.media.audio, min: 3 },
  { id: 'deleter', unit: 'count', value: (p) => p.deleted, min: 3 },
  { id: 'editor', unit: 'count', value: (p) => p.edited, min: 3 },
  { id: 'questionMachine', unit: 'pct', value: (p) => (p.textMessages >= 30 && p.questionsAsked >= 10 ? p.questionRate : null), min: 0.05 },
  { id: 'hypeMan', unit: 'perMsg', value: (p) => (p.textMessages >= 30 ? p.exclamationsPerMessage : null), min: 0.05 },
  { id: 'capsLock', unit: 'pct', value: (p) => (p.textMessages >= 30 && p.capsRate * p.textMessages >= 5 ? p.capsRate : null), min: 0.01 },
  { id: 'linkDumper', unit: 'count', value: (p) => p.links, min: 5 },
  { id: 'stickerLord', unit: 'count', value: (p) => p.media.sticker, min: 5 },
  { id: 'reviver', unit: 'count', value: (p) => p.revives, min: 3 },
  { id: 'lastWord', unit: 'pct', value: (p) => (p.endings >= 5 ? p.endingShare : null), min: 0.3 },
  { id: 'sunshine', unit: 'score', value: (p) => (p.textMessages >= 30 ? p.sentiment : null), min: 0.02 },
  { id: 'photographer', unit: 'count', value: (p) => p.media.image, min: 10 },
  { id: 'monologue', unit: 'messages', value: (p) => p.longestMonologue?.messages ?? null, min: 8 },
  { id: 'wordsmith', unit: 'words', value: (p) => p.lexicalRichness, min: 1 },
  { id: 'laughTrack', unit: 'pct', value: (p) => (p.messages >= 30 && p.laughs >= 10 ? p.laughRate / 100 : null), min: 0.02 },
  { id: 'slowpoke', unit: 'ms', value: (p) => (p.responseTime && p.responseTime.count >= 15 ? p.responseTime.median : null), min: 60_000 },
  { id: 'leftOnRead', unit: 'count', value: (p) => p.gotGhosted, min: 3 },
  { id: 'apologizer', unit: 'count', value: (p) => p.apologies, min: 3 },
  { id: 'romantic', unit: 'count', value: (p) => p.loveYous + Math.round(p.hearts / 4), min: 3 },
  { id: 'weekendWarrior', unit: 'pct', value: (p) => (p.messages >= 50 ? p.weekendPct : null), min: 0.33 },
  { id: 'pottyMouth', unit: 'perMsg', value: (p) => (p.swears >= 5 ? p.swearsPer100 / 100 : null), min: 0.005 },
  { id: 'stretcher', unit: 'count', value: (p) => p.elongations, min: 5 },
  { id: 'lurker', unit: 'pct', dir: -1, groupOnly: true, minPeople: 4, value: (p) => (p.messages > 0 ? p.share : null), max: 0.05 },
  { id: 'caller', unit: 'count', value: (p) => p.calls, min: 3 },
];

export function computeAwards(people: PersonStats[], isGroup: boolean): Award[] {
  const out: Award[] = [];
  for (const def of AWARD_DEFS) {
    if (def.groupOnly && !isGroup) continue;
    if (def.minPeople && people.length < def.minPeople) continue;
    const dir = def.dir ?? 1;
    const vals: { a: number; v: number; msgs: number }[] = [];
    for (const p of people) {
      const v = def.value(p);
      if (v === null || !Number.isFinite(v)) continue;
      vals.push({ a: p.id, v, msgs: p.messages });
    }
    if (vals.length === 0) continue;
    vals.sort((x, y) => (dir === 1 ? y.v - x.v : x.v - y.v) || y.msgs - x.msgs);
    const win = vals[0]!;
    const run = vals[1] ?? null;
    if (def.min !== undefined && win.v < def.min) continue;
    if (def.max !== undefined && win.v > def.max) continue;
    if (run && run.v === win.v) continue;
    if (win.v === 0 && dir === 1) continue;
    let margin = 2;
    if (run) {
      if (dir === 1) margin = run.v > 0 ? win.v / run.v : 3;
      else margin = win.v > 0 ? run.v / win.v : 3;
    }
    out.push({
      id: def.id,
      winner: win.a,
      value: win.v,
      unit: def.unit,
      runnerUp: run ? run.a : null,
      runnerUpValue: run ? run.v : null,
      margin: Math.min(margin, 50),
    });
  }
  return out;
}
