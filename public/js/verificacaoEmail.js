// Botão "Verificar E-mail Agora": dispara sob demanda a mesma importação de extrato do
// Nubank que a automação do Apps Script (automacao-email-nubank/Code.gs) roda de hora
// em hora. A URL do App da Web e o token secreto ficam só no localStorage do aparelho —
// nunca são commitados no repositório (que é público). Veja SETUP.md, seção 7.

const CHAVE_LS_URL = 'fp_verificacaoEmail_url';
const CHAVE_LS_TOKEN = 'fp_verificacaoEmail_token';

function obterConfigVerificacaoEmail() {
    return {
        url: localStorage.getItem(CHAVE_LS_URL) || '',
        token: localStorage.getItem(CHAVE_LS_TOKEN) || ''
    };
}

function carregarConfigVerificacaoEmailNoModal() {
    const cfg = obterConfigVerificacaoEmail();
    document.getElementById('verifEmailUrl').value = cfg.url;
    document.getElementById('verifEmailToken').value = cfg.token;
}

function salvarConfigVerificacaoEmail() {
    const url = document.getElementById('verifEmailUrl').value.trim();
    const tokenInput = document.getElementById('verifEmailToken').value.trim();

    if (!url || !tokenInput) {
        mostrarToast('Preencha a URL do App da Web e o token.', 'warning');
        return;
    }
    if (!url.startsWith('https://script.google.com/')) {
        mostrarToast('Essa URL não parece ser de um App da Web do Google Apps Script.', 'warning');
        return;
    }

    localStorage.setItem(CHAVE_LS_URL, url);
    localStorage.setItem(CHAVE_LS_TOKEN, tokenInput);
    mostrarToast('Configuração salva neste dispositivo.', 'success');
}

function limparConfigVerificacaoEmail() {
    localStorage.removeItem(CHAVE_LS_URL);
    localStorage.removeItem(CHAVE_LS_TOKEN);
    document.getElementById('verifEmailUrl').value = '';
    document.getElementById('verifEmailToken').value = '';
    mostrarToast('Configuração removida deste dispositivo.', 'success');
}

function verificarExtratoEmailAgora() {
    const { url, token } = obterConfigVerificacaoEmail();

    if (!url || !token) {
        mostrarToast('Configure a URL e o token em Configurações > Verificação Automática de Extrato.', 'warning', 5000);
        abrirModalConfig();
        return;
    }

    const btn = document.getElementById('btnVerificarEmailAgora');
    const iconeOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner-gap girando"></i>';

    const urlComToken = url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);

    fetch(urlComToken)
        .then(resp => resp.json())
        .then(dados => {
            if (!dados.ok) {
                mostrarToast('Não foi possível verificar: ' + (dados.erro || 'erro desconhecido.'), 'error', 6000);
                return;
            }
            if (dados.novasTransacoes > 0) {
                mostrarToast(`✅ ${dados.novasTransacoes} transação(ões) nova(s) importada(s) de ${dados.novosEmails} e-mail(s)!`, 'success', 5000);
                carregarMes(mesAtualKey);
            } else if (dados.novosEmails > 0) {
                mostrarToast(`${dados.novosEmails} e-mail(s) verificado(s), mas nenhuma transação nova.`, 'info');
            } else {
                mostrarToast('Nenhum e-mail novo de extrato encontrado.', 'info');
            }
        })
        .catch(() => {
            mostrarToast('Erro ao conectar com a verificação de e-mail. Confira a URL/token nas Configurações.', 'error', 6000);
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = iconeOriginal;
        });
}
