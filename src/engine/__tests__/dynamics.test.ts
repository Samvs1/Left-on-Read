import { describe, expect, it } from 'vitest';
import { alternating, run, type Row } from './helpers';

const MIN = 60_000;

describe('conversations', () => {
  const rows: Row[] = [
    ['A', '2023-03-14 10:00', 'hi'],
    ['B', '2023-03-14 10:05', 'hey'],
    ['A', '2023-03-14 17:05', 'back'],
    ['B', '2023-03-14 17:06', 'ok'],
  ];

  it('splits conversations at the gap threshold', () => {
    expect(run(rows).stats.dynamics.conversations).toBe(2);
    expect(run(rows, { conversationGapMinutes: 8 * 60 }).stats.dynamics.conversations).toBe(1);
  });

  it('counts initiators and enders', () => {
    const { person } = run(rows);
    expect(person('A').initiations).toBe(2);
    expect(person('A').initiationShare).toBe(1);
    expect(person('B').endings).toBe(2);
    expect(person('B').endingShare).toBe(1);
  });

  it('bins conversation lengths and durations', () => {
    const { stats } = run(rows);
    expect(stats.dynamics.conversationLengthBins.find((b) => b.label === '2–5')!.count).toBe(2);
    expect(stats.dynamics.avgConversationDurationMs).toBe(3 * MIN);
    expect(stats.dynamics.longestConversation!.messages).toBe(2);
  });
});

describe('response times', () => {
  const rows: Row[] = [
    ['A', '2023-03-14 10:00', 'one'],
    ['B', '2023-03-14 10:02', 'two'],
    ['A', '2023-03-14 10:05', 'three'],
    ['B', '2023-03-14 10:15', 'four'],
    ['A', '2023-03-14 10:16', 'five'],
  ];

  it('reports medians per person', () => {
    const { person } = run(rows);
    expect(person('B').responseTime!.median).toBe(6 * MIN);
    expect(person('A').responseTime!.median).toBe(2 * MIN);
    expect(person('A').responseTime!.count).toBe(2);
  });

  it('reports P25/P75/P90 percentiles', () => {
    const rt = run(rows).person('B').responseTime!;
    expect(rt.p25).toBe(4 * MIN);
    expect(rt.p75).toBe(8 * MIN);
    expect(rt.p90).toBeCloseTo(9.2 * MIN);
  });

  it('measures from the last message of the previous turn', () => {
    const { person } = run([
      ['A', '2023-03-14 10:00', 'hey'],
      ['A', '2023-03-14 10:04', 'you there?'],
      ['B', '2023-03-14 10:05', 'yes'],
    ]);
    expect(person('B').responseTime!.median).toBe(MIN);
  });

  it('ignores replies across conversation boundaries', () => {
    const { person } = run([
      ['A', '2023-03-14 10:00', 'hey'],
      ['B', '2023-03-15 10:00', 'sorry, just saw this'],
    ]);
    expect(person('B').responseTime).toBeNull();
  });

  it('fills the response histogram', () => {
    const { person, stats } = run(rows);
    const bins = stats.dynamics.responseBins.map((b) => b.label);
    const hist = person('B').responseHistogram;
    expect(hist[bins.indexOf('1–5m')]).toBe(1);
    expect(hist[bins.indexOf('5–15m')]).toBe(1);
  });

  it('computes response time by hour of the answered message', () => {
    const many = alternating('2023-03-14 09:00', 12, ['A', 'B'], 2, (i) => `msg ${i}`);
    const { stats } = run(many);
    expect(stats.dynamics.responseByHour[9]).toBe(2 * MIN);
    expect(stats.dynamics.responseByHour[3]).toBeNull();
  });
});

describe('double texts, monologues, turns', () => {
  it('detects double texts beyond the threshold', () => {
    const { person } = run([
      ['A', '2023-03-14 10:00', 'hey'],
      ['A', '2023-03-14 11:30', 'hello??'],
      ['A', '2023-03-14 11:45', 'ok then'],
      ['B', '2023-03-14 11:50', 'sorry!'],
    ]);
    expect(person('A').doubleTexts).toBe(1);
  });

  it('respects a custom double-text threshold', () => {
    const rows: Row[] = [
      ['A', '2023-03-14 10:00', 'hey'],
      ['A', '2023-03-14 10:30', 'hello??'],
      ['B', '2023-03-14 10:31', 'yo'],
    ];
    expect(run(rows).person('A').doubleTexts).toBe(0);
    expect(run(rows, { doubleTextMinutes: 15 }).person('A').doubleTexts).toBe(1);
  });

  it('counts turns and the longest monologue', () => {
    const { person, stats } = run([
      ['A', '2023-03-14 10:00', '1'],
      ['A', '2023-03-14 10:01', '2'],
      ['A', '2023-03-14 10:02', '3'],
      ['B', '2023-03-14 10:03', 'wow'],
      ['A', '2023-03-14 10:04', '4'],
    ]);
    expect(person('A').turns).toBe(2);
    expect(person('A').messagesPerTurn).toBe(2);
    expect(person('A').longestMonologue!.messages).toBe(3);
    expect(person('A').longestMonologue!.durationMs).toBe(2 * MIN);
    expect(stats.dynamics.turns).toBe(3);
  });
});

