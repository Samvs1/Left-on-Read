import { describe, expect, it } from 'vitest';
import { at, run, type Row } from './helpers';
import { computeStats, prepare, search } from '../index';
import { parseChat } from '../../parser';
import { toAndroid } from './helpers';

function groupChat(): { rows: Row[]; sys: [string, string][] } {
  const rows: Row[] = [];
  const people = ['Sarah', 'Tom', 'Lisa', 'Mark', 'Noor', 'Quiet Q'];
  let t = Date.UTC(2023, 0, 2, 9);
  for (let d = 0; d < 60; d++) {
    // Sarah & Tom ping-pong a lot; Lisa answers Mark; Quiet Q almost never speaks
    for (let k = 0; k < 6; k++) {
      rows.push([k % 2 === 0 ? 'Sarah' : 'Tom', at(t), k % 2 === 0 ? 'hey what are we doing tonight?' : 'pizza obviously']);
      t += 60_000;
    }
    rows.push(['Mark', at(t), 'anyone up for a run']);
    t += 60_000;
    rows.push(['Lisa', at(t), 'me!']);
    t += 60_000;
    rows.push(['Mark', at(t), 'great, 7pm?']);
    t += 60_000;
    rows.push(['Lisa', at(t), 'deal']);
    t += 60_000;
    rows.push(['Noor', at(t), 'haha']);
    t += 60_000;
    if (d === 30) rows.push(['Quiet Q', at(t), 'hi all']);
    t += DAY - 14 * 60_000;
  }
  void people;
  const sys: [string, string][] = [
    ['2023-01-01 08:00', 'Sarah created group "Weekend Crew"'],
    ['2023-01-01 08:01', 'Sarah added Tom, Lisa and Mark'],
    ['2023-01-01 08:02', 'Noor joined using this group\'s invite link'],
    ['2023-01-01 08:03', 'Sarah added Quiet Q and Ghosty'],
    ['2023-02-01 08:00', 'Mark changed the subject from "Weekend Crew" to "Weekend Crew 🍕"'],
    ['2023-02-02 08:00', 'Ghosty left'],
  ];
  return { rows, sys };
}
const DAY = 86_400_000;

describe('group statistics', () => {
  const { rows, sys } = groupChat();
  const { stats } = run(rows, {}, sys);
  const idx = (name: string) => stats.meta.people.indexOf(name);

  it('detects groups and exposes membership events', () => {
    expect(stats.meta.isGroup).toBe(true);
    expect(stats.duo).toBeNull();
    const g = stats.group!;
    expect(g.memberEvents.filter((e) => e.kind === 'added').map((e) => e.person)).toEqual(['Tom', 'Lisa', 'Mark', 'Quiet Q', 'Ghosty']);
    expect(g.memberEvents.find((e) => e.kind === 'left')!.person).toBe('Ghosty');
    expect(g.subjectChanges.map((s) => s.subject)).toEqual(['Weekend Crew', 'Weekend Crew 🍕']);
    expect(g.silentMembers).toContain('Ghosty');
    expect(stats.meta.title).toBe('Weekend Crew 🍕');
  });

  it('finds lurkers and active member counts', () => {
    const g = stats.group!;
    expect(g.lurkers).toContain(idx('Quiet Q'));
    expect(g.memberCount.length).toBe(3);
    expect(g.memberCount[0]!.count).toBe(5);
  });

  it('builds the network and finds cliques', () => {
    const g = stats.group!;
    const st = g.network.edges.find((e) => [e.a, e.b].sort().join() === [idx('Sarah'), idx('Tom')].sort().join())!;
    expect(st.weight).toBeGreaterThan(250);
    expect(g.cliques.length).toBeGreaterThan(0);
    const pairs = g.cliques.map((c) => [stats.meta.people[c.a], stats.meta.people[c.b]].sort().join('+'));
    expect(pairs).toContain('Lisa+Mark');
    expect(pairs).toContain('Sarah+Tom');
  });

  it('reports who replies fastest to whom', () => {
    const g = stats.group!;
    expect(g.fastestPairs.length).toBeGreaterThan(0);
    expect(g.fastestPairs[0]!.medianMs).toBe(60_000);
  });

  it('identifies the glue that revives dead conversations', () => {
    const rows2: Row[] = [
      ['A', '2023-03-01 10:00', 'hi'],
      ['B', '2023-03-01 10:01', 'hi'],
      ['C', '2023-03-05 10:00', 'anyone alive?'],
      ['A', '2023-03-05 10:01', 'yes'],
      ['C', '2023-03-10 10:00', 'hello??'],
      ['B', '2023-03-10 10:01', 'here'],
    ];
    const r = run(rows2);
    expect(r.stats.meta.people[r.stats.group!.glue]).toBe('C');
    expect(r.person('C').revives).toBe(2);
  });

  it('groups small members as Others in stacked series', () => {
    const r = run(rows, { othersThresholdPct: 15 }, sys);
    expect(r.stats.meta.otherPeople).toContain(r.stats.meta.people.indexOf('Quiet Q'));
    expect(r.stats.time.daily.byPerson.length).toBe(r.stats.meta.mainPeople.length + 1);
  });
});

