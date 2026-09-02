// PWA: registra o service worker e gerencia as notificações de vencimento (Web Push nativo,
// VAPID) — sem Firebase. Os avisos são disparados por uma Supabase Edge Function
// (avisos-vencimento) num cron diário; aqui só cuidamos da inscrição do aparelho.

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

// Chave pública VAPID — é PÚBLICA, pode ficar no código do cliente. O par privado fica só no
// secret da Edge Function. Precisa ser exatamente a mesma dos dois lados.
const VAPID_PUBLIC_KEY = 'BEfBKjRCJuagF6uQjzE5UnK1Cha30uenNJrz0jWlq292VOLIILYWfBEa1hrUAJWOdB7Gmmzz_WJOpumN6wOXp0Q';

function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

function _abParaBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

// Identidade fixa do aparelho (localStorage) — sobrevive a reinstalar o PWA (é o mesmo
// navegador por baixo). Sem isso, reinscrever criava outra linha e duplicava a notificação.
function _obterDeviceId() {
    let id = localStorage.getItem('pushDeviceId');
    if (!id) {
        id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('pushDeviceId', id);
    }
    return id;
}

function atualizarBotaoNotificacoes(ativo) {
    const btn = document.getElementById('btnAtivarNotificacoes');
    if (!btn) return;
    btn.innerHTML = ativo
        ? '<i class="ph ph-bell-ringing"></i> Notificações ativadas neste dispositivo'
        : '<i class="ph ph-bell"></i> Ativar notificações de vencimento';
    btn.disabled = !!ativo;
}

// Cria/renova a subscription do push neste aparelho e faz upsert no banco. `silencioso` =
// não pede permissão nem mostra toast de sucesso (usado no verificarNotificacoesAtivas).
async function _inscreverPush(silencioso) {
    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
    }

    const dados = sub.toJSON();
    const p256dh = dados.keys && dados.keys.p256dh;
    const auth = dados.keys && dados.keys.auth;
    if (!sub.endpoint || !p256dh || !auth) {
        if (!silencioso) mostrarToast('Não consegui registrar as notificações neste navegador.', 'error');
        return false;
    }

    await rpc('salvar_push_subscription', {
        p_device_id: _obterDeviceId(),
        p_endpoint: sub.endpoint,
        p_p256dh: p256dh,
        p_auth: auth
    });

    atualizarBotaoNotificacoes(true);
    if (!silencioso) mostrarToast('Notificações ativadas neste dispositivo!', 'success');
    return true;
}

async function ativarNotificacoesVencimento() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        mostrarToast('Seu navegador não suporta notificações push.', 'warning');
        return;
    }
    if (Notification.permission === 'denied') {
        mostrarToast('Notificações bloqueadas para este site — ative manualmente nas configurações do navegador/iPhone.', 'warning', 7000);
        return;
    }
    try {
        const permissao = await Notification.requestPermission();
        if (permissao !== 'granted') {
            mostrarToast('Permissão de notificação não concedida.', 'warning');
            return;
        }
        await _inscreverPush(false);
    } catch (err) {
        mostrarToast('Erro ao ativar notificações. Tente de novo.', 'error');
    }
}

// Desliga as notificações NESTE aparelho: cancela a subscription no navegador e remove a
// linha do banco. (Não mexe nos outros aparelhos do usuário.)
async function resetarNotificacoesVencimento() {
    if (!currentUser) return;
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
        }
        await rpc('remover_push_subscription', { p_device_id: _obterDeviceId() });
        atualizarBotaoNotificacoes(false);
        mostrarToast('Notificações desativadas neste aparelho.', 'success', 6000);
    } catch (err) {
        mostrarToast('Erro ao desativar. Tente de novo.', 'error');
    }
}

// Reabrindo o app noutro dia: se a permissão já está concedida, renova a subscription em
// silêncio (o endpoint pode mudar) e mantém o botão em sincronia.
function verificarNotificacoesAtivas() {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) {
        atualizarBotaoNotificacoes(false);
        return;
    }
    _inscreverPush(true).catch(() => {});
}
