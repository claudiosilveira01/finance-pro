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

// Modal de filtros — os campos refletem o filtro atual (que pode ter vindo de uma sessão
// anterior, restaurado do localStorage) em vez de sempre abrir em branco.
function abrirModalFiltrosFixas() {
    document.getElementById('filtroFixaValorMin').value = filtrosFixas.valorMin != null ? _formatarDinheiroInput(filtrosFixas.valorMin) : '';
    document.getElementById('filtroFixaValorMax').value = filtrosFixas.valorMax != null ? _formatarDinheiroInput(filtrosFixas.valorMax) : '';
    document.getElementById('filtroFixaVencimento').value = filtrosFixas.vencimento || '';
    document.getElementById('filtroFixaPago').value = filtrosFixas.pago || '';
    document.getElementById('modalFiltrosFixas').style.display = 'flex';
}

function fecharModalFiltrosFixas() {
    document.getElementById('modalFiltrosFixas').style.display = 'none';
}

// Filtros em cascata para contas fixas
function aplicarFiltrosFixas() {
    const valorMinInput = document.getElementById('filtroFixaValorMin').value;
    const valorMaxInput = document.getElementById('filtroFixaValorMax').value;
    const vencimentoInput = document.getElementById('filtroFixaVencimento').value;
    const pagoInput = document.getElementById('filtroFixaPago').value;

    const valorMin = valorMinInput ? _parseDinheiro(valorMinInput) : null;
    const valorMax = valorMaxInput ? _parseDinheiro(valorMaxInput) : null;
    const vencimento = vencimentoInput || '';
    const pago = pagoInput || '';

    filtrosFixas = { valorMin, valorMax, vencimento, pago };
    _salvarEstadoUI('filtrosFixas', filtrosFixas);

    calcularEAtualizarVisual();
}

function limparFiltrosFixas() {
    document.getElementById('filtroFixaValorMin').value = '';
    document.getElementById('filtroFixaValorMax').value = '';
    document.getElementById('filtroFixaVencimento').value = '';
    document.getElementById('filtroFixaPago').value = '';

    filtrosFixas = { valorMin: null, valorMax: null, vencimento: '', pago: '' };
    _salvarEstadoUI('filtrosFixas', filtrosFixas);

    calcularEAtualizarVisual();
    mostrarToast('Filtros limpos.', 'success');
}
