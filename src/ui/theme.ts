import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

const listeners = new Set<() => void>();
let pref: ThemePref = 'system';

function systemDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function resolvedDark(): boolean {
  return pref === 'dark' || (pref === 'system' && systemDark());
}

function apply() {
  if (typeof document === 'undefined') return;
  const dark = resolvedDark();
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.dataset['theme'] = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', dark ? '#0d0c12' : '#fbf8f3');
}

export function initTheme() {
  try {
    const saved = localStorage.getItem('lor.theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved;
  } catch {
    /* ignore */
  }
  apply();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    apply();
    listeners.forEach((l) => l());
  });
}

export function setTheme(p: ThemePref) {
  pref = p;
  try {
    localStorage.setItem('lor.theme', p);
  } catch {
    /* ignore */
  }
  apply();
  listeners.forEach((l) => l());
}

export function getThemePref(): ThemePref {
  return pref;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useDark(): boolean {
  return useSyncExternalStore(subscribe, resolvedDark, () => false);
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => 'system');
}

/** Reduced motion preference (static per session is fine). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