describe('duo statistics', () => {
  const rows: Row[] = [
    ['A', '2023-03-01 07:30', 'good morning!'],
    ['B', '2023-03-01 07:45', 'morning, sorry I overslept'],
    ['A', '2023-03-01 23:00', 'goodnight, love you'],
    ['B', '2023-03-01 23:05', 'night night, hou van je'],
    ['B', '2023-03-02 08:00', 'pizza tonight?'],
    ['A', '2023-03-02 08:05', 'yes pizza'],
    ['A', '2023-03-02 23:30', 'welterusten'],
  ];

  it('tracks morning firsts and goodnight lasts', () => {
    const { stats, person } = run(rows);
    expect(person('A').morningFirsts).toBe(1);
    expect(person('B').morningFirsts).toBe(1);
    expect(person('B').goodnightLasts).toBe(1);
    expect(person('A').goodnightLasts).toBe(1);
    const duo = stats.duo!;
    expect(duo.morningFirsts[0] + duo.morningFirsts[1]).toBe(2);
  });

  it('counts apologies and love declarations head to head', () => {
    const { stats } = run(rows);
    const duo = stats.duo!;
    const a = stats.meta.people.indexOf('A') === duo.a ? 0 : 1;
    expect(duo.loveYous[a]).toBe(1);
    expect(duo.apologies[1 - a]).toBe(1);
  });

  it('finds firsts for configurable words', () => {
    const { stats } = run(rows, { firstsWords: ['pizza', 'love you', 'banana'] });
    const pizza = stats.duo!.firsts.find((f) => f.word === 'pizza')!;
    const bIdx = stats.meta.people.indexOf('B');
    expect(pizza.byPerson[bIdx]!.ts).toBe(Date.UTC(2023, 2, 2, 8));
    expect(stats.duo!.firsts.find((f) => f.word === 'banana')).toBeUndefined();
  });
});

describe('awards', () => {
  function rich(): Row[] {
    const rows: Row[] = [];
    let t = Date.UTC(2023, 0, 2, 9);
    for (let d = 0; d < 40; d++) {
      rows.push(['Emoji Queen', at(t), 'good morning 😍😍🔥 how are you?']);
      rows.push(['Essay Guy', at(t + 10 * 60_000), 'Well, I have been thinking about many things today, including the weather, the economy and also what we should cook for dinner tonight.']);
      rows.push(['Emoji Queen', at(t + 11 * 60_000), 'hahaha 😂 love it!!']);
      rows.push(['Essay Guy', at(t + 40 * 60_000), 'Indeed. I will write more about it later when I have the time to properly explain myself.']);
      t += DAY;
    }
    return rows;
  }

  it('hands out meaningful awards', () => {
    const { stats } = run(rich());
    const byId = Object.fromEntries(stats.awards.map((a) => [a.id, stats.meta.people[a.winner]]));
    expect(byId['novelist']).toBe('Essay Guy');
    expect(byId['emojiAddict']).toBe('Emoji Queen');
    expect(byId['speedrunner']).toBe('Emoji Queen');
    expect(byId['slowpoke']).toBe('Essay Guy');
    expect(byId['starter']).toBe('Emoji Queen');
    expect(byId['questionMachine']).toBe('Emoji Queen');
    expect(byId['comedian']).toBe('Essay Guy');
    expect(stats.awards.length).toBeGreaterThanOrEqual(8);
  });

  it('includes runner-up values and margins', () => {
    const { stats } = run(rich());
    const novelist = stats.awards.find((a) => a.id === 'novelist')!;
    expect(novelist.runnerUpValue).not.toBeNull();
    expect(novelist.margin).toBeGreaterThan(3);
    expect(novelist.unit).toBe('words');
  });

  it('gives no awards for a tiny chat', () => {
    const { stats } = run([
      ['A', '2023-03-01 10:00', 'hi'],
      ['B', '2023-03-01 10:01', 'yo'],
    ]);
    expect(stats.awards).toEqual([]);
  });
});

