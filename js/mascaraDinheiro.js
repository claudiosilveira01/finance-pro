// Máscara de dinheiro "tipo caixa registradora" pros campos de valor (R$) — só aceita dígitos
// e a vírgula dos centavos entra sozinha conforme digita (259 -> 2,59), nunca ponto. Aplica em
// qualquer <input data-dinheiro>, inclusive os criados depois dentro de modais dinâmicos, porque
// o listener fica no document (delegação de evento) em vez de um por campo.

function _formatarDigitosDinheiro(str) {
    const digitos = String(str || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digitos) return '';
    const comZeros = digitos.padStart(3, '0');
    const inteiro = comZeros.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
    const centavos = comZeros.slice(-2);
    return `${inteiro},${centavos}`;
}

// Fase de captura (não borbulhamento): roda ANTES de qualquer oninput=".." do próprio campo
// (ex.: filtroFixaValorMin dispara aplicarFiltrosFixas() no input) — senão esses handlers leriam
// o valor de um instante antes da máscara, sempre atrasado em um dígito.
document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches || !el.matches('[data-dinheiro]')) return;
    el.value = _formatarDigitosDinheiro(el.value);
    // Sempre deixa o cursor no fim — o dígito seguinte precisa entrar depois da vírgula, nunca
    // no meio do número, senão digitar vira uma bagunça em navegadores que não movem o cursor
    // sozinhos ao trocar o value por código.
    const fim = el.value.length;
    if (typeof el.setSelectionRange === 'function') el.setSelectionRange(fim, fim);
}, true);

// Lê o valor de um campo com máscara de dinheiro (texto "1234,56") como número — usar sempre no
// lugar de parseFloat(el.value) pra ler um <input data-dinheiro>.
function _parseDinheiro(valorOuEl) {
    const str = (valorOuEl && typeof valorOuEl === 'object') ? valorOuEl.value : valorOuEl;
    if (str == null) return NaN;
    const limpo = String(str).trim().replace(/\./g, '').replace(',', '.');
    if (!limpo) return NaN;
    return parseFloat(limpo);
}

// Formata um número pro texto que um campo com máscara de dinheiro espera (1234.5 -> "1234,50")
// — usar sempre que preencher um <input data-dinheiro> por código (abrir modal de edição, etc.).
function _formatarDinheiroInput(valor) {
    if (valor == null || valor === '' || isNaN(valor)) return '';
    return Number(valor).toFixed(2).replace('.', ',');
}

// Arredonda pra 2 casas decimais (centavos) — usar em toda soma/subtração de dinheiro que vai ser
// salva ou comparada, senão erros de ponto flutuante (0.1 + 0.2 = 0.30000000000000004) acumulam
// ao longo de várias operações (ex.: Caixa Atual ajustado dezenas de vezes) e deixam um resto
// residual tipo "0,00" que na real é 0.0000000000003 — nunca exatamente vazio/zero de novo.
function _arred2(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}
