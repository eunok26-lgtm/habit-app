/**
 * 항상 최신을 먼저 받아오고, 인터넷이 없을 때만 저장해둔 걸 씁니다.
 * 이렇게 해야 코드를 고쳐 올렸을 때 아이패드에서도 바로 반영됩니다.
 */
const CACHE = 'habit-app-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 구글 캘린더(앱스 스크립트) 요청은 건드리지 않습니다
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