describe('word search', () => {
  const rows: Row[] = [
    ['A', '2023-01-01 10:00', 'pizza time'],
    ['B', '2023-01-01 10:01', 'Pizza? again? PIZZA!'],
    ['A', '2023-02-01 10:00', 'I love you'],
    ['B', '2023-02-01 10:01', 'love you too 😂'],
    ['A', '2023-02-02 10:00', 'pizzeria tonight'],
  ];
  const P = prepare(parseChat(toAndroid(rows)));

  it('counts a word per person and per month', () => {
    const r = search(P, {}, 'pizza');
    expect(r.total).toBe(3);
    expect(r.messages).toBe(2);
    expect(r.byPerson[P.people.indexOf('B')]).toBe(2);
    expect(r.monthly.counts).toEqual([3, 0]);
    expect(r.first!.text).toBe('pizza time');
  });

  it('searches phrases, emojis and prefixes', () => {
    expect(search(P, {}, 'love you').total).toBe(2);
    expect(search(P, {}, '😂').total).toBe(1);
    expect(search(P, {}, 'pizz*').total).toBe(4);
    expect(search(P, {}, 'nonexistent').total).toBe(0);
    expect(search(P, {}, '   ').total).toBe(0);
  });
});

describe('edge cases', () => {
  it('handles a single-message chat', () => {
    const P = prepare(parseChat('01/03/2023, 10:00 - A: hello'));
    const s = computeStats(P);
    expect(s.meta.totalMessages).toBe(1);
    expect(s.people[0]!.responseTime).toBeNull();
    expect(s.dynamics.effort).toBeNull();
    expect(s.eras).toHaveLength(1);
    expect(s.time.longestSilence).toBeNull();
  });

  it('handles a date range with no messages', () => {
    const P = prepare(parseChat('01/03/2023, 10:00 - A: hello\n01/03/2023, 10:01 - B: hi'));
    const s = computeStats(P, { dateStart: Date.UTC(2024, 0, 1) });
    expect(s.meta.totalMessages).toBe(0);
    expect(s.time.daily.totals).toEqual([]);
    expect(s.eras).toEqual([]);
    expect(s.awards).toEqual([]);
    expect(s.people.every((p) => p.messages === 0)).toBe(true);
  });

  it('handles a large chat quickly', () => {
    const rows: Row[] = [];
    let t = Date.UTC(2022, 0, 1, 8);
    const texts = ['hey how are you', 'haha true 😂', 'pizza tonight?', 'ok see you later', 'love you ❤️', 'what are you doing'];
    for (let i = 0; i < 20000; i++) {
      rows.push([i % 3 === 0 ? 'A' : 'B', at(t), texts[i % texts.length]!]);
      t += (i % 50 === 0 ? 8 * 3600 : 90) * 1000;
    }
    const parsed = parseChat(toAndroid(rows));
    const t0 = performance.now();
    const P = prepare(parsed);
    const s = computeStats(P);
    const ms = performance.now() - t0;
    expect(s.meta.totalMessages).toBe(20000);
    expect(ms).toBeLessThan(3000);
  });
});
