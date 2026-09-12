// PWA: registra o service worker (deixa o app instalável e abrível offline). Notificações de
// vencimento (Web Push) foram removidas do sistema — decisão do usuário (11/09/2026), código
// anterior salvo em BRAIN/03_PROJETOS/FINANCE_PRO/backups/2026-09-11-remocao-cartoes-notificacoes/.

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}
