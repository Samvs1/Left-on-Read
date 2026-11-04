import { beforeAll, describe, expect, it } from 'vitest';
import { en } from '../en';
import { ensureLang, translate } from '../index';

type Tree = { [k: string]: string | Tree };

function keys(t: Tree, prefix = ''): string[] {
  return Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
}

describe('i18n', () => {
  let nl: Tree;
  beforeAll(async () => {
    await ensureLang('nl');
    nl = (await import('../nl')).nl as unknown as Tree;
  });

  it('interpolates parameters', () => {
    expect(translate('en', 'story.introDuo')).toBe('This is your chat with');
    expect(translate('en', 'dash.filtered', { range: 'A – B' })).toContain('A – B');
  });

  it('picks singular and plural forms from numbers and formatted strings', () => {
    expect(translate('en', 'common.days', { n: 1 })).toBe('1 day');
    expect(translate('en', 'common.days', { n: '1' })).toBe('1 day');
    expect(translate('en', 'common.days', { n: '2' })).toBe('2 days');
    expect(translate('en', 'common.messages', { n: '1,000' })).toBe('1,000 messages');
    expect(translate('nl', 'common.messages', { n: '1' })).toBe('1 bericht');
    // Dutch groups thousands with a dot: "1.000" is a thousand, not one.
    expect(translate('nl', 'common.messages', { n: '1.000' })).toBe('1.000 berichten');
    expect(translate('nl', 'common.days', { n: '1,5' })).toBe('1,5 dagen');
    expect(translate('nl', 'common.messages', { n: '10,7K' })).toBe('10,7K berichten');
  });

  it('Dutch covers every English key with the same placeholders', () => {
    const missing: string[] = [];
    const mismatched: string[] = [];
    const lookup = (t: Tree, path: string) => path.split('.').reduce<string | Tree | undefined>((node, k) => (node && typeof node === 'object' ? node[k] : undefined), t);
    for (const key of keys(en as unknown as Tree)) {
      const e = lookup(en as unknown as Tree, key) as string;
      const n = lookup(nl, key);
      if (typeof n !== 'string') {
        missing.push(key);
        continue;
      }
      const params = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(',');
      if (params(e) !== params(n)) mismatched.push(key);
    }
    expect(missing).toEqual([]);
    expect(mismatched).toEqual([]);
  });
});
