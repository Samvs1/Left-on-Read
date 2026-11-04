import { beforeAll, describe, expect, it } from 'vitest';
import { parseChat } from '../../../parser';
import { analyze } from '../../../engine/compute';
import { generateDemoChat } from '../../../demo/generator';
import { ensureLang } from '../../../i18n';
import type { ChatStats } from '../../../engine/types';
import { run, type Row } from '../../../engine/__tests__/helpers';
import {
  ALL_TIME,
  buildWrapped,
  customPeriod,
  defaultPeriod,
  last12Period,
  periodLabel,
  pickPersona,
  personaScores,
  yearPeriod,
  yearsBetween,
  type Period,
} from '../data';
import { BAR, BEAT, buildTimeline, fmtClock, frameCount, sceneAt } from '../timeline';
import { renderSoundtrackPCM, SAMPLE_RATE } from '../synth';

const demo = generateDemoChat({ kind: 'duo' });
const parsed = parseChat(demo.text);
const full = analyze(parsed);
const names = (i: number) => full.stats.people[i]?.name ?? '?';

function statsFor(p: Period): ChatStats {
  return analyze(parsed, { dateStart: p.start, dateEnd: p.end }).stats;
}

function build(p: Period, lang: 'en' | 'nl' = 'en') {
  const stats = statsFor(p);
  return buildWrapped({ stats, lang, name: names, title: demo.title, period: p, firstTs: full.stats.meta.firstTs, lastTs: full.stats.meta.lastTs });
}

describe('wrapped timeline', () => {
  it('locks every scene to whole bars and finds the scene at any time', () => {
    const tl = buildTimeline(['intro', 'messages', 'awards', 'persona', 'summary'], 3);
    expect(tl.bars).toBe(2 + 2 + 3 + 2 + 4);
    expect(tl.duration).toBeCloseTo(tl.bars * BAR, 9);
    for (const sc of tl.scenes) expect(sc.start / BAR).toBeCloseTo(Math.round(sc.start / BAR), 9);
    expect(sceneAt(tl, 0)).toEqual({ index: 0, local: 0 });
    expect(sceneAt(tl, 2 * BAR + BEAT).index).toBe(1);
    expect(sceneAt(tl, 2 * BAR + BEAT).local).toBeCloseTo(BEAT, 9);
    expect(sceneAt(tl, 1e9).index).toBe(4);
    expect(sceneAt(tl, -5).index).toBe(0);
    expect(frameCount(tl, 30)).toBe(Math.round(tl.duration * 30));
  });

  it('gives a single award a shorter scene', () => {
    expect(buildTimeline(['awards'], 1).bars).toBe(2);
    expect(buildTimeline(['awards'], 2).bars).toBe(3);
  });

  it('formats clock times', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(48.7)).toBe('0:48');
    expect(fmtClock(61)).toBe('1:01');
  });
});

describe('wrapped periods', () => {
  it('builds calendar-year, last-12-month and custom windows', () => {
    const y = yearPeriod(2023);
    expect(y.start).toBe(Date.UTC(2023, 0, 1));
    expect(y.end).toBe(Date.UTC(2024, 0, 1));
    const l = last12Period(Date.UTC(2024, 2, 15, 18, 30));
    expect(l.end).toBe(Date.UTC(2024, 2, 16));
    expect(l.start).toBe(Date.UTC(2023, 2, 16));
    const c = customPeriod(Date.UTC(2024, 5, 10), Date.UTC(2024, 5, 1));
    expect(c.start).toBe(Date.UTC(2024, 5, 1));
    expect(c.end).toBe(Date.UTC(2024, 5, 11));
    expect(periodLabel(y, 0, 0)).toBe('2023');
  });

  it('only offers years that have messages', () => {
    const monthly = { starts: [Date.UTC(2021, 11, 1), Date.UTC(2022, 0, 1), Date.UTC(2023, 0, 1)], totals: [5, 0, 9] };
    expect(yearsBetween(Date.UTC(2021, 11, 3), Date.UTC(2023, 0, 9), monthly)).toEqual([2023, 2021]);
  });

  it('opens on last year when this year has barely started', () => {
    const { meta, time } = full.stats;
    // The demo ends a week into January 2024.
    expect(new Date(meta.lastTs).getUTCFullYear()).toBe(2024);
    expect(defaultPeriod(meta.firstTs, meta.lastTs, time.monthly)).toEqual(yearPeriod(2023));
    // A healthy current year stays the default.
    const monthly = { starts: [Date.UTC(2025, 0, 1), Date.UTC(2026, 0, 1)], totals: [1000, 900] };
    expect(defaultPeriod(Date.UTC(2025, 0, 1), Date.UTC(2026, 9, 1), monthly).year).toBe(2026);
    expect(defaultPeriod(Date.UTC(2025, 0, 1), Date.UTC(2026, 9, 1), null).year).toBe(2026);
  });
});

