// PWA: registra o service worker mínimo (só cache do app shell, para ser instalável e abrir
// offline). Sem push/FCM — as notificações de vencimento saíram na migração pro Supabase.

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}
