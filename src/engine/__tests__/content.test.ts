import { describe, expect, it } from 'vitest';
import { alternating, run, type Row } from './helpers';

describe('volume and style', () => {
  const rows: Row[] = [
    ['A', '2023-03-14 10:00', 'Hello there my friend'],
    ['B', '2023-03-14 10:01', 'hi'],
    ['A', '2023-03-14 10:02', 'WHAT IS HAPPENING'],
    ['B', '2023-03-14 10:03', 'no idea... maybe rain?'],
    ['A', '2023-03-14 10:04', 'Wow!! Amazing!'],
    ['B', '2023-03-14 10:05', 'heyyyy soooo nice'],
  ];

  it('counts messages, words, characters and shares', () => {
    const { person, stats } = run(rows);
    expect(person('A').messages).toBe(3);
    expect(person('A').words).toBe(9);
    expect(person('A').share).toBe(0.5);
    expect(person('B').words).toBe(8);
    expect(stats.meta.totalWords).toBe(17);
    expect(person('A').chars).toBe('Hello there my friend'.length + 'WHAT IS HAPPENING'.length + 'Wow!! Amazing!'.length);
  });

  it('computes average and median words per message', () => {
    const { person } = run(rows);
    expect(person('A').avgWords).toBe(3);
    expect(person('A').medianWords).toBe(3);
    expect(person('B').avgWords).toBeCloseTo(8 / 3);
  });

  it('finds the longest message', () => {
    const { person, stats } = run(rows);
    expect(person('A').longestMessage!.text).toBe('Hello there my friend');
    expect(stats.words.longestMessage!.words).toBe(4);
  });

  it('measures caps, exclamations, questions and ellipses', () => {
    const { person } = run(rows);
    expect(person('A').capsRate).toBeCloseTo(1 / 3);
    expect(person('A').exclamationRate).toBeCloseTo(1 / 3);
    expect(person('A').exclamationsPerMessage).toBe(1);
    expect(person('B').questionRate).toBeCloseTo(1 / 3);
    expect(person('B').ellipsisRate).toBeCloseTo(1 / 3);
  });

  it('measures lowercase-only messages and elongations', () => {
    const { person } = run(rows);
    // "hi" has fewer than 3 letters, so only 2 of B's 3 messages qualify
    expect(person('B').lowercaseRate).toBeCloseTo(2 / 3);
    expect(person('B').elongations).toBe(1);
    expect(person('B').elongationExamples).toEqual(expect.arrayContaining(['heyyyy']));
    expect(person('A').lowercaseRate).toBe(0);
  });

  it('computes vocabulary, unique-word ratio and word length', () => {
    const { person } = run([
      ['A', '2023-03-14 10:00', 'cat cat cat dog'],
      ['B', '2023-03-14 10:01', 'bird'],
    ]);
    expect(person('A').vocabulary).toBe(2);
    expect(person('A').uniqueWordRatio).toBe(0.5);
    expect(person('A').avgWordLength).toBe(3);
  });

  it('computes length-independent lexical richness only with enough words', () => {
    const small = run([
      ['A', '2023-03-14 10:00', 'just a few words'],
      ['B', '2023-03-14 10:01', 'ok'],
    ]);
    expect(small.person('A').lexicalRichness).toBeNull();
    const words = Array.from({ length: 1200 }, (_, i) => `w${i % 300}`);
    const rows2: Row[] = [];
    for (let i = 0; i < 40; i++) rows2.push(['A', `2023-03-14 10:${String(i).padStart(2, '0')}`, words.slice(i * 30, i * 30 + 30).join(' ')]);
    rows2.push(['B', '2023-03-14 11:00', 'ok']);
    const big = run(rows2);
    expect(big.person('A').lexicalRichness).toBe(300);
  });
});

