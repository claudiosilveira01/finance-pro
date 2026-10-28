// Conta administradora: permite que uma conta (ex.: Cláudio) veja e edite outra conta vinculada
// (ex.: Carla), sem trocar de login.
//
// Como funciona:
//   - O banco guarda os vínculos na tabela admin_acessos (quem administra quem, com o aceite do
//     dono da conta). O app só LÊ essa tabela; nunca cria vínculos.
//   - window.contaAlvoId = null  -> estou na minha própria conta (comportamento normal).
//   - window.contaAlvoId = <id>  -> o helper rpc() (config.js) manda esse id como p_alvo em
//     toda chamada ao banco. O banco confere o vínculo; sem vínculo válido, recusa.
//   - Contas comuns (sem nenhum vínculo) nunca veem seletor nem faixa: nada muda pra elas.

window.contaAlvoId = null;
let contasAdministradas = []; // [{ alvo_user_id, apelido }]

// Mesma lista padrão de config.js — usada ao entrar numa conta que ainda não tem categorias salvas,
// pra não herdar as categorias da conta que estava aberta antes.
const _CATEGORIAS_PADRAO_ADMIN = ["Alimentação", "Transporte", "Lazer", "Educação", "Assinaturas", "Saúde", "Comunicação", "Tributos", "PIX Terceiros", "Outros"];

// Chamada logo após o login. Se a tabela de vínculos não existir ou der erro, simplesmente não
// mostra o seletor (o app segue normal).
async function carregarContasAdministradas() {
    window.contaAlvoId = null;
    contasAdministradas = [];
    try {
        const { data, error } = await sb.from('admin_acessos')
            .select('alvo_user_id, apelido')
            .eq('admin_user_id', currentUser.id)
            .not('aceito_em', 'is', null);
        if (!error && Array.isArray(data)) contasAdministradas = data;
    } catch (e) { /* sem vínculos: segue como conta comum */ }
    _atualizarIndicadoresConta();
}

function _nomeDaConta(id) {
    const c = contasAdministradas.find(x => x.alvo_user_id === id);
    return c ? (c.apelido || 'outra conta') : '';
}

// Monta o seletor (só se houver contas vinculadas) e liga/desliga a faixa de aviso.
function _atualizarIndicadoresConta() {
    const box = document.getElementById('contaSeletorBox');
    const seletor = document.getElementById('contaSeletor');
    const faixa = document.getElementById('faixaContaAlvo');
    if (!box || !seletor || !faixa) return;

    if (contasAdministradas.length === 0) {
        box.style.display = 'none';
        faixa.style.display = 'none';
        return;
    }
    seletor.innerHTML = '<option value="">Minha conta</option>'
        + contasAdministradas.map(c => `<option value="${_esc(c.alvo_user_id)}">${_esc(c.apelido || 'Conta')}</option>`).join('');
    seletor.value = window.contaAlvoId || '';
    box.style.display = 'flex';

    if (window.contaAlvoId) {
        document.getElementById('faixaContaAlvoNome').textContent = _nomeDaConta(window.contaAlvoId);
        faixa.style.display = 'flex';
    } else {
        faixa.style.display = 'none';
    }
}

// Troca a conta exibida. id vazio = voltar pra minha conta.
async function trocarConta(id) {
    const novo = id || null;
    if (novo === (window.contaAlvoId || null)) return;
    if (novo && !contasAdministradas.some(c => c.alvo_user_id === novo)) return;

    // Garante que nada pendente da conta atual seja gravado na conta errada: confirma a exclusão
    // com "Desfazer" em espera e espera as gravações em andamento terminarem antes de trocar.
    flushPendingDelete();
    const limite = Date.now() + 8000;
    while (window._saveEmVoo > 0 && Date.now() < limite) {
        await new Promise(r => setTimeout(r, 100));
    }
    if (window._saveEmVoo > 0) {
        mostrarToast('Ainda salvando as alterações. Tente trocar de conta em instantes.', 'warning');
        _atualizarIndicadoresConta(); // devolve o seletor pra conta atual
        return;
    }

    window.contaAlvoId = novo;

    // Zera o estado da conta anterior antes de carregar a nova.
    categoriasAtuais = [..._CATEGORIAS_PADRAO_ADMIN];
    assinaturasConfig = [];
    ocultarCardAcumulado = false;
    ocultarCardExtrato = false;
    window.activeFixas = [];
    window.activeFaturamentos = [];
    window.activeExtrato = [];
    window.activeRegistroPagamentos = [];

    _atualizarIndicadoresConta();
    document.getElementById('loadingDiv').style.display = 'flex';
    carregarConfigGlobal(() => {
        document.getElementById('loadingDiv').style.display = 'none';
    });
}

// Chamada no logout: volta ao estado de conta comum.
function limparContaAdmin() {
    window.contaAlvoId = null;
    contasAdministradas = [];
    _atualizarIndicadoresConta();
}
