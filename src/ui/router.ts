/**
 * Minimal router. Static pages live at real paths (prerendered): `/`,
 * `/privacy/`, `/how-it-works/`. App views live in the hash (`#/story`,
 * `#/dashboard/words`, `#/person/2`, `#/compare`) because the data only
 * exists in memory anyway.
 */
import { useSyncExternalStore } from 'react';

export type Page = 'home' | 'privacy' | 'how';
export type View = 'home' | 'story' | 'dashboard' | 'person' | 'compare';

export interface Route {
  page: Page;
  view: View;
  section: string | null;
  personId: number | null;
}

export const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

export function pageFromPath(pathname: string): Page {
  const rel = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
  if (/^privacy\/?$/.test(rel)) return 'privacy';
  if (/^how-it-works\/?$/.test(rel)) return 'how';
  return 'home';
}

export function parseRoute(pathname: string, hash: string): Route {
  const page = pageFromPath(pathname);
  const h = hash.replace(/^#\/?/, '');
  const [view, arg] = h.split('/');
  if (view === 'story') return { page, view: 'story', section: null, personId: null };
  if (view === 'dashboard') return { page, view: 'dashboard', section: arg || null, personId: null };
  if (view === 'person' && arg !== undefined && /^\d+$/.test(arg)) return { page, view: 'person', section: null, personId: Number(arg) };
  if (view === 'compare') return { page, view: 'compare', section: null, personId: null };
  return { page, view: 'home', section: null, personId: null };
}

let ssrRoute: Route = { page: 'home', view: 'home', section: null, personId: null };
export function setSsrRoute(r: Route) {
  ssrRoute = r;
}

let cached: Route | null = null;
let cachedKey = '';
function snapshot(): Route {
  const key = `${location.pathname}${location.hash}`;
  if (!cached || key !== cachedKey) {
    cachedKey = key;
    cached = parseRoute(location.pathname, location.hash);
  }
  return cached;
}
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
};

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, () => ssrRoute);
}

/** Navigate to an app view inside the home page. */
export function go(view: View, arg?: string | number, replace = false) {
  const hash = view === 'home' ? '' : `#/${view}${arg !== undefined && arg !== null && arg !== '' ? `/${arg}` : ''}`;
  const target = `${BASE}${hash}`;
  if (location.pathname !== BASE && pageFromPath(location.pathname) !== 'home') {
    location.href = target;
    return;
  }
  if (replace) history.replaceState(null, '', target);
  else history.pushState(null, '', target);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  window.scrollTo({ top: 0 });
}

export const href = {
  home: () => BASE,
  privacy: () => `${BASE}privacy/`,
  how: () => `${BASE}how-it-works/`,
};
