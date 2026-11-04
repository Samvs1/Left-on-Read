import { describe, expect, it } from 'vitest';
import { at, run, type Row } from './helpers';

const DAY = 86_400_000;

describe('time distributions', () => {
  it('builds hourly and Monday-first weekday distributions', () => {
    // 2023-03-13 is a Monday, 2023-03-19 a Sunday
    const { stats, person } = run([
      ['A', '2023-03-13 10:00', 'monday'],
      ['B', '2023-03-13 10:05', 'yes'],
      ['A', '2023-03-19 23:30', 'sunday night'],
    ]);
    expect(stats.time.weekday).toEqual([2, 0, 0, 0, 0, 0, 1]);
    expect(stats.time.hourly[10]).toBe(2);
    expect(stats.time.hourly[23]).toBe(1);
    expect(person('A').weekdayHour[0 * 24 + 10]).toBe(1);
    expect(person('A').weekdayHour[6 * 24 + 23]).toBe(1);
    expect(stats.time.busiestHour).toBe(10);
    expect(stats.time.busiestWeekday).toBe(0);
  });

  it('builds daily, weekly and monthly series stacked by person', () => {
    const { stats } = run([
      ['A', '2023-01-31 10:00', 'a'],
      ['B', '2023-02-01 10:00', 'b'],
      ['B', '2023-02-01 10:01', 'c'],
    ]);
    expect(stats.time.daily.totals).toEqual([1, 2]);
    expect(stats.time.monthly.totals).toEqual([1, 2]);
    expect(stats.time.weekly.totals).toEqual([3]);
    const b = stats.meta.mainPeople.indexOf(stats.meta.people.indexOf('B'));
    expect(stats.time.monthly.byPerson[b]).toEqual([0, 2]);
    expect(stats.time.monthly.starts[1]).toBe(Date.UTC(2023, 1, 1));
  });

  it('finds the busiest day with an excerpt and keywords', () => {
    const rows: Row[] = [
      ['A', '2023-03-01 10:00', 'normal day'],
      ['A', '2023-03-02 20:00', 'did you see the concert tickets'],
      ['B', '2023-03-02 20:01', 'concert tickets are sold out!!'],
      ['A', '2023-03-02 20:02', 'noooo the concert'],
      ['B', '2023-03-03 09:00', 'morning'],
    ];
    const { stats } = run(rows);
    const bd = stats.time.busiestDay!;
    expect(bd.day).toBe(Date.UTC(2023, 2, 2));
    expect(bd.count).toBe(3);
    expect(bd.keywords).toContain('concert');
    expect(bd.excerpt).toHaveLength(3);
  });

  it('finds the longest streak and the longest silence', () => {
    const { stats } = run([
      ['A', '2023-03-01 10:00', 'x'],
      ['B', '2023-03-02 10:00', 'x'],
      ['A', '2023-03-03 10:00', 'x'],
      ['A', '2023-03-10 10:00', 'x'],
      ['B', '2023-03-11 10:00', 'x'],
    ]);
    expect(stats.time.longestStreak.days).toBe(3);
    expect(stats.time.longestStreak.start).toBe(Date.UTC(2023, 2, 1));
    expect(stats.time.currentStreak).toBe(2);
    expect(stats.time.longestSilence!.ms).toBe(7 * DAY);
    expect(stats.meta.people[stats.time.longestSilence!.brokenBy]).toBe('A');
  });

  it('computes night owl, early bird and weekend shares', () => {
    const { person, stats } = run([
      ['A', '2023-03-13 02:00', 'cant sleep'],
      ['A', '2023-03-13 03:00', 'still awake'],
      ['B', '2023-03-13 06:30', 'morning run done'],
      ['B', '2023-03-18 12:00', 'saturday!'],
    ]);
    expect(person('A').nightOwlPct).toBe(1);
    expect(person('B').earlyBirdPct).toBe(0.5);
    expect(person('B').weekendPct).toBe(0.5);
    expect(stats.time.nightOwlPct).toBe(0.5);
  });

  it('applies the timezone override', () => {
    const rows: Row[] = [
      ['A', '2023-03-13 23:30', 'late'],
      ['B', '2023-03-13 23:40', 'yes'],
    ];
    const { stats } = run(rows, { timezoneOffsetHours: 2 });
    expect(stats.time.hourly[1]).toBe(2);
    expect(stats.time.weekday[1]).toBe(2);
  });

  it('filters by date range', () => {
    const rows: Row[] = [
      ['A', '2023-03-01 10:00', 'early'],
      ['B', '2023-03-14 10:00', 'mid'],
      ['A', '2023-03-20 10:00', 'late'],
    ];
    const { stats } = run(rows, { dateStart: Date.UTC(2023, 2, 10), dateEnd: Date.UTC(2023, 2, 15) });
    expect(stats.meta.totalMessages).toBe(1);
    expect(stats.meta.excludedMessages).toBe(2);
    expect(stats.meta.fullFirstTs).toBe(Date.UTC(2023, 2, 1, 10));
  });

  it('can count system messages in totals', () => {
    const rows: Row[] = [
      ['A', '2023-03-01 10:00', 'hi'],
      ['B', '2023-03-01 10:01', 'yo'],
    ];
    const sys: [string, string][] = [['2023-03-01 09:00', 'A added B']];
    expect(run(rows, {}, sys).stats.meta.totalMessages).toBe(2);
    expect(run(rows, { includeSystem: true }, sys).stats.meta.totalMessages).toBe(3);
  });
});

