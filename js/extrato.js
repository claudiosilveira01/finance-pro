// Importação de extrato bancário em PDF (Nubank e formatos similares) — 100% client-side, sem backend.
// Lê o texto do PDF com pdf.js, reconstrói as linhas por posição (Y/X) e interpreta o padrão
// "Tipo da transação" / "Descrição (opcional, pode quebrar em várias linhas)" / "Valor".

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
}

const EXTRATO_TIPOS = [
    'Transferência recebida pelo Pix via Open Banking',
    'Transferência enviada pelo Pix via Open Banking',
    'Transferência recebida pelo Pix',
    'Transferência enviada pelo Pix',
    'Transferência Recebida',
    'Transferência Enviada',
    'Compra no débito',
    'Compra no crédito',
    'Pagamento de boleto efetuado',
    'Pagamento de fatura',
    'Aplicação RDB',
    'Resgate RDB',
    'Crédito em conta',
    'Débito em conta',
    'Depósito',
    'Estorno',
    'Saque'
].sort((a, b) => b.length - a.length);

// Rótulo curto + ícone para cada tipo de transação, só para exibição (o "tipo" salvo continua o original,
// usado no parser/merge/CSV — mudar isso quebraria a deduplicação de reimportações).
const EXTRATO_TIPO_DISPLAY = {
    'Transferência recebida pelo Pix via Open Banking': { label: 'Recebido Pix', icone: 'arrow-down-left' },
    'Transferência enviada pelo Pix via Open Banking': { label: 'Enviado Pix', icone: 'arrow-up-right' },
    'Transferência recebida pelo Pix': { label: 'Recebido Pix', icone: 'arrow-down-left' },
    'Transferência enviada pelo Pix': { label: 'Enviado Pix', icone: 'arrow-up-right' },
    'Transferência Recebida': { label: 'Transferência Recebida', icone: 'arrow-down-left' },
    'Transferência Enviada': { label: 'Transferência Enviada', icone: 'arrow-up-right' },
    'Compra no débito': { label: 'Compra Débito', icone: 'credit-card' },
    'Compra no crédito': { label: 'Compra Crédito', icone: 'credit-card' },
    'Pagamento de boleto efetuado': { label: 'Boleto Pago', icone: 'barcode' },
    'Pagamento de fatura': { label: 'Fatura Paga', icone: 'receipt' },
    'Aplicação RDB': { label: 'Aplicação RDB', icone: 'trend-up' },
    'Resgate RDB': { label: 'Resgate RDB', icone: 'trend-down' },
    'Crédito em conta': { label: 'Crédito em Conta', icone: 'plus-circle' },
    'Débito em conta': { label: 'Débito em Conta', icone: 'minus-circle' },
    'Depósito': { label: 'Depósito', icone: 'download-simple' },
    'Estorno': { label: 'Estorno', icone: 'arrow-counter-clockwise' },
    'Saque': { label: 'Saque', icone: 'money' }
};
function _extratoTipoDisplay(tipo) {
    return EXTRATO_TIPO_DISPLAY[tipo] || { label: tipo, icone: 'arrows-left-right' };
}

const EXTRATO_MESES = { JAN:'01', FEV:'02', MAR:'03', ABR:'04', MAI:'05', JUN:'06', JUL:'07', AGO:'08', SET:'09', OUT:'10', NOV:'11', DEZ:'12' };
const EXTRATO_MONEY_RE = /^(.*?)\s*(\d{1,3}(?:\.\d{3})*,\d{2})$/;
const EXTRATO_DATA_RE = /^(\d{2})\s+([A-ZÇÃÕ]{3})\s+(\d{4})\b/i;

const EXTRATO_RUIDO = [
    /^CPF\b/i,
    /Ag[êe]ncia \d+ Conta$/i,
    /^\d{6,10}-\d$/,
    /^\d{2} DE .+ \d{4}\s*(a|à)\s*\d{2} DE .+ \d{4}/i,
    /^VALORES EM R\$/i,
    /^Tem alguma d[uú]vida/i,
    /^Caso a solu[çc][ãa]o/i,
    /^Extrato gerado dia/i,
    /^\d{1,2} de \d{1,3}$/i,
    /^Saldo (inicial|final)/i,
    /^Rendimento l[íi]quido/i,
    /^O saldo l[íi]quido corresponde/i,
    /^N[ãa]o nos responsabilizamos/i,
    /^Asseguramos a autenticidade/i,
    /^Nu (Financeira|Pagamentos)/i,
    /^CNPJ:/i
];

function _extratoParseValor(str) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function _extratoStrHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
}