describe('buildWrapped', () => {
  beforeAll(async () => {
    await ensureLang('nl');
  });

  it('fills every scene for a full year of a busy chat', () => {
    const d = build(yearPeriod(2023))!;
    expect(d).not.toBeNull();
    expect(d.scenes).toEqual(['intro', 'messages', 'months', 'hour', 'talk', 'speed', 'emojis', 'words', 'streak', 'awards', 'persona', 'summary']);
    expect(d.year).toBe('2023');
    expect(d.bars).toHaveLength(12);
    expect(d.bars.filter((b) => b.top)).toHaveLength(1);
    expect(d.hourly).toHaveLength(24);
    expect(d.emojis.length).toBeGreaterThanOrEqual(3);
    expect(d.words.length).toBeGreaterThanOrEqual(3);
    expect(d.awards.length).toBeGreaterThanOrEqual(1);
    expect(d.awards.length).toBeLessThanOrEqual(3);
    expect(d.tiles).toHaveLength(6);
    expect(d.people.map((p) => p.name).sort()).toEqual(['Noor', 'Sam']);
    expect(d.transcript.map((x) => x.scene)).toEqual(d.scenes);
  });

  it('only counts messages inside the period', () => {
    const d = build(yearPeriod(2023))!;
    const all = build(ALL_TIME)!;
    expect(d.messages).toBeLessThan(all.messages);
    expect(d.messages).toBe(statsFor(yearPeriod(2023)).meta.totalMessages);
    expect(all.year).toBeNull();
    expect(all.copy['heading']).toContain('2022');
  });

  it('resolves all copy (no placeholders left) in English and Dutch', () => {
    for (const lang of ['en', 'nl'] as const) {
      const d = build(yearPeriod(2023), lang)!;
      const strings = [...Object.values(d.copy), ...d.transcript.map((x) => x.text), ...d.tiles.flatMap((x) => [x.label, x.value, x.sub]), d.persona.name, d.persona.line];
      for (const s of strings) expect(s).not.toMatch(/\{\w+\}/);
      expect(d.copy['msgWord']).toBe(lang === 'en' ? 'messages' : 'berichten');
    }
  });

  it('never includes message text', () => {
    const d = build(yearPeriod(2023))!;
    const json = JSON.stringify(d);
    const texts = parsed.messages.filter((m) => m.type === 'text' && m.text.split(/\s+/).length >= 4).map((m) => m.text);
    expect(texts.length).toBeGreaterThan(100);
    for (const text of texts) expect(json.includes(text)).toBe(false);
  });

  it('returns null when the period has too few messages', () => {
    expect(build(customPeriod(Date.UTC(2010, 0, 1), Date.UTC(2010, 0, 2)))).toBeNull();
  });

  it('drops scenes it has no material for', () => {
    const rows: Row[] = [];
    for (let i = 0; i < 30; i++) rows.push([i % 2 ? 'Ana' : 'Ben', `2024-03-14 ${String(9 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`, 'ok']);
    const { stats } = run(rows);
    const d = buildWrapped({ stats, lang: 'en', name: (i) => stats.people[i]!.name, title: 'Ana & Ben', period: ALL_TIME, firstTs: stats.meta.firstTs, lastTs: stats.meta.lastTs })!;
    expect(d.scenes).not.toContain('months');
    expect(d.scenes).not.toContain('emojis');
    expect(d.scenes).not.toContain('streak');
    expect(d.scenes[0]).toBe('intro');
    expect(d.scenes.at(-1)).toBe('summary');
    expect(d.copy['introLine']).toMatch(/^(Ana & Ben|Ben & Ana)$/);
  });
});

