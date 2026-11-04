import { describe, expect, it } from 'vitest';
import { ChatParseError, parseChat } from '../index';

const LRM = '‎';
const NNBSP = ' ';

function utc(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

describe('header formats', () => {
  it('parses iOS DD/MM/YYYY 24h with seconds', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] Sarah: Morning!
[14/03/2023, 09:16:45] Tom: Hey you`);
    expect(r.platform).toBe('ios');
    expect(r.dateOrder).toBe('DMY');
    expect(r.timeFormat).toBe('24h');
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]).toMatchObject({ author: 'Sarah', text: 'Morning!', type: 'text', timestamp: utc(2023, 3, 14, 9, 15, 2) });
    expect(r.messages[1]!.timestamp).toBe(utc(2023, 3, 14, 9, 16, 45));
  });

  it('parses Android DD/MM/YYYY 24h without seconds', () => {
    const r = parseChat(`14/03/2023, 09:15 - Sarah: Morning!
14/03/2023, 09:16 - Tom: Hey you`);
    expect(r.platform).toBe('android');
    expect(r.messages[0]).toMatchObject({ author: 'Sarah', text: 'Morning!', timestamp: utc(2023, 3, 14, 9, 15) });
  });

  it('parses iOS US M/D/YY 12h with narrow no-break space before PM', () => {
    const r = parseChat(`[3/14/23, 9:15:02${NNBSP}PM] Sarah: Evening!
[3/15/23, 12:01:00${NNBSP}AM] Tom: Past midnight`);
    expect(r.dateOrder).toBe('MDY');
    expect(r.timeFormat).toBe('12h');
    expect(r.messages[0]!.timestamp).toBe(utc(2023, 3, 14, 21, 15, 2));
    expect(r.messages[1]!.timestamp).toBe(utc(2023, 3, 15, 0, 1, 0));
  });

  it('parses Android US M/D/YY 12h', () => {
    const r = parseChat(`3/14/23, 9:15${NNBSP}PM - Sarah: Evening!
3/15/23, 12:30${NNBSP}PM - Tom: Lunch?`);
    expect(r.platform).toBe('android');
    expect(r.dateOrder).toBe('MDY');
    expect(r.messages[0]!.timestamp).toBe(utc(2023, 3, 14, 21, 15));
    expect(r.messages[1]!.timestamp).toBe(utc(2023, 3, 15, 12, 30));
  });

  it('handles a.m./p.m. and Spanish "p. m." markers', () => {
    const r = parseChat(`15/3/23, 9:05 a.m. - Ana: Hola
15/3/23, 9:07 p. m. - Luis: Buenas noches
15/3/23, 11:59 P.M. - Ana: Chao`);
    expect(r.messages.map((m) => new Date(m.timestamp).getUTCHours())).toEqual([9, 21, 23]);
  });

  it('parses ISO YYYY-MM-DD dates', () => {
    const r = parseChat(`[2023-03-14, 09:15:02] Sarah: ISO style
[2023-03-15, 10:00:00] Tom: Nice`);
    expect(r.dateOrder).toBe('YMD');
    expect(r.messages[1]!.timestamp).toBe(utc(2023, 3, 15, 10));
  });

  it('parses dotted dates with 2-digit years (German Android)', () => {
    const r = parseChat(`14.03.23, 09:15 - Lena: Guten Morgen
14.03.23, 09:20 - Jonas: Moin`);
    expect(r.dateOrder).toBe('DMY');
    expect(r.messages[0]!.timestamp).toBe(utc(2023, 3, 14, 9, 15));
  });

  it('parses dashed dates', () => {
    const r = parseChat(`[14-03-2023 09:15:02] Sarah: dashes
[15-03-2023 09:15:02] Tom: and no comma`);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[1]!.timestamp).toBe(utc(2023, 3, 15, 9, 15, 2));
  });

  it('detects MM/DD when the second component exceeds 12', () => {
    const r = parseChat(`01/02/2023, 10:00 - A: one
01/25/2023, 10:00 - B: two`);
    expect(r.dateOrder).toBe('MDY');
  });

  it('resolves ambiguous dates using chronological order', () => {
    // Under DMY these dates go 1 Feb, 1 Mar, 1 Apr (monotonic); under MDY: Jan 2, Jan 3, Jan 4 — also monotonic,
    // so we add a sequence that only works as DMY: 12/01 then 01/02 (12 Jan → 1 Feb) vs MDY (Dec 1 → Jan 2 backwards).
    const r = parseChat(`12/01/2023, 10:00 - A: hi
01/02/2023, 10:00 - B: hey
05/02/2023, 10:00 - A: yo
02/03/2023, 10:00 - B: sup`);
    expect(r.dateOrder).toBe('DMY');
    expect(r.warnings.some((w) => w.code === 'AMBIGUOUS_DATE_ORDER')).toBe(true);
  });

  it('falls back to MDY for fully ambiguous 12h exports and DMY for 24h', () => {
    const twelve = parseChat(`1/2/23, 10:00${NNBSP}AM - A: hi\n1/2/23, 10:05${NNBSP}AM - B: hey`);
    expect(twelve.dateOrder).toBe('MDY');
    const tf = parseChat(`1/2/23, 10:00 - A: hi\n1/2/23, 10:05 - B: hey`);
    expect(tf.dateOrder).toBe('DMY');
  });

  it('respects a forced date order', () => {
    const r = parseChat(`01/02/2023, 10:00 - A: hi\n01/02/2023, 10:05 - B: hey`, { dateOrder: 'MDY' });
    expect(new Date(r.messages[0]!.timestamp).getUTCMonth()).toBe(0);
    expect(new Date(r.messages[0]!.timestamp).getUTCDate()).toBe(2);
  });

  it('converts 12 AM to 00h and 12 PM to 12h', () => {
    const r = parseChat(`[1/20/24, 12:00:00 AM] A: midnight\n[1/20/24, 12:00:00 PM] B: noon`);
    expect(new Date(r.messages[0]!.timestamp).getUTCHours()).toBe(0);
    expect(new Date(r.messages[1]!.timestamp).getUTCHours()).toBe(12);
  });

  it('handles Windows line endings', () => {
    const r = parseChat('14/03/2023, 09:15 - Sarah: one\r\n14/03/2023, 09:16 - Tom: two\r\nsecond line\r\n');
    expect(r.messages).toHaveLength(2);
    expect(r.messages[1]!.text).toBe('two\nsecond line');
  });

  it('treats lines with impossible dates as continuation text', () => {
    const r = parseChat(`14/03/2023, 09:15 - Sarah: Notes:
31/02/2023, 10:00 - this is not a real date
14/03/2023, 09:16 - Tom: ok`);
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]!.text).toContain('31/02/2023');
  });

  it('sorts out-of-order messages and reassigns ids', () => {
    const r = parseChat(`14/03/2023, 09:20 - A: late
14/03/2023, 09:15 - B: early
14/03/2023, 09:25 - A: later`);
    expect(r.messages.map((m) => m.text)).toEqual(['early', 'late', 'later']);
    expect(r.messages.map((m) => m.id)).toEqual([0, 1, 2]);
  });

  it('reports progress', () => {
    const calls: number[] = [];
    parseChat(`14/03/2023, 09:15 - A: hi\n14/03/2023, 09:16 - B: yo`, { onProgress: (f) => calls.push(f) });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBe(1);
  });
});

describe('text cleanup', () => {
  it('strips LRM before the iOS bracket and inside media lines', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] Sarah: Hi
${LRM}[14/03/2023, 09:16:00] Tom: ${LRM}image omitted`);
    expect(r.messages[1]).toMatchObject({ author: 'Tom', type: 'image', text: '' });
  });

  it('removes BOM, RLM and bidi embeddings', () => {
    const r = parseChat(`﻿14/03/2023, 09:15 - ‪+31 6 12345678‬: Hoi ‏daar‎
14/03/2023, 09:16 - Tom: ok`);
    expect(r.messages[0]!.author).toBe('+31 6 12345678');
    expect(r.messages[0]!.text).toBe('Hoi daar');
  });

  it('joins multi-line messages', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] Sarah: Shopping list:
