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

// Modal de filtros
function abrirModalFiltrosFixas() {
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

    calcularEAtualizarVisual();
}

function limparFiltrosFixas() {
    document.getElementById('filtroFixaValorMin').value = '';
    document.getElementById('filtroFixaValorMax').value = '';
    document.getElementById('filtroFixaVencimento').value = '';
    document.getElementById('filtroFixaPago').value = '';

    filtrosFixas = { valorMin: null, valorMax: null, vencimento: '', pago: '' };

    calcularEAtualizarVisual();
    mostrarToast('Filtros limpos.', 'success');
}