describe('eras', () => {
  function phases(): Row[] {
    const rows: Row[] = [];
    const start = Date.UTC(2022, 0, 1, 12);
    // 4 quiet months, 4 very busy months, 4 quiet months
    for (let d = 0; d < 365; d++) {
      const month = Math.floor(d / 30.5);
      const perDay = month >= 4 && month < 8 ? 20 : 1;
      for (let k = 0; k < perDay; k++) {
        const t = start + d * DAY + k * 120_000;
        rows.push([k % 2 === 0 ? 'A' : 'B', at(t), month >= 4 && month < 8 ? 'pizza night again' : 'quiet times']);
      }
    }
    return rows;
  }

  it('detects eras and labels the busiest one golden', () => {
    const { stats } = run(phases());
    expect(stats.eras.length).toBeGreaterThanOrEqual(3);
    const golden = stats.eras.find((e) => e.kind === 'golden')!;
    expect(golden).toBeDefined();
    expect(golden.perDay).toBeGreaterThan(10);
    expect(new Date(golden.start).getUTCMonth()).toBe(4);
    expect(golden.topWords).toContain('pizza');
    expect(stats.eras[0]!.start).toBe(Date.UTC(2022, 0, 1));
  });

  it('returns a single era for very short chats', () => {
    const { stats } = run([
      ['A', '2023-03-01 10:00', 'hi'],
      ['B', '2023-03-02 10:00', 'yo'],
    ]);
    expect(stats.eras).toHaveLength(1);
    expect(stats.eras[0]!.messages).toBe(2);
  });
});

describe('sentiment', () => {
  it('scores positive and negative messages and handles negation', () => {
    const { prepared } = run([
      ['A', '2023-03-01 10:00', 'I love this, amazing! 😍'],
      ['B', '2023-03-01 10:01', 'this is terrible, I hate it'],
      ['A', '2023-03-01 10:02', 'not good'],
      ['B', '2023-03-01 10:03', 'the table is brown'],
    ]);
    expect(prepared.sentiment[0]).toBeGreaterThan(0.5);
    expect(prepared.sentiment[1]).toBeLessThan(-0.5);
    expect(prepared.sentiment[2]).toBeLessThan(0);
    expect(prepared.sentiment[3]).toBe(0);
  });

  it('finds who brings the good vibes and monthly mood', () => {
    const rows: Row[] = [];
    for (let i = 0; i < 40; i++) {
      const t = Date.UTC(2023, 2, 1 + (i % 20), 10, i);
      rows.push(['A', at(t), 'great day, love it 😊']);
      rows.push(['B', at(t + 60_000), 'ugh so tired and annoyed']);
    }
    const { stats, person } = run(rows);
    expect(stats.meta.people[stats.sentiment.goodVibes]).toBe('A');
    expect(person('A').sentiment).toBeGreaterThan(0);
    expect(person('B').sentiment).toBeLessThan(0);
    expect(stats.sentiment.monthly.overall).toHaveLength(1);
    expect(stats.sentiment.mostPositiveDay).not.toBeNull();
  });
});