// Reconstrói o texto do PDF em linhas visuais, agrupando itens por proximidade de Y e ordenando por X.
async function _extratoExtrairLinhas(pdf) {
    const linhas = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const itens = content.items.filter(i => i.str && i.str.trim()).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
        itens.sort((a, b) => b.y - a.y || a.x - b.x);

        const TOL = 2.5;
        let grupo = [], yRef = null;
        const flush = () => {
            if (!grupo.length) return;
            grupo.sort((a, b) => a.x - b.x);
            const texto = grupo.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
            if (texto) linhas.push(texto);
            grupo = [];
        };
        itens.forEach(it => {
            if (yRef === null || Math.abs(it.y - yRef) <= TOL) {
                grupo.push(it);
                if (yRef === null) yRef = it.y;
            } else {
                flush();
                grupo.push(it);
                yRef = it.y;
            }
        });
        flush();
    }

    // Remove ruído (rodapé/cabeçalho repetido em cada página) e a linha do nome do titular,
    // que sempre aparece imediatamente antes da linha "CPF ...".
    const semRuido = [];
    linhas.forEach((linha, idx) => {
        if (EXTRATO_RUIDO.some(re => re.test(linha))) return;
        const proxima = linhas[idx + 1] || '';
        if (/^CPF\b/i.test(proxima)) return;
        semRuido.push(linha);
    });
    return semRuido;
}

// Máquina de estados: percorre as linhas já reconstruídas e monta as transações.
function _extratoParseLinhas(linhas) {
    const transacoes = [];
    let dentroMovimentacoes = false;
    let direcao = null;
    let dataAtual = null;
    let aberto = null; // { tipo, desc: [] }

    const descartarAberto = () => { aberto = null; };

    const encontrarTipo = (linha) => {
        for (const t of EXTRATO_TIPOS) {
            if (linha.toLowerCase().startsWith(t.toLowerCase())) return t;
        }
        return null;
    };

    linhas.forEach(linhaOriginal => {
        const linha = linhaOriginal.trim();
        if (!linha) return;

        if (!dentroMovimentacoes) {
            if (/^Movimenta[çc][õo]es/i.test(linha)) dentroMovimentacoes = true;
            return;
        }

        const mData = linha.match(EXTRATO_DATA_RE);
        if (mData) {
            descartarAberto();
            const [, dia, mesAbrev, ano] = mData;
            const mesNum = EXTRATO_MESES[mesAbrev.toUpperCase()];
            dataAtual = mesNum ? `${ano}-${mesNum}-${dia.padStart(2, '0')}` : null;
        }
        if (/Total de entradas/i.test(linha)) { descartarAberto(); direcao = 'entrada'; return; }
        if (/Total de sa[íi]das/i.test(linha)) { descartarAberto(); direcao = 'saida'; return; }
        if (mData) return;

        const tipoDetectado = encontrarTipo(linha);
        if (tipoDetectado) {
            descartarAberto();
            // Quando o rótulo do tipo quebra em duas linhas no PDF (ex.: "...pelo Pix via" / "Open Banking"),
            // a reconstrução por linha pode deixar um "via" solto colado na descrição — remove esse resíduo.
            const resto = linha.slice(tipoDetectado.length).trim().replace(/^via\s+/i, '').trim();
            if (!resto) { aberto = { tipo: tipoDetectado, desc: [] }; return; }

            const m = resto.match(EXTRATO_MONEY_RE);
            if (m) {
                transacoes.push({ data: dataAtual, tipo: tipoDetectado, item: (m[1] || tipoDetectado).trim(), valor: _extratoParseValor(m[2]), direcao });
            } else {
                aberto = { tipo: tipoDetectado, desc: [resto] };
            }
            return;
        }

        if (aberto) {
            const m = linha.match(EXTRATO_MONEY_RE);
            if (m) {
                if (m[1]) aberto.desc.push(m[1]);
                const descCompleta = aberto.desc.join(' ').trim();
                transacoes.push({ data: dataAtual, tipo: aberto.tipo, item: (descCompleta || aberto.tipo).trim(), valor: _extratoParseValor(m[2]), direcao });
                aberto = null;
            } else {
                aberto.desc.push(linha);
            }
        }
    });

    // Limpa a descrição final: mantém só o primeiro segmento (nome do favorecido/pagador),
    // descartando CPF/CNPJ, banco, agência e conta que vêm depois de " - ".
    return transacoes
        .filter(t => !isNaN(t.valor))
        .map(t => {
            let item = t.item.split(' - ')[0].trim();
            if (item.length > 60) item = item.slice(0, 60).trim();
            return { ...t, item: item || t.tipo };
        });
}