- milk
- eggs

- coffee!!
[14/03/2023, 09:20:00] Tom: 👍`);
    expect(r.messages[0]!.text).toBe('Shopping list:\n- milk\n- eggs\n\n- coffee!!');
    expect(r.messages[1]!.emojis).toEqual(['👍']);
  });

  it('ignores junk before the first header', () => {
    const r = parseChat(`\n\nSome export preamble\n14/03/2023, 09:15 - A: hi\n14/03/2023, 09:16 - B: yo`);
    expect(r.messages).toHaveLength(2);
  });
});

describe('authors', () => {
  it('keeps phone-number authors', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] ‪+44 7700 900123‬: Who is this?
[14/03/2023, 09:16:00] Sarah: It's me`);
    expect(r.participants).toContain('+44 7700 900123');
  });

  it('supports authors containing a colon', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] Dr: Who: Hello there
[14/03/2023, 09:16:00] Sarah: Hi doctor
[14/03/2023, 09:17:00] Dr: Who: How are you?
[14/03/2023, 09:18:00] Dr: Who: ${LRM}image omitted`);
    expect(r.participants).toContain('Dr: Who');
    const dr = r.messages.filter((m) => m.author === 'Dr: Who');
    expect(dr.map((m) => m.text)).toEqual(['Hello there', 'How are you?', '']);
    expect(dr[2]!.type).toBe('image');
  });

  it('supports emoji and non-Latin author names', () => {
    const r = parseChat(`14/03/2023, 09:15 - Мария 🌸: Привет!
