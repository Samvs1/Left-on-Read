/**
 * Service worker registration (offline support) and the Android share-target
 * hand-off: the service worker stores a shared export in Cache Storage and
 * redirects here with ?shared=1, we pick the file up locally. Reading Cache
 * Storage is local and not a network request.
 */
import { loadFile } from './store';
import { BASE } from './router';

export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => undefined);
  });
}

export async function consumeSharedFile(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (!params.has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', `${BASE}${location.hash}`);
  try {
    const cache = await caches.open('lor-share-target');
    const res = await cache.match(`${BASE}__shared-file`);
    if (!res) return;
    const name = decodeURIComponent(res.headers.get('x-file-name') ?? 'shared.txt');
    const blob = await res.blob();
    await cache.delete(`${BASE}__shared-file`);
    await loadFile(blob, name);
  } catch {
    /* ignore */
  }
}
