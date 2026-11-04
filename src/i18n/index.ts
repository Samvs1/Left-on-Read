/**
 * Tiny typed i18n: nested dictionaries, `{param}` interpolation and
 * "one|other" plural forms chosen with Intl.PluralRules.
 */
import { useSyncExternalStore } from 'react';
import { en } from './en';

export type Lang = 'en' | 'nl';
export type Dict = typeof en;

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dict>;
export type TParams = Record<string, string | number>;

/** English ships in the main bundle; Dutch is loaded on demand. */
const DICTS: Partial<Record<Lang, Dict>> = { en };

export async function ensureLang(lang: Lang): Promise<void> {
  if (DICTS[lang]) return;
  if (lang === 'nl') DICTS.nl = (await import('./nl')).nl;
}
const LOCALES: Record<Lang, string> = { en: 'en-GB', nl: 'nl-NL' };

let current: Lang = 'en';
const listeners = new Set<() => void>();

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem('lor.lang');
    if (saved === 'en' || saved === 'nl') return saved;
  } catch {
    /* storage unavailable */
  }
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      if (/^nl\b/i.test(l)) return 'nl';
      if (/^en\b/i.test(l)) return 'en';
    }
  }
  return 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang, persist = true): void {
  if (lang === current) return;
  if (!DICTS[lang]) {
    // Load the dictionary first, then switch (no flash of untranslated keys).
    void ensureLang(lang).then(() => setLang(lang, persist));
    return;
  }
  current = lang;
  if (persist) {
    try {
      localStorage.setItem('lor.lang', lang);
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function locale(lang: Lang = current): string {
  if (lang === 'en' && typeof navigator !== 'undefined' && /^en-(US|CA|PH)$/i.test(navigator.language)) return navigator.language;
  return LOCALES[lang];
}

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object') node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

const pluralCache = new Map<string, Intl.PluralRules>();
function plural(lang: Lang, n: number): Intl.LDMLPluralRule {
  let pr = pluralCache.get(lang);
  if (!pr) {
    pr = new Intl.PluralRules(LOCALES[lang]);
    pluralCache.set(lang, pr);
  }
  return pr.select(n);
}

/**
 * The number that picks the plural form. Callers usually pass an already
 * formatted string ("1,234" / "1.234"), so undo the locale's grouping first:
 * otherwise Dutch "1.000" would read as one and pick the singular.
 */
function pluralCount(lang: Lang, params?: TParams): number {
  const c = params?.['count'] ?? params?.['n'];
  if (typeof c === 'number') return c;
  if (typeof c !== 'string') return 0;
  const norm = lang === 'nl' ? c.replace(/\./g, '').replace(',', '.') : c.replace(/,/g, '');
  const v = parseFloat(norm.replace(/[^\d.-]/g, ''));
  return Number.isFinite(v) ? v : 0;
}

export function translate(lang: Lang, key: TKey | string, params?: TParams): string {
  let s = lookup(DICTS[lang] ?? en, key) ?? lookup(en, key) ?? key;
  if (s.includes('|')) {
    const forms = s.split('|');
    s = (plural(lang, pluralCount(lang, params)) === 'one' ? forms[0] : forms[forms.length - 1]) ?? s;
  }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] !== undefined ? String(params[k]) : m));
  return s;
}

export function t(key: TKey, params?: TParams): string {
  return translate(current, key, params);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: re-renders on language change. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'en');
}

export function useT(): (key: TKey, params?: TParams) => string {
  const lang = useLang();
  return (key, params) => translate(lang, key, params);
}

/** Raw dictionary access for lists (e.g. rotating loading messages). */
export function dict(lang: Lang = current): Dict {
  return DICTS[lang] ?? en;
}
