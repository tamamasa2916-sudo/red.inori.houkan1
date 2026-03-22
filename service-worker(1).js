/* ============================================================
   訪問看護 保険計算 統合版 — Service Worker
   キャッシュ戦略: Cache First（オフライン完全対応）
   ============================================================ */

const CACHE_NAME  = 'vnCalc-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

/* ── インストール: 全アセットをキャッシュ ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] キャッシュ失敗:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── アクティベート: 古いキャッシュを削除 ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 古いキャッシュを削除:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── フェッチ: Cache First → Network Fallback ── */
self.addEventListener('fetch', event => {
  // POST / chrome-extension 等は素通し
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // 有効なレスポンスのみキャッシュに追加
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // ネットワークもキャッシュも失敗した場合（HTML要求ならindex.htmlをフォールバック）
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── バックグラウンド同期（将来拡張用） ── */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
