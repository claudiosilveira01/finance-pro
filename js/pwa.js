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

// Identidade fixa do aparelho, guardada no armazenamento local do navegador — sobrevive a
// reinstalar o PWA (é o mesmo Safari/Chrome por baixo). Sem isso, reinstalar o app criava uma
// chave de notificação nova e deixava a antiga esquecida, causando notificação em dobro.
function _obterDeviceId() {
    let id = localStorage.getItem('pushDeviceId');
    if (!id) {
        id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('pushDeviceId', id);
    }
    return id;
}

async function _registrarTokenNotificacao(mostrarSucesso) {
    const registration = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return;

    const deviceId = _obterDeviceId();
    await getConfigDocRef().set({
        pushTokens: { [deviceId]: token }
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

// Escape-hatch manual: reinstalar o PWA no iPhone pode apagar o armazenamento local do app
// (inclusive a identidade do aparelho salva ali), então o app perde a referência de qual chave
// de notificação é a antiga — ela fica esquecida no Firestore e passa a duplicar aviso. Esse botão
// apaga todos os dispositivos cadastrados de uma vez, sem precisar mexer direto no banco de dados.
async function resetarNotificacoesVencimento() {
    if (!currentUser) return;
    try {
        await getConfigDocRef().set({ pushTokens: {} }, { merge: true });
        localStorage.removeItem('pushDeviceId');
        atualizarBotaoNotificacoes(false);
        mostrarToast('Notificações resetadas. Ative de novo em cada dispositivo que quiser avisar.', 'success', 7000);
    } catch (err) {
        mostrarToast('Erro ao resetar notificações. Tente novamente.', 'error');
    }
}

// Se a permissão já foi concedida antes (ex.: usuário reabrindo o app noutro dia), reconfirma o
// token em silêncio — sem pedir permissão de novo nem mostrar toast de sucesso.
function verificarNotificacoesAtivas() {
    if (!VAPID_KEY || !('Notification' in window) || Notification.permission !== 'granted') return;
    _registrarTokenNotificacao(false).catch(() => {});
}