function _extratoChave(t) {
    return `${t.data}|${t.tipo}|${t.item}|${t.valor}|${t.direcao}`;
}

// Mescla com o que já existe no mês: transações idênticas (mesma data/tipo/item/valor/direção)
// são ignoradas; só as realmente novas são adicionadas — sem duplicar em reimportações.
function _extratoMesclar(existentes, novas) {
    const chavesExistentes = new Set(existentes.map(_extratoChave));
    let adicionadas = 0;
    const resultado = [...existentes];
    novas.forEach(t => {
        const chave = _extratoChave(t);
        if (chavesExistentes.has(chave)) return;
        chavesExistentes.add(chave);
        resultado.push({ ...t, id: _extratoStrHash(chave) });
        adicionadas++;
    });
    return { resultado, adicionadas };
}

async function processarExtratoPdf(file) {
    if (!file) return;
    if (!window.activeExtrato) window.activeExtrato = [];

    document.getElementById('extratoProgresso').style.display = 'block';
    document.getElementById('extratoVazioMsg').style.display = 'none';

    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const linhas = await _extratoExtrairLinhas(pdf);
        const novasTransacoes = _extratoParseLinhas(linhas);

        if (novasTransacoes.length === 0) {
            mostrarToast('Não foi possível reconhecer movimentações neste PDF.', 'warning', 6000);
            return;
        }

        const { resultado, adicionadas } = _extratoMesclar(window.activeExtrato, novasTransacoes);
        window.activeExtrato = resultado;

        salvarDadosDoMesAtual();
        renderizarExtrato();

        const duplicadas = novasTransacoes.length - adicionadas;
        let msg = `${adicionadas} movimentação(ões) importada(s).`;
        if (duplicadas > 0) msg += ` ${duplicadas} já existiam e foram ignoradas.`;
        mostrarToast(msg, 'success', 6000);
    } catch (err) {
        mostrarToast('Erro ao ler o PDF do extrato. Verifique se o arquivo não está corrompido.', 'error', 6000);
    } finally {
        document.getElementById('extratoProgresso').style.display = 'none';
        document.getElementById('extratoPdfInput').value = '';
    }
}

function toggleSelecaoExtrato(id) {
    if (extratoSelecionados.has(id)) extratoSelecionados.delete(id); else extratoSelecionados.add(id);
    renderizarExtrato();
}

function excluirTransacaoExtrato(id) {
    const idx = (window.activeExtrato || []).findIndex(t => t.id === id);
    if (idx === -1) return;
    window.activeExtrato.splice(idx, 1);
    extratoSelecionados.delete(id);
    salvarDadosDoMesAtual();
    renderizarExtrato();
}

function alternarOrdemTipoExtrato() {
    extratoOrdemTipo = extratoOrdemTipo === 'valor' ? 'alfabetica' : 'valor';
    renderizarExtrato();
}

function abrirModalExtratoDetalhes() {
    document.getElementById('modalExtratoDetalhes').style.display = 'flex';
}

function fecharModalExtratoDetalhes() {
    document.getElementById('modalExtratoDetalhes').style.display = 'none';
}

