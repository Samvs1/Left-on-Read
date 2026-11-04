/**
 * Performance benchmark: generates demo chats (incl. a ~200k message stress
 * chat) and times parse → prepare → compute.
 * Usage: npm run bench
 */
import { generateDemoChat } from '../src/demo/generator';
import { parseChat } from '../src/parser';
import { computeStats, prepare } from '../src/engine';

const runs: [string, Parameters<typeof generateDemoChat>[0]][] = [
  ['duo demo', { kind: 'duo' }],
  ['group demo', { kind: 'group' }],
  ['stress (~200k)', { kind: 'group', targetMessages: 200_000, months: 24 }],
];
for (const [label, opts] of runs) {
  const demo = generateDemoChat(opts);
  const t0 = performance.now();
  const parsed = parseChat(demo.text);
  const t1 = performance.now();
  const P = prepare(parsed);
  const t2 = performance.now();
  const s = computeStats(P);
  const t3 = performance.now();
  computeStats(P, { conversationGapMinutes: 120 });
  const t4 = performance.now();
  console.log(
    `${label.padEnd(16)} ${String(parsed.messages.length).padStart(7)} msgs | parse ${(t1 - t0).toFixed(0)} ms | prepare ${(t2 - t1).toFixed(0)} ms | compute ${(t3 - t2).toFixed(0)} ms | total ${(t3 - t0).toFixed(0)} ms | recompute ${(t4 - t3).toFixed(0)} ms | awards ${s.awards.length} | eras ${s.eras.length}`,
  );
}
