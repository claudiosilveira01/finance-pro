// Função helper: retorna fixas filtradas baseado nos critérios atuais
function obterFixasFiltradas() {
    const valorMin = filtrosFixas.valorMin;
    const valorMax = filtrosFixas.valorMax;
    const vencimento = filtrosFixas.vencimento;
    const pago = filtrosFixas.pago;

    return window.activeFixas.filter(fixa => {
        if (valorMin !== null && fixa.valor < valorMin) return false;
        if (valorMax !== null && fixa.valor > valorMax) return false;
        if (vencimento) {
            const [diaMin, diaMax] = vencimento.split('-').map(Number);
            if (fixa.vencimento < diaMin || fixa.vencimento > diaMax) return false;
        }
        if (pago === 'sim' && !fixa.pago) return false;
        if (pago === 'nao' && fixa.pago) return false;
        return true;
    });
}

// Verifica se há filtros ativos
function temFiltrosAtivos() {
    return filtrosFixas.valorMin !== null || filtrosFixas.valorMax !== null ||
           filtrosFixas.vencimento !== '' || filtrosFixas.pago !== '';
}

// Filtros em cascata para contas fixas — aplicação cumulativa de múltiplos critérios
function aplicarFiltrosFixas() {
    // Lê valores dos inputs
    const valorMin = parseFloat(document.getElementById('filtroFixaValorMin').value) || null;
    const valorMax = parseFloat(document.getElementById('filtroFixaValorMax').value) || null;
    const vencimento = document.getElementById('filtroFixaVencimento').value || '';
    const pago = document.getElementById('filtroFixaPago').value || '';

    // Armazena os filtros globalmente pra referência
    filtrosFixas = { valorMin, valorMax, vencimento, pago };

    // Renderiza com filtros aplicados
    const fixasFiltradas = obterFixasFiltradas();
    renderizarFixasFiltradas(fixasFiltradas);
    atualizarTotaisFixas(fixasFiltradas);
}

function renderizarFixasFiltradas(fixasFiltradas) {
    const ordFixasAtual = ordFixas;
    const fixasOrdenadas = aplicarOrdenacao(fixasFiltradas, ordFixasAtual);

    const tbodyFixas = document.getElementById('listaFixas');
    tbodyFixas.innerHTML = '';
    let somaSelecionadaFixas = 0;

    const animarAgora = false; // nunca anima durante filtro
    const classeAnimBadge = '';

    fixasOrdenadas.forEach(c => {
        let alerta = calcularAlertaVencimento(c.vencimento, c.pago);
        const marcado = fixasSelecionadas.has(c.id);
        if (marcado) somaSelecionadaFixas += c.valor;

        tbodyFixas.innerHTML += `
            <tr>
                <td class="td-check"><input type="checkbox" class="row-check" ${marcado ? 'checked' : ''} onchange="toggleSelecaoFixa(${c.id})"></td>
                <td data-label="Item">
                    <button class="item-link" onclick="editarContaFixa(${c.id})">${c.nome}</button>
                    <div class="fixa-sub">${c.categoria}${c.obs ? ' · ' + c.obs : ''}</div>
                </td>
                <td data-label="Venc."><span class="vencimento-tag${classeAnimBadge}" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span></td>
                <td data-label="Valor"><strong class="fixa-valor">R$ ${c.valor.toFixed(2)}</strong></td>
                <td data-label="Pago?"><button class="status-badge${classeAnimBadge} ${c.pago?'sim':'nao'}" onclick="togglePagoFixa(${c.id})">${c.pago?'Sim':'Não'}</button></td>
            </tr>
        `;
    });

    [...fixasSelecionadas].forEach(id => { if (!fixasOrdenadas.some(c => c.id === id)) fixasSelecionadas.delete(id); });
    animarNumero('mSomaSelecionadas', somaSelecionadaFixas, 500);
    animarNumero('mSomaSelecionadasCard', somaSelecionadaFixas, 500);
}

function atualizarTotaisFixas(fixasFiltradas) {
    // Calcula totais com base nas fixas filtradas
    let orcamento = 0, pago = 0, restante = 0;

    fixasFiltradas.forEach(c => {
        orcamento += c.valor;
        if(c.pago) pago += c.valor; else restante += c.valor;
    });

    animarNumero('mOrcamento', orcamento, 500);
    animarNumero('mPago', pago, 500);
    animarNumero('mRestante', restante, 500);

    const saldoCaixaInicial = parseFloat(document.getElementById('saldoInput').value) || 0;
    const totalFaturamentos = (window.activeFaturamentos || []).reduce((sum, f) => sum + f.valor, 0);
    const saldoEstimado = saldoCaixaInicial + totalFaturamentos;
    let resultadoFinal = saldoEstimado - restante;

    animarNumero('mSaldoEstimado', saldoEstimado, 500);
    animarNumero('mResultado', resultadoFinal, 500);

    const elRes = document.getElementById('mResultado');
    elRes.style.color = resultadoFinal >= 0 ? 'var(--green-success)' : 'var(--red-danger)';
}

function limparFiltrosFixas() {
    // Limpa todos os inputs de filtro
    document.getElementById('filtroFixaValorMin').value = '';
    document.getElementById('filtroFixaValorMax').value = '';
    document.getElementById('filtroFixaVencimento').value = '';
    document.getElementById('filtroFixaPago').value = '';

    // Reseta os filtros globais
    filtrosFixas = { valorMin: null, valorMax: null, vencimento: '', pago: '' };

    // Renderiza todas as fixas novamente
    calcularEAtualizarVisual();

    mostrarToast('Filtros limpos.', 'success');
}
