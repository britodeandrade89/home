self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Estratégia simples: Apenas busca na rede (Network Only) para este dashboard live.
  // PWA requer um fetch handler para ser instalável.
  event.respondWith(fetch(event.request));
});