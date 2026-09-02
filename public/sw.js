// Service worker mínimo do Finance PRO: deixa o app instalável e abrível offline, sem push.
//
// Estratégia: network-first para TUDO que é do próprio site (HTML, JS, CSS). Sempre que há
// rede, o usuário pega a versão nova na hora — nada de código velho preso em cache. O cache
// só entra como plano B quando está offline. Requisições pra fora (Supabase, CDNs) passam direto.

const CACHE = 'finance-pro-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
