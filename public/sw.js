// Service worker mínimo do Finance PRO: deixa o app instalável e abrível offline, sem push.
//
// Estratégia: network-first para TUDO que é do próprio site (HTML, JS, CSS). Sempre que há
// rede, o usuário pega a versão nova na hora — nada de código velho preso em cache. O cache
// só entra como plano B quando está offline. Requisições pra fora (Supabase, CDNs) passam direto.

const CACHE = 'finance-pro-v2';

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

// --- Web Push: avisos de vencimento (Edge Function avisos-vencimento) ---
self.addEventListener('push', (e) => {
  let dados = {};
  try { dados = e.data ? e.data.json() : {}; } catch (_) { dados = { body: e.data && e.data.text() }; }
  const titulo = dados.title || 'Planner Financeiro';
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: dados.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const c of lista) {
        if ('focus' in c) { c.navigate(alvo); return c.focus(); }
      }
      return self.clients.openWindow(alvo);
    })
  );
});