describe('chat personality', () => {
  function rowsAt(hours: number[], days: number, weekendOnly = false): Row[] {
    const rows: Row[] = [];
    let n = 0;
    for (let d = 0; d < days; d++) {
      const date = new Date(Date.UTC(2024, 0, 1 + d));
      const wd = date.getUTCDay();
      if (weekendOnly && wd !== 0 && wd !== 6) continue;
      for (const h of hours) {
        const ymd = date.toISOString().slice(0, 10);
        rows.push([n++ % 2 ? 'Ana' : 'Ben', `${ymd} ${String(h).padStart(2, '0')}:1${n % 10}`, 'hey how are you doing today']);
      }
    }
    return rows;
  }

  it('spots night owls', () => {
    const { stats } = run(rowsAt([1, 2, 3, 14], 40));
    expect(personaScores(stats).night).toBeGreaterThan(1);
    expect(pickPersona(stats)).toBe('night');
  });

  it('spots weekend chats', () => {
    const { stats } = run(rowsAt([12, 15, 18], 60, true));
    expect(pickPersona(stats)).toBe('weekend');
  });

  it('falls back to a calm default for an unremarkable chat', () => {
    const { stats } = run(rowsAt([10, 13, 16, 19], 3));
    expect(['daily', 'slow', 'story', 'rapid']).toContain(pickPersona(stats));
  });
});

describe('soundtrack synth', () => {
  const tl = buildTimeline(['intro', 'messages', 'persona', 'summary']);
  const a = renderSoundtrackPCM(tl.scenes, tl.duration);

  it('renders exactly the length of the video, in stereo', () => {
    expect(a.sampleRate).toBe(SAMPLE_RATE);
    expect(a.left.length).toBe(Math.ceil(tl.duration * SAMPLE_RATE));
    expect(a.right.length).toBe(a.left.length);
  });

  it('is loud enough, never clips and fades out at the end', () => {
    let peak = 0;
    let sum = 0;
    let bad = 0;
    for (let i = 0; i < a.left.length; i++) {
      const v = a.left[i]!;
      if (!Number.isFinite(v)) bad++;
      peak = Math.max(peak, Math.abs(v), Math.abs(a.right[i]!));
      sum += v * v;
    }
    expect(bad).toBe(0);
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.5);
    expect(Math.sqrt(sum / a.left.length)).toBeGreaterThan(0.05);
    const tail = a.left.subarray(a.left.length - 200);
    expect(Math.max(...Array.from(tail, Math.abs))).toBeLessThan(0.02);
  });

  it('drops the kick for the personality breakdown', () => {
    // Low-frequency energy per bar: the breakdown has no kick or bass.
    const bandEnergy = (bar: number) => {
      const s = Math.floor(bar * BAR * SAMPLE_RATE);
      const e = Math.floor((bar + 1) * BAR * SAMPLE_RATE);
      let lp = 0;
      let acc = 0;
      for (let i = s; i < e; i++) {
        lp += 0.01 * (a.left[i]! - lp);
        acc += lp * lp;
      }
      return acc / (e - s);
    };
    const persona = tl.scenes.find((x) => x.id === 'persona')!;
    const groove = bandEnergy(tl.scenes[1]!.startBar);
    const breakdown = bandEnergy(persona.startBar);
    expect(breakdown).toBeLessThan(groove * 0.5);
  });

  it('is deterministic', () => {
    const b = renderSoundtrackPCM(tl.scenes, tl.duration);
    for (const i of [1000, 50_000, 200_000, a.left.length - 5000]) expect(b.left[i]).toBe(a.left[i]);
  });
});