14/03/2023, 09:16 - 田中太郎: こんにちは
14/03/2023, 09:17 - محمد: مرحبا
14/03/2023, 09:18 - Zoë 💖✨: hi`);
    expect(r.participants.sort()).toEqual(['Zoë 💖✨', 'Мария 🌸', 'محمد', '田中太郎'].sort());
    expect(r.messages[1]!.text).toBe('こんにちは');
  });

  it('strips the "~ " prefix of unsaved contacts', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] ~${NNBSP}Lisa: hi all
[14/03/2023, 09:16:00] Sarah: welcome`);
    expect(r.participants).toContain('Lisa');
  });

  it('detects the exporting user labelled "You"', () => {
    const r = parseChat(`14/03/2023, 09:15 - You: hey
14/03/2023, 09:16 - Sarah: hi!`);
    expect(r.selfAuthor).toBe('You');
    expect(r.participants).toContain('You');
  });

  it('keeps Android messages whose text resembles a system message', () => {
    const r = parseChat(`14/03/2023, 09:15 - Tom: Sarah added Mark to the list
14/03/2023, 09:16 - Tom: and Lisa left early
14/03/2023, 09:17 - Sarah: ok`);
    expect(r.messages.every((m) => m.type === 'text')).toBe(true);
    expect(r.messages[0]!.author).toBe('Tom');
  });

  it('keeps iOS messages that look like system text without the LRM marker', () => {
    const r = parseChat(`[14/03/2023, 09:15:02] Grp: ${LRM}Sarah created this group
[14/03/2023, 09:16:00] Tom: Sarah added Mark to the shopping list
[14/03/2023, 09:17:00] Sarah: yes`);
    expect(r.messages.filter((m) => m.type === 'text')).toHaveLength(2);
    expect(r.messages[0]!.type).toBe('system');
  });
});

describe('errors', () => {
  it('throws EMPTY for empty input', () => {
    expect(() => parseChat('   \n  ')).toThrowError(ChatParseError);
    try {
      parseChat('');
    } catch (e) {
      expect((e as ChatParseError).code).toBe('EMPTY');
    }
  });

  it('throws UNRECOGNIZED_FORMAT for random text', () => {
    try {
      parseChat('Dear diary,\ntoday I went to the beach.\nIt was lovely.');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ChatParseError);
      expect((e as ChatParseError).code).toBe('UNRECOGNIZED_FORMAT');
    }
  });

  it('throws NO_MESSAGES when only system messages exist', () => {
    try {
      parseChat(`14/03/2023, 09:15 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.`);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as ChatParseError).code).toBe('NO_MESSAGES');
    }
  });
});
