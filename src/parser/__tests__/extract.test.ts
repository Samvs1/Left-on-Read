import { describe, expect, it } from 'vitest';
import { emojiDisplay, emojiKey, emojiSkinTone, extractEmojis, extractLinks, extractMentions, linkDomain, parseChat, titleFromFileName } from '../index';

describe('links', () => {
  it('extracts links and trims trailing punctuation', () => {
    expect(extractLinks('Look: https://example.com/a?b=1. And www.test.nl!')).toEqual(['https://example.com/a?b=1', 'www.test.nl']);
    expect(extractLinks('(see https://en.wikipedia.org/wiki/Foo_(bar))')).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
    expect(extractLinks('no links here')).toEqual([]);
  });

  it('computes link domains', () => {
    expect(linkDomain('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(linkDomain('www.nos.nl/artikel')).toBe('nos.nl');
    expect(linkDomain('https://m.facebook.com/x')).toBe('facebook.com');
  });
});

describe('emojis', () => {
  it('extracts simple, ZWJ, skin-tone, flag and keycap emojis', () => {
    expect(extractEmojis('haha 😂😂 love ❤️ and 👍🏽')).toEqual(['😂', '😂', '❤️', '👍🏽']);
    expect(extractEmojis('family 👨‍👩‍👧‍👦 coder 👩🏻‍💻')).toEqual(['👨‍👩‍👧‍👦', '👩🏻‍💻']);
    expect(extractEmojis('🇳🇱 vs 🇧🇪 at 1️⃣')).toEqual(['🇳🇱', '🇧🇪', '1️⃣']);
    expect(extractEmojis('heart on fire ❤️‍🔥')).toEqual(['❤️‍🔥']);
  });

  it('ignores text symbols such as © and ™', () => {
    expect(extractEmojis('© 2024 Brand™ 123 #hashtag')).toEqual([]);
  });

  it('normalizes keys, skin tones and display forms', () => {
    expect(emojiKey('👍🏽')).toBe('👍');
    expect(emojiKey('❤️')).toBe('❤');
    expect(emojiSkinTone('👍🏽')).toBe(3);
    expect(emojiSkinTone('👍')).toBe(0);
    expect(emojiDisplay('❤')).toBe('❤️');
    expect(emojiDisplay('😂')).toBe('😂');
  });
});

describe('mentions', () => {
  it('extracts isolate-wrapped names, phone numbers and plain handles', () => {
    expect(extractMentions('Hey @⁨Sarah Jones⁩ and @31612345678!')).toEqual(['Sarah Jones', '31612345678']);
    expect(extractMentions('cc @Tom')).toEqual(['Tom']);
    expect(extractMentions('mail me at sam@example.com')).toEqual([]);
  });

  it('attaches mentions to parsed messages', () => {
    const r = parseChat('14/03/2023, 10:00 - Sarah: @⁨Tom⁩ are you coming?\n14/03/2023, 10:01 - Tom: yes');
    expect(r.messages[0]!.mentions).toEqual(['Tom']);
    expect(r.messages[0]!.text).toBe('@Tom are you coming?');
  });
});

describe('file names', () => {
  it('derives titles from export file names', () => {
    expect(titleFromFileName('WhatsApp Chat with Sarah.txt')).toBe('Sarah');
    expect(titleFromFileName('WhatsApp Chat - Weekend Crew.zip')).toBe('Weekend Crew');
    expect(titleFromFileName('WhatsApp-chat met Noor (2).txt')).toBe('Noor');
    expect(titleFromFileName('WhatsApp Chat mit Lena.txt')).toBe('Lena');
    expect(titleFromFileName('_chat.txt')).toBeNull();
  });
});
