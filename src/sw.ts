/// <reference lib="webworker" />
/**
 * Service worker: precaches the whole app (works fully offline, e.g. in
 * airplane mode) and implements the Android Web Share Target. When a chat
 * export is shared to the installed app, the browser POSTs it here; we keep it
 * in Cache Storage and redirect to the app, which reads it locally. Nothing is
 * ever sent anywhere.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

const SHARE_CACHE = 'lor-share-target';
const scope = new URL(self.registration.scope);
const base = scope.pathname.endsWith('/') ? scope.pathname : `${scope.pathname}/`;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== `${base}share-target`) return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const file = form.get('chat');
        const text = form.get('text');
        const cache = await caches.open(SHARE_CACHE);
        if (file instanceof File && file.size > 0) {
          await cache.put(`${base}__shared-file`, new Response(file, { headers: { 'x-file-name': encodeURIComponent(file.name || 'shared.txt') } }));
        } else if (typeof text === 'string' && text.trim()) {
          await cache.put(`${base}__shared-file`, new Response(new Blob([text], { type: 'text/plain' }), { headers: { 'x-file-name': 'shared.txt' } }));
        }
      } catch {
        /* fall through to the app */
      }
      return Response.redirect(`${base}?shared=1`, 303);
    })(),
  );
});

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// App views live in the URL hash, so every navigation inside the scope can be
// answered with the prerendered page for that path (or index.html).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${base}index.html`), {
    denylist: [/\/privacy\/?$/, /\/how-it-works\/?$/],
  }),
);
