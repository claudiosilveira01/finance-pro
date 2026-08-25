// Cartões de Crédito (Fase 3): importar a fatura de um arquivo .ofx ou .csv exportado do banco.
// OFX é preferido (formato estruturado, com id único por transação — mais confiável do que CSV
// ou PDF, que já causaram divergência de centavos em tentativas anteriores). CSV também é aceito.
// Créditos/pagamentos do arquivo (ex.: "Pagamento recebido") não viram compras — só abatem do
// valor sugerido da fatura, que o usuário sempre confirma manualmente antes de salvar.

        // === Sugestão de categoria por palavra-chave na descrição ===
        const _CARTAO_PALAVRAS_CATEGORIA = [
            { termos: ['restaurante', 'panificadora', 'açai', 'acai', 'espetinho', 'sorveteira', 'doces', 'lanchonete', 'pizzaria', 'padaria', 'mercado', 'supermercado', 'hortifruti', 'açougue', 'acougue', 'carnes'], categoria: 'Alimentação' },
            { termos: ['uber', '99app', '99 -', '99*', 'taxi', 'posto ', 'combustivel', 'estacionamento'], categoria: 'Transporte' },
            { termos: ['netflix', 'spotify', 'youtube', 'disney', 'hbo', 'prime video', 'deezer', 'apple.com', 'claude', 'anthropic', 'chatgpt', 'openai', 'google one'], categoria: 'Assinaturas' },
            { termos: ['farmacia', 'drogaria', 'academia', 'fitness', 'laboratorio', 'clinica', 'protect rastreamen'], categoria: 'Saúde' },
            { termos: ['curso', 'faculdade', 'escola', 'livraria'], categoria: 'Educação' },
            { termos: ['cinema', 'ingresso', 'bar ', 'balada', 'show'], categoria: 'Lazer' },
            { termos: ['vivo', 'claro', 'tim ', ' oi ', 'internet', 'telefonia'], categoria: 'Comunicação' },
            { termos: ['iof', 'juros', 'multa', 'tributo', 'imposto'], categoria: 'Tributos' },
            { termos: ['pix no credito', 'pix no crédito'], categoria: 'PIX Terceiros' }
        ];

        function _normalizarTexto(str) {
            return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        }

        function _sugerirCategoriaCartao(descricao) {
            const desc = _normalizarTexto(descricao);
            for (const grupo of _CARTAO_PALAVRAS_CATEGORIA) {
                if (grupo.termos.some(t => desc.includes(_normalizarTexto(t))) && categoriasAtuais.includes(grupo.categoria)) {
                    return grupo.categoria;
                }
            }
            return categoriasAtuais.includes('Outros') ? 'Outros' : categoriasAtuais[0];
        }

        // === Leitura do arquivo ===
        function importarFaturaCartao() {
            const cartao = _cartaoAtivo();
            if (!cartao) { mostrarToast('Cadastre um cartão em Configurações antes de importar.', 'warning'); return; }
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.ofx,.csv,text/csv,application/x-ofx,text/plain';
            input.onchange = () => {
                if (input.files && input.files[0]) _lerArquivoFaturaCartao(cartao.id, input.files[0]);
            };
            input.click();
        }

        function _lerArquivoFaturaCartao(cartaoId, file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const texto = String(e.target.result || '');
                const nomeArq = (file.name || '').toLowerCase();
                const ehOfx = nomeArq.endsWith('.ofx') || texto.includes('<OFX>');
                const itens = ehOfx ? _parseCartaoOfx(texto) : _parseCartaoCsv(texto);

                if (itens === null) {
                    mostrarToast('Não reconheci o formato desse arquivo. Exporte a fatura como .ofx ou .csv direto do app do banco.', 'error', 6000);
                    return;
                }
                if (itens.length === 0) {
                    mostrarToast('Não encontrei nenhuma transação nesse arquivo.', 'warning', 6000);
                    return;
                }
                _abrirRevisaoImportacaoCartao(cartaoId, itens);
            };
            reader.onerror = () => mostrarToast('Não consegui ler esse arquivo.', 'error');
            reader.readAsText(file);
        }

        // === Parser OFX — extrai cada bloco <STMTTRN>...</STMTTRN> por regex ===
        //
        // Convenção interna adotada (igual ao CSV, testada com arquivos reais do Nubank):
        // valor POSITIVO = compra (aumenta o que se deve), valor NEGATIVO = pagamento/estorno
        // (reduz o que se deve). No OFX é o CONTRÁRIO — TRNAMT negativo é compra (DEBIT) e
        // positivo é pagamento (CREDIT) — por isso o sinal é invertido aqui na leitura.
        function _parseCartaoOfx(texto) {
            const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) || [];
            const resultado = [];
            blocos.forEach(bloco => {
                const dtMatch = bloco.match(/<DTPOSTED>(\d{8})/);
                const valMatch = bloco.match(/<TRNAMT>(-?[\d.]+)/);
                const memoMatch = bloco.match(/<MEMO>([^\r\n<]*)/);
                const fitMatch = bloco.match(/<FITID>([^\r\n<]*)/);
                if (!dtMatch || !valMatch) return;
                const d = dtMatch[1];
                const data = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
                const valorOfx = parseFloat(valMatch[1]);
                const descricao = (memoMatch ? memoMatch[1] : 'Sem descrição').trim();
                const fitid = fitMatch ? fitMatch[1].trim() : '';
                if (isNaN(valorOfx)) return;
                const valor = -valorOfx; // inverte pra bater com a convenção interna (ver comentário acima)
                resultado.push({ data, descricao, valor, chave: fitid || `${data}|${descricao}|${valor.toFixed(2)}` });
            });
            return resultado;
        }

        // === Parser CSV — formato "date,title,amount" (com aspas/valores em vírgula, tipo Nubank) ===
        function _parseCsvLinhas(texto) {
            const linhas = [];
            let campo = '', linha = [], dentroAspas = false;
            for (let i = 0; i < texto.length; i++) {
                const ch = texto[i], prox = texto[i + 1];
                if (dentroAspas) {
                    if (ch === '"' && prox === '"') { campo += '"'; i++; }
                    else if (ch === '"') { dentroAspas = false; }
                    else { campo += ch; }
                } else {
                    if (ch === '"') dentroAspas = true;
                    else if (ch === ',') { linha.push(campo); campo = ''; }
                    else if (ch === '\r') { /* ignora */ }
                    else if (ch === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
                    else campo += ch;
                }
            }
            if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
            return linhas.filter(l => l.length > 1 && l.some(c => c.trim() !== ''));
        }

        function _parseValorCsv(str) {
            const limpo = str.trim().replace(/\s+/g, '').replace(',', '.');
            return parseFloat(limpo);
        }

        function _parseCartaoCsv(texto) {
            const linhas = _parseCsvLinhas(texto);
            if (!linhas.length) return null;
            const header = linhas[0].map(h => _normalizarTexto(h).trim());
            const idxData = header.indexOf('date');
            const idxTitulo = header.indexOf('title');
            const idxValor = header.indexOf('amount');
            if (idxData === -1 || idxTitulo === -1 || idxValor === -1) return null;

            const resultado = [];
            for (let i = 1; i < linhas.length; i++) {
                const l = linhas[i];
                const data = (l[idxData] || '').trim();
                const descricao = (l[idxTitulo] || '').trim();
                const valor = _parseValorCsv(l[idxValor] || '');
                if (!data || !descricao || isNaN(valor)) continue;
                resultado.push({ data, descricao, valor, chave: `${data}|${descricao}|${valor.toFixed(2)}` });
            }
            return resultado;
        }

        // Filtra as compras (valor negativo = saída de dinheiro) que ainda não foram importadas
        // antes, contando ocorrências repetidas da mesma chave (mesmo método usado no dedup do
        // Extrato Bancário) — assim uma compra genuinamente repetida não é descartada por engano.
        function _dedupImportacaoCartao(fatura, compras) {
            const contagemExistente = {};
            fatura.transacoes.forEach(t => {
                if (t.origemImportId) contagemExistente[t.origemImportId] = (contagemExistente[t.origemImportId] || 0) + 1;
            });
            const contagemVistosAgora = {};
            const novos = [];
            let ignorados = 0;
            compras.forEach(item => {
                contagemVistosAgora[item.chave] = (contagemVistosAgora[item.chave] || 0) + 1;
                const ordinalNoArquivo = contagemVistosAgora[item.chave];
                const jaExistiam = contagemExistente[item.chave] || 0;
                if (ordinalNoArquivo <= jaExistiam) { ignorados++; return; }
                novos.push({ data: item.data, descricao: item.descricao, valor: Math.abs(item.valor), origemImportId: item.chave });
            });
            return { novos, ignorados };
        }

        // === Tela de revisão: usuário confere categorias, desmarca o que não quer e confirma o valor real ===
        function _abrirRevisaoImportacaoCartao(cartaoId, itensBrutos) {
            const cartao = cartoesConfig.find(c => c.id === cartaoId);
            const fatura = _faturaDoCartao(cartaoId);

            const compras = itensBrutos.filter(i => i.valor > 0);
            const creditos = itensBrutos.filter(i => i.valor < 0);
            const { novos, ignorados } = _dedupImportacaoCartao(fatura, compras);

            if (novos.length === 0) {
                mostrarToast(ignorados > 0
                    ? `As ${ignorados} compra(s) desse arquivo já tinham sido importadas antes.`
                    : 'Nenhuma compra encontrada nesse arquivo.', 'warning', 6000);
                return;
            }

            novos.forEach(n => { n.categoria = _sugerirCategoriaCartao(n.descricao); n._incluir = true; });
            window._cartaoRevisaoItens = novos;

            // creditos já vêm com valor negativo (convenção interna) — somar direto já subtrai
            // o valor correto dos pagamentos/estornos do total de compras.
            const somaCreditos = creditos.reduce((s, i) => s + i.valor, 0);
            const totalJaExistente = fatura.transacoes.reduce((s, t) => s + t.valor, 0);
            const somaNovos = novos.reduce((s, n) => s + n.valor, 0);
            const sugestaoTotal = Math.max(0, totalJaExistente + somaNovos + somaCreditos);

            const opcoesCategoria = categoriasAtuais.filter(c => c !== 'Cartão de Crédito');

            const html = `
                <h3 style="margin-bottom: 8px; color: var(--text-highlight); font-size: 1.1rem;">
                    <i class="ph ph-upload-simple"></i> Revisar Importação — ${cartao.nome}
                </h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:14px;">
                    ${novos.length} compra${novos.length > 1 ? 's' : ''} nova${novos.length > 1 ? 's' : ''} encontrada${novos.length > 1 ? 's' : ''}${ignorados > 0 ? `, ${ignorados} já importada${ignorados > 1 ? 's' : ''} antes (ignorada${ignorados > 1 ? 's' : ''})` : ''}. Confira as categorias e desmarque o que não quiser importar.
                </p>
                <div id="cartaoRevisaoLista" class="cartao-revisao-lista"></div>
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-light); padding:12px 14px; border-radius:var(--radius-sm); margin-bottom:8px; margin-top:14px;">
                    <span style="color:var(--text-muted); font-weight:600; font-size:0.8rem;">VALOR REAL DA FATURA</span>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-weight:700; color:var(--text-highlight-alt);">R$</span>
                        <input type="number" id="cartaoRevisaoValorReal" value="${sugestaoTotal.toFixed(2)}" style="width:100px; text-align:right; border:none; background:transparent; font-weight:800; font-size:1.05rem; color:var(--text-highlight-alt);">
                    </div>
                </div>
                <p style="font-size:0.7rem; color:var(--text-muted); margin-bottom:18px;">Pré-preenchido com a soma das compras menos os pagamentos encontrados no arquivo. Ajuste aqui se o valor mostrado no app do banco for diferente.</p>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">Cancelar</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1;">Confirmar Importação</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);
            overlay.querySelector('.modal-content').classList.add('modal-xl');
            _renderizarListaRevisaoCartao(overlay, opcoesCategoria);

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                const incluidos = window._cartaoRevisaoItens.filter(n => n._incluir);
                if (incluidos.length === 0) {
                    mostrarToast('Marque ao menos uma compra pra importar, ou cancele.', 'warning');
                    return;
                }
                const valorReal = parseFloat(overlay.querySelector('#cartaoRevisaoValorReal').value);
                _fecharModalGenerico();

                incluidos.forEach(n => {
                    fatura.transacoes.push({
                        id: Date.now() + Math.floor(Math.random() * 100000),
                        descricao: n.descricao,
                        valor: n.valor,
                        data: n.data,
                        categoria: n.categoria,
                        origemImportId: n.origemImportId
                    });
                });
                fatura.valorConfirmado = isNaN(valorReal) ? null : valorReal;

                _sincronizarContaFixaDoCartao(cartao);
                calcularEAtualizarVisual();
                salvarDadosDoMesAtual();
                mostrarToast(`${incluidos.length} compra${incluidos.length > 1 ? 's' : ''} importada${incluidos.length > 1 ? 's' : ''}.`, 'success');
                delete window._cartaoRevisaoItens;
            };
            overlay.querySelector('#modalBtnCancelar').onclick = () => { _fecharModalGenerico(); delete window._cartaoRevisaoItens; };
        }

        function _renderizarListaRevisaoCartao(overlay, opcoesCategoria) {
            const lista = overlay.querySelector('#cartaoRevisaoLista');
            const itens = window._cartaoRevisaoItens || [];
            lista.innerHTML = itens.map((n, i) => `
                <div class="cartao-revisao-item">
                    <input type="checkbox" class="row-check" ${n._incluir ? 'checked' : ''} onchange="_revisaoCartaoTogglar(${i})">
                    <div class="cartao-revisao-main">
                        <input type="text" class="cartao-revisao-desc" value="${n.descricao.replace(/"/g, '&quot;')}" oninput="_revisaoCartaoCampo(${i},'descricao',this.value)">
                        <div class="cartao-revisao-linha2">
                            <span class="vencimento-tag" style="color:var(--text-muted); background-color:var(--card-bg);">${formatarData(n.data)}</span>
                            <select class="cartao-revisao-categoria" onchange="_revisaoCartaoCampo(${i},'categoria',this.value)">
                                ${opcoesCategoria.map(c => `<option value="${c}" ${c === n.categoria ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <strong class="cartao-revisao-valor">R$ ${n.valor.toFixed(2)}</strong>
                </div>
            `).join('');
        }

        function _revisaoCartaoTogglar(idx) {
            if (window._cartaoRevisaoItens && window._cartaoRevisaoItens[idx]) {
                window._cartaoRevisaoItens[idx]._incluir = !window._cartaoRevisaoItens[idx]._incluir;
            }
        }
        function _revisaoCartaoCampo(idx, campo, valor) {
            if (window._cartaoRevisaoItens && window._cartaoRevisaoItens[idx]) {
                window._cartaoRevisaoItens[idx][campo] = valor;
            }
        }
