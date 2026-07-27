// PWA: registra o service worker (instalação + push) e gerencia a ativação de notificações de vencimento.

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('firebase-messaging-sw.js').catch(() => {});
}

// Chave pública VAPID do projeto (Firebase Console > Configurações do projeto > Cloud Messaging).
// É uma chave PÚBLICA — pode ficar no código do cliente sem problema, diferente de uma chave privada.
const VAPID_KEY = 'BMVqC-zZge-thop8TS1lpHSAKLJMmXjHvq9rLUCpP62hNxH_Zhyjffw8k71ZkgQpYKYzhT4gXcDMRsn5mRRmEys';

async function ativarNotificacoesVencimento() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        mostrarToast('Seu navegador não suporta notificações.', 'warning');
        return;
    }
    if (!VAPID_KEY) {
        mostrarToast('Notificações ainda não estão configuradas neste projeto.', 'warning');
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
        await _registrarTokenNotificacao(true);
    } catch (err) {
        mostrarToast('Erro ao ativar notificações. Tente novamente.', 'error');
    }
}

async function _registrarTokenNotificacao(mostrarSucesso) {
    const registration = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return;

    await getConfigDocRef().set({
        pushTokens: firebase.firestore.FieldValue.arrayUnion(token)
    }, { merge: true });

    atualizarBotaoNotificacoes(true);
    if (mostrarSucesso) mostrarToast('Notificações ativadas neste dispositivo!', 'success');
}

function atualizarBotaoNotificacoes(ativo) {
    const btn = document.getElementById('btnAtivarNotificacoes');
    if (!btn) return;
    btn.innerHTML = ativo
        ? '<i class="ph ph-bell-ringing"></i> Notificações ativadas neste dispositivo'
        : '<i class="ph ph-bell"></i> Ativar notificações de vencimento';
    btn.disabled = ativo;
}

// Se a permissão já foi concedida antes (ex.: usuário reabrindo o app noutro dia), reconfirma o
// token em silêncio — sem pedir permissão de novo nem mostrar toast de sucesso.
function verificarNotificacoesAtivas() {
    if (!VAPID_KEY || !('Notification' in window) || Notification.permission !== 'granted') return;
    _registrarTokenNotificacao(false).catch(() => {});
}