describe('media', () => {
  const rows: Row[] = [
    ['A', '2023-03-14 10:00', '<Media omitted>'],
    ['A', '2023-03-14 10:01', 'IMG-20230314-WA0001.jpg (file attached)'],
    ['B', '2023-03-14 10:02', 'PTT-20230314-WA0002.opus (file attached)'],
    ['B', '2023-03-14 10:03', 'STK-20230314-WA0003.webp (file attached)'],
    ['A', '2023-03-14 10:04', 'check https://www.youtube.com/watch?v=1 and https://youtu.be/x'],
    ['B', '2023-03-14 10:05', 'https://youtube.com/shorts/2'],
    ['A', '2023-03-14 10:06', 'This message was deleted'],
    ['B', '2023-03-14 10:07', 'see you at 8 <This message was edited>'],
    ['A', '2023-03-14 10:08', 'Missed voice call'],
    ['B', '2023-03-14 10:09', 'location: https://maps.google.com/?q=1,2'],
  ];

  it('counts media by type and person', () => {
    const { person, stats } = run(rows);
    expect(person('A').media.media).toBe(1);
    expect(person('A').media.image).toBe(1);
    expect(person('B').media.audio).toBe(1);
    expect(person('B').media.sticker).toBe(1);
    expect(person('B').media.location).toBe(1);
    expect(stats.media.total).toBe(5);
    expect(stats.meta.unknownMediaShare).toBeCloseTo(0.2);
  });

  it('counts links and top domains', () => {
    const { person, stats } = run(rows);
    expect(person('A').links).toBe(2);
    expect(stats.media.links.total).toBe(3);
    expect(stats.media.links.topDomains[0]).toEqual({ key: 'youtube.com', count: 2 });
  });

  it('counts deleted, edited and calls', () => {
    const { person, stats } = run(rows);
    expect(person('A').deleted).toBe(1);
    expect(person('B').edited).toBe(1);
    expect(person('A').calls).toBe(1);
    expect(person('A').missedCalls).toBe(1);
    expect(stats.media.calls.missed).toBe(1);
  });

  it('can exclude media from the analysis', () => {
    const { stats, person } = run(rows, { includeMedia: false });
    expect(stats.media.total).toBe(0);
    expect(person('A').messages).toBe(3);
    expect(stats.meta.excludedMessages).toBe(5);
  });
});

describe('emojis', () => {
  const rows: Row[] = [
    ['A', '2023-03-14 10:00', '😂😂😂 so funny'],
    ['B', '2023-03-14 10:01', '❤️❤️ love you'],
    ['A', '2023-03-14 10:02', '👍🏽 ok 😂'],
    ['B', '2023-03-14 10:03', '💙 💔 💚'],
  ];

  it('ranks emojis and counts per person', () => {
    const { stats, person } = run(rows);
    expect(stats.emojis.top[0]!.key).toBe('😂');
    expect(stats.emojis.top[0]!.count).toBe(4);
    expect(stats.emojis.total).toBe(10);
    expect(person('A').emojis).toBe(5);
    expect(person('A').emojisPerMessage).toBe(2.5);
    expect(person('B').topEmojis[0]).toEqual({ key: '❤️', count: 2 });
  });

  it('tracks skin tones and heart colours', () => {
    const { stats } = run(rows);
    expect(stats.emojis.skinTones[3]).toBe(1);
    const colors = Object.fromEntries(stats.emojis.hearts.map((h) => [h.color, h.count]));
    expect(colors).toMatchObject({ red: 2, blue: 1, green: 1, broken: 1 });
  });

  it('finds signature emojis with log-odds', () => {
    const many: Row[] = [];
    for (let i = 0; i < 30; i++) {
      many.push(['A', `2023-03-${String(1 + (i % 28)).padStart(2, '0')} 10:${String(i).padStart(2, '0')}`, '🔥 nice 😊']);
      many.push(['B', `2023-03-${String(1 + (i % 28)).padStart(2, '0')} 11:${String(i).padStart(2, '0')}`, '🌸 nice 😊']);
    }
    const { person } = run(many);
    expect(person('A').signatureEmoji!.key).toBe('🔥');
    expect(person('B').signatureEmoji!.key).toBe('🌸');
  });
});

