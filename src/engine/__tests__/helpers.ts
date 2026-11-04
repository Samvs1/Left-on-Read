import { parseChat } from '../../parser';
import { analyze } from '../compute';
import type { Settings } from '../types';

/** [author, 'YYYY-MM-DD HH:MM', text] */
export type Row = [string, string, string];

export function toAndroid(rows: Row[], systemLines: [string, string][] = []): string {
  const all: { when: string; line: string }[] = [
    ...rows.map(([a, w, t]) => ({ when: w, line: `${a}: ${t}` })),
    ...systemLines.map(([w, t]) => ({ when: w, line: t })),
  ];
  all.sort((x, y) => (x.when < y.when ? -1 : x.when > y.when ? 1 : 0));
  return all
    .map(({ when, line }) => {
      const [d, time] = when.split(' ');
      const [y, mo, da] = d!.split('-');
      return `${da}/${mo}/${y}, ${time} - ${line}`;
    })
    .join('\n');
}

export function run(rows: Row[], settings: Partial<Settings> = {}, systemLines: [string, string][] = []) {
  const parsed = parseChat(toAndroid(rows, systemLines));
  const { stats, prepared } = analyze(parsed, settings);
  const person = (name: string) => {
    const p = stats.people.find((x) => x.name === name);
    if (!p) throw new Error(`no person ${name}`);
    return p;
  };
  return { stats, prepared, person, parsed };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a Date-like UTC timestamp into 'YYYY-MM-DD HH:MM'. */
export function at(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Alternating conversation: authors take turns every `stepMin` minutes starting at `start`. */
export function alternating(start: string, count: number, authors: string[], stepMin: number, text: (i: number) => string): Row[] {
  const [d, t] = start.split(' ');
  const [y, mo, da] = d!.split('-').map(Number);
  const [h, mi] = t!.split(':').map(Number);
  const base = Date.UTC(y!, mo! - 1, da!, h!, mi!);
  return Array.from({ length: count }, (_, i) => [authors[i % authors.length]!, at(base + i * stepMin * 60_000), text(i)] as Row);
}