function renderizarExtrato() {
    const lista = window.activeExtrato || [];
    const tbody = document.getElementById('listaExtrato');
    const vazio = document.getElementById('extratoVazioMsg');
    const resumoCompacto = document.getElementById('extratoResumoCompacto');
    const resumo = document.getElementById('extratoResumo');
    if (!tbody) return;

    if (lista.length === 0) {
        resumoCompacto.style.display = 'none';
        resumo.style.display = 'none';
        vazio.style.display = 'block';
        return;
    }
    vazio.style.display = 'none';
    resumoCompacto.style.display = 'block';
    resumo.style.display = 'flex';

    const totalEntradas = lista.filter(t => t.direcao === 'entrada').reduce((s, t) => s + t.valor, 0);
    const totalSaidas = lista.filter(t => t.direcao === 'saida').reduce((s, t) => s + t.valor, 0);
    document.getElementById('extratoTotalEntradas').innerText = `+ R$ ${totalEntradas.toFixed(2)}`;
    document.getElementById('extratoTotalSaidas').innerText = `- R$ ${totalSaidas.toFixed(2)}`;
    document.getElementById('extratoBtnDetalhesTexto').innerText = `Ver detalhes (${lista.length} transaç${lista.length === 1 ? 'ão' : 'ões'})`;

    // Resumo por tipo de transação (Pix recebido, Compra no débito, Aplicação RDB, etc.) —
    // sempre agrupado Entrada/Saída; dentro de cada grupo, ordena por nome (A-Z) ou por valor,
    // conforme o botão de classificação escolhido pelo usuário.
    const porTipo = {};
    lista.forEach(t => {
        if (!porTipo[t.tipo]) porTipo[t.tipo] = { soma: 0, count: 0, direcao: t.direcao };
        porTipo[t.tipo].soma += t.valor;
        porTipo[t.tipo].count++;
    });
    const maiorValor = Math.max(...Object.values(porTipo).map(i => i.soma), 1);
    const entradas = [], saidas = [];
    Object.entries(porTipo).forEach(entry => (entry[1].direcao === 'entrada' ? entradas : saidas).push(entry));
    const comparador = extratoOrdemTipo === 'valor'
        ? (a, b) => b[1].soma - a[1].soma
        : (a, b) => _extratoTipoDisplay(a[0]).label.localeCompare(_extratoTipoDisplay(b[0]).label, 'pt-BR');
    entradas.sort(comparador);
    saidas.sort(comparador);

    const renderGrupo = (grupo, rotulo) => {
        if (!grupo.length) return '';
        const linhas = grupo.map(([tipo, info], idx) => {
            const disp = _extratoTipoDisplay(tipo);
            const cor = info.direcao === 'entrada' ? 'var(--green-success)' : 'var(--red-danger)';
            const sinal = info.direcao === 'entrada' ? '+' : '-';
            const classeAnim = animarNaCarga ? ' item-anim' : '';
            const pct = Math.min(100, (info.soma / maiorValor) * 100);
            return `
                <div class="tipo-item${classeAnim}" style="animation-delay:${idx * 0.04}s; color:${cor}">
                    <div class="tipo-item-bar" style="width:${pct}%"></div>
                    <span class="tipo-item-label"><i class="ph ph-${disp.icone}"></i> ${disp.label} <span style="color:var(--text-muted); font-weight:400;">(${info.count})</span></span>
                    <span class="tipo-item-valor" style="color:${cor};">${sinal} R$ ${info.soma.toFixed(2)}</span>
                </div>`;
        }).join('');
        return `<div class="tipo-grupo-label">${rotulo}</div>${linhas}`;
    };

    const divTipos = document.getElementById('extratoResumoPorTipo');
    divTipos.innerHTML = renderGrupo(entradas, 'Entradas') + renderGrupo(saidas, 'Saídas');

    const ordTexto = document.getElementById('extratoOrdemTexto');
    if (ordTexto) ordTexto.innerText = extratoOrdemTipo === 'valor' ? 'Maior valor' : 'A-Z';
    const ordIcone = document.getElementById('extratoOrdemBtn')?.querySelector('.ph');
    if (ordIcone) ordIcone.className = `ph ${extratoOrdemTipo === 'valor' ? 'ph-sort-descending' : 'ph-sort-ascending'}`;

    tbody.innerHTML = '';
    lista.forEach(t => {
        const cor = t.direcao === 'entrada' ? 'var(--green-success)' : 'var(--red-danger)';
        const sinal = t.direcao === 'entrada' ? '+' : '-';
        tbody.innerHTML += `
            <tr>
                <td class="td-check"><input type="checkbox" class="row-check" ${extratoSelecionados.has(t.id) ? 'checked' : ''} onchange="toggleSelecaoExtrato(${t.id})"></td>
                <td data-label="Item">${t.item}</td>
                <td data-label="Tipo" style="color:var(--text-muted); font-size:0.82rem;">${t.tipo}</td>
                <td data-label="Entrada/Saída" style="color:${cor}; font-weight:700;">${t.direcao === 'entrada' ? 'Entrada' : 'Saída'}</td>
                <td data-label="Valor" style="color:${cor}; font-weight:700; white-space:nowrap;">${sinal} R$ ${t.valor.toFixed(2)}</td>
                <td style="text-align:right;"><button class="btn-action btn-delete" onclick="excluirTransacaoExtrato(${t.id})" title="Excluir"><i class="ph ph-trash"></i></button></td>
            </tr>`;
    });

    let soma = 0;
    [...extratoSelecionados].forEach(id => {
        const t = lista.find(x => x.id === id);
        if (t) soma += t.valor;
    });
    [...extratoSelecionados].forEach(id => { if (!lista.some(t => t.id === id)) extratoSelecionados.delete(id); });
    document.getElementById('extratoSomaSelecionada').innerText = `R$ ${soma.toFixed(2)}`;
}