describe('words', () => {
  it('ranks top words without stopwords and honours custom stopwords', () => {
    const rows: Row[] = [
      ['A', '2023-03-14 10:00', 'the pizza is the best pizza'],
      ['B', '2023-03-14 10:01', 'pizza tonight and the movie'],
      ['A', '2023-03-14 10:02', 'movie and pizza'],
    ];
    const { stats } = run(rows);
    expect(stats.words.topWords[0]).toMatchObject({ key: 'pizza', count: 4 });
    expect(stats.words.topWords.find((w) => w.key === 'the')).toBeUndefined();
    const custom = run(rows, { stopwords: ['pizza'] });
    expect(custom.stats.words.topWords[0]!.key).toBe('movie');
  });

  it('finds top bigrams and trigrams', () => {
    const rows: Row[] = alternating('2023-03-14 10:00', 6, ['A', 'B'], 1, () => 'ice cream truck tonight');
    const { stats } = run(rows);
    expect(stats.words.topBigrams.map((b) => b.key)).toContain('ice cream');
    expect(stats.words.topTrigrams[0]!.key).toBe('ice cream truck');
    expect(stats.words.topTrigrams[0]!.count).toBe(6);
  });

  it('computes signature words with a Dirichlet prior', () => {
    const rows: Row[] = [];
    for (let i = 0; i < 60; i++) {
      const day = `2023-03-${String(1 + (i % 28)).padStart(2, '0')}`;
      const mm = String(i % 60).padStart(2, '0');
      rows.push(['A', `${day} 1${i % 10}:${mm}`, 'pizza is great today friend']);
      rows.push(['B', `${day} 0${i % 10}:${mm}`, 'sushi is great today friend']);
    }
    const { person } = run(rows);
    expect(person('A').signatureWords[0]!.key).toBe('pizza');
    expect(person('B').signatureWords[0]!.key).toBe('sushi');
    expect(person('A').signatureWords.find((w) => w.key === 'great')).toBeUndefined();
  });

  it('detects catchphrases one person says far more', () => {
    const rows: Row[] = [];
    for (let i = 0; i < 12; i++) {
      rows.push(['A', `2023-03-${String(1 + i).padStart(2, '0')} 10:00`, 'you know what, let us go']);
      rows.push(['B', `2023-03-${String(1 + i).padStart(2, '0')} 10:01`, 'sounds good to me']);
    }
    const { person } = run(rows);
    expect(person('A').catchphrases.map((c) => c.key).join('|')).toContain('you know what');
    expect(person('A').catchphrases[0]!.share).toBe(1);
  });

  it('counts English and Dutch swear words, including compounds', () => {
    const { person, stats } = run([
      ['A', '2023-03-14 10:00', 'fuck this shit'],
      ['B', '2023-03-14 10:01', 'wat een kutweer, tering'],
      ['A', '2023-03-14 10:02', 'classic'],
    ]);
    expect(person('A').swears).toBe(2);
    expect(person('B').swears).toBe(2);
    expect(stats.words.swears.total).toBe(4);
  });

  it('counts greetings, goodbyes, apologies and declarations of love', () => {
    const { person, stats } = run([
      ['A', '2023-03-14 08:00', 'Good morning sunshine'],
      ['B', '2023-03-14 08:01', 'hoi! sorry for yesterday'],
      ['A', '2023-03-14 08:02', 'no worries, love you'],
      ['B', '2023-03-14 23:00', 'ik hou van je, welterusten'],
      ['A', '2023-03-14 23:01', 'night!'],
    ]);
    expect(person('A').greetings).toBe(1);
    expect(person('B').greetings).toBe(1);
    expect(person('B').apologies).toBe(1);
    expect(person('A').loveYous).toBe(1);
    expect(person('B').loveYous).toBe(1);
    expect(person('A').goodbyes).toBe(1);
    expect(stats.words.greetings.length).toBeGreaterThan(0);
  });
});

describe('laughter', () => {
  it('recognizes laugh variants', () => {
    const { person, stats } = run([
      ['A', '2023-03-14 10:00', 'hahaha'],
      ['A', '2023-03-14 10:01', 'LOL'],
      ['A', '2023-03-14 10:02', 'hihi'],
      ['A', '2023-03-14 10:03', 'lmaooo'],
      ['A', '2023-03-14 10:04', '💀'],
      ['A', '2023-03-14 10:05', 'aha I see'],
      ['B', '2023-03-14 10:06', 'ok'],
    ]);
    expect(person('A').laughs).toBe(5);
    expect(stats.laughter.kinds.map((k) => k.key)).toEqual(expect.arrayContaining(['haha', 'lol', 'hihi', 'lmao', '💀']));
  });

  it('credits The Comedian with the message before someone else laughs', () => {
    const { person, stats } = run([
      ['A', '2023-03-14 10:00', 'why did the chicken cross the road'],
      ['B', '2023-03-14 10:01', 'hahaha'],
      ['C', '2023-03-14 10:02', '😂😂'],
      ['B', '2023-03-14 10:03', 'ok my turn: knock knock'],
      ['B', '2023-03-14 10:04', 'haha I crack myself up'],
    ]);
    expect(person('A').laughsTriggered).toBe(2);
    expect(person('B').laughsTriggered).toBe(0);
    expect(stats.laughter.comedian).toBe(stats.meta.people.indexOf('A'));
    expect(stats.laughter.bestJokes[0]!.text).toContain('chicken');
  });
});