describe('ghosting', () => {
  const ghosted: Row[] = [
    ['A', '2023-03-14 10:00', 'hi'],
    ['B', '2023-03-14 10:01', 'hey'],
    ['A', '2023-03-14 10:02', 'wanna get lunch?'],
    ['B', '2023-03-15 12:00', 'sorry!'],
    ['A', '2023-03-15 12:01', 'np'],
  ];

  it('marks a conversation-ending message without reply for 24h as ghosted', () => {
    const { person } = run(ghosted);
    expect(person('A').gotGhosted).toBe(1);
    expect(person('B').ghostedOthers).toBe(1);
    expect(person('B').ghostRate).toBe(1);
  });

  it('does not count slow replies within the threshold', () => {
    const rows = ghosted.map((r) => (r[2] === 'sorry!' ? (['B', '2023-03-14 20:00', 'sorry!'] as Row) : r));
    const { person } = run(rows.map((r) => (r[2] === 'np' ? (['A', '2023-03-14 20:01', 'np'] as Row) : r)));
    expect(person('A').gotGhosted).toBe(0);
    expect(person('B').ghostedOthers).toBe(0);
  });

  it('honours the ghosting threshold setting and skips the final conversation', () => {
    const { person } = run(ghosted, { ghostingThresholdMinutes: 48 * 60 });
    expect(person('A').gotGhosted).toBe(0);
    const last = run(ghosted.slice(0, 3));
    expect(last.person('A').gotGhosted).toBe(0);
  });
});

describe('questions, replies, revives', () => {
  it('tracks questions asked and answered', () => {
    const { person } = run([
      ['A', '2023-03-14 10:00', 'how are you?'],
      ['B', '2023-03-14 10:01', 'good, you?'],
      ['A', '2023-03-14 10:02', 'great'],
      ['A', '2023-03-14 10:03', 'dinner?'],
    ]);
    expect(person('A').questionsAsked).toBe(2);
    expect(person('A').questionsAnsweredByOthers).toBe(1);
    expect(person('B').questionsAnswered).toBe(1);
    expect(person('A').questionsAnswered).toBe(1);
    expect(person('A').questionRate).toBe(2 / 3);
  });

  it('builds a reply matrix', () => {
    const { stats } = run(alternating('2023-03-14 09:00', 6, ['A', 'B', 'C'], 1, (i) => `m${i}`));
    const ppl = stats.dynamics.matrixPeople.map((p) => stats.meta.people[p]);
    const a = ppl.indexOf('A');
    const b = ppl.indexOf('B');
    const c = ppl.indexOf('C');
    expect(stats.dynamics.replyMatrix[a]![b]).toBe(2);
    expect(stats.dynamics.replyMatrix[c]![a]).toBe(1);
  });

  it('counts revives after long silences', () => {
    const { person } = run([
      ['A', '2023-03-01 10:00', 'hi'],
      ['B', '2023-03-01 10:01', 'hey'],
      ['B', '2023-03-05 10:00', 'long time!'],
      ['A', '2023-03-05 10:01', 'haha yes'],
      ['A', '2023-03-06 10:00', 'morning'],
    ]);
    expect(person('B').revives).toBe(1);
    expect(person('A').revives).toBe(0);
  });
});

describe('effort and interest', () => {
  it('scores a perfectly symmetric duo at 50', () => {
    const rows: Row[] = [];
    for (let d = 0; d < 10; d++) {
      const order = d % 2 === 0 ? ['A', 'B'] : ['B', 'A'];
      rows.push(...alternating(`2023-03-${String(d + 1).padStart(2, '0')} 09:00`, 4, order, 3, () => 'same length text'));
    }
    const { stats } = run(rows);
    expect(stats.dynamics.effort!.score).toBeGreaterThan(45);
    expect(stats.dynamics.effort!.score).toBeLessThan(55);
  });

  it('gives more effort to the person who writes more, starts more and answers faster', () => {
    const rows: Row[] = [];
    for (let d = 1; d <= 9; d++) {
      const day = `2023-03-0${d}`;
      rows.push(['A', `${day} 10:00`, 'hey how was your day, tell me everything about it']);
      rows.push(['B', `${day} 10:30`, 'ok']);
      rows.push(['A', `${day} 10:31`, 'that sounds lovely, I had a great time at work today']);
      rows.push(['A', `${day} 10:32`, 'and the weather was amazing too']);
    }
    const { stats, person } = run(rows);
    const a = stats.meta.people.indexOf('A');
    const score = a === 0 ? stats.dynamics.effort!.score : 100 - stats.dynamics.effort!.score;
    expect(score).toBeGreaterThan(70);
    expect(person('A').initiationShare).toBe(1);
  });

  it('builds a monthly interest trend', () => {
    const rows: Row[] = [
      ['A', '2023-01-05 10:00', 'hi'],
      ['B', '2023-01-05 10:01', 'yo'],
      ['B', '2023-02-05 10:00', 'hi'],
      ['A', '2023-02-05 10:05', 'yo'],
    ];
    const { stats } = run(rows);
    const it_ = stats.dynamics.interest;
    expect(it_.months).toHaveLength(2);
    const a = stats.meta.mainPeople.indexOf(stats.meta.people.indexOf('A'));
    expect(it_.initiationShare[a]).toEqual([1, 0]);
  });
});
