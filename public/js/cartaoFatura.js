// Card "Cartões de Crédito" no Dashboard (Fase 2): lançamento manual das compras da fatura,
// com o valor total sincronizado automaticamente numa conta fixa vinculada (campo Valor travado
// lá — só muda por aqui). A importação de arquivo (Fase 3) e os gráficos (Fase 4) reaproveitam
// essa mesma estrutura de dados.

        function _cartaoAtivo() {
            if (!cartoesConfig.length) return null;
            if (!cartaoSelecionadoId || !cartoesConfig.some(c => c.id === cartaoSelecionadoId)) {
                cartaoSelecionadoId = cartoesConfig[0].id;
            }
            return cartoesConfig.find(c => c.id === cartaoSelecionadoId);
        }

        // Versão que MATERIALIZA a fatura no estado — usar só em caminho de escrita (logo antes de
        // um salvarDadosDoMesAtual). Chamar no render criava linha `cartao_faturas` vazia (fatura-
        // fantasma) pra todo mês já aberto desde que um cartão foi cadastrado — ver M2 da auditoria.
        function _faturaDoCartao(cartaoId) {
            if (!window.activeCartoesFaturas) window.activeCartoesFaturas = {};
            if (!window.activeCartoesFaturas[cartaoId]) window.activeCartoesFaturas[cartaoId] = { transacoes: [] };
            return window.activeCartoesFaturas[cartaoId];
        }

        // Leitura pura (não muta o estado) — usar em render e em qualquer consulta que não vá gravar.
        function _faturaDoCartaoLeitura(cartaoId) {
            const f = window.activeCartoesFaturas && window.activeCartoesFaturas[cartaoId];
            return f || { transacoes: [] };
        }

        // Valor total da fatura, em ordem de prioridade:
        // 1. valorConfirmado — confirmado manualmente numa importação (Fase 3), quando o valor
        //    real difere da soma das compras (ex.: juros que ainda não apareceram no arquivo).
        // 2. Soma das compras lançadas (manual ou importada) — dado real, sempre que existir.
        // 3. valorEstimado — só um chute pra planejamento, usado apenas enquanto NÃO existe
        //    nenhum dado real ainda; assim que a fatura ganha uma compra de verdade (ou é
        //    confirmada numa importação), o estimado deixa de valer sozinho.
        function _totalFatura(fatura) {
            // > 0, não só != null: um "valor confirmado" de 0 (dado antigo, ou fat-finger) não
            // deve zerar uma fatura que tem compras lançadas.
            if (fatura.valorConfirmado != null && fatura.valorConfirmado > 0) return fatura.valorConfirmado;
            const somaTransacoes = fatura.transacoes.reduce((s, t) => s + t.valor, 0);
            if (somaTransacoes > 0) return somaTransacoes;
            if (fatura.valorEstimado != null) return fatura.valorEstimado;
            return 0;
        }

        // Verdadeiro só quando a fatura ainda não tem nenhum dado real (nem compra lançada, nem
        // importação confirmada) — é a única situação em que o valor estimado está em uso.
        function _faturaSemDadosReais(fatura) {
            return fatura.valorConfirmado == null && fatura.transacoes.reduce((s, t) => s + t.valor, 0) === 0;
        }

        function selecionarCartao(id) {
            cartaoSelecionadoId = id;
            animarNaCarga = true; // reanima a troca de conteúdo (odômetro, itens) ao trocar de cartão
            renderizarCartoesDashboard();
        }

        // Cria (na primeira vez) ou atualiza a conta fixa vinculada a este cartão com o total atual
        // da fatura. Nome/categoria/vencimento continuam editáveis pelo usuário depois de criados;
        // só o valor é sempre sobrescrito por aqui, pra nunca ficar dessincronizado do cartão.
        function _sincronizarContaFixaDoCartao(cartao) {
            if (!cartao) return;
            const fatura = _faturaDoCartao(cartao.id);
            const total = _totalFatura(fatura);

            if (!categoriasAtuais.includes('Cartão de Crédito')) {
                categoriasAtuais.push('Cartão de Crédito');
                salvarConfigGlobal();
                renderizarListasDeCategorias();
            }

            const contaVinculada = window.activeFixas.find(f => f.origemCartaoId === cartao.id);
            if (contaVinculada) {
                contaVinculada.valor = total;
            } else {
                window.activeFixas.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    nome: cartao.nome,
                    valor: total,
                    vencimento: cartao.diaVencimento,
                    categoria: 'Cartão de Crédito',
                    obs: '',
                    pago: false,
                    origemCartaoId: cartao.id
                });
            }
        }

        // Renderização pura (sem salvar nada) — chamada de dentro de calcularEAtualizarVisual(),
        // igual renderizarAssinaturas()/renderizarExtrato(). Quem muda dados chama a sincronização
        // e o salvamento explicitamente antes de recalcular a tela.
        function renderizarCartoesDashboard() {
            const seletorEl = document.getElementById('cartaoSeletorPills');
            const vazioEl = document.getElementById('cartaoSemCadastro');
            const conteudoEl = document.getElementById('cartaoConteudo');
            if (!seletorEl || !vazioEl || !conteudoEl) return;

            if (cartoesConfig.length === 0) {
                vazioEl.style.display = 'block';
                conteudoEl.style.display = 'none';
                seletorEl.style.display = 'none';
                seletorEl.innerHTML = '';
                return;
            }
            vazioEl.style.display = 'none';
            conteudoEl.style.display = 'block';

            const cartao = _cartaoAtivo();

            seletorEl.style.display = cartoesConfig.length > 1 ? 'flex' : 'none';
            seletorEl.innerHTML = cartoesConfig.map(c =>
                `<button class="cartao-pill ${c.id === cartao.id ? 'ativo' : ''}" onclick="selecionarCartao(${c.id})">${_esc(c.nome)}</button>`
            ).join('');

            const fatura = _faturaDoCartaoLeitura(cartao.id);
            const transacoesOrdenadas = [...fatura.transacoes].sort((a, b) => b.data.localeCompare(a.data));
            const total = _totalFatura(fatura);

            // Gráfico de acumulado por categoria — só desse cartão, só as categorias com gasto de verdade.
            const totaisPorCategoria = {};
            fatura.transacoes.forEach(t => { totaisPorCategoria[t.categoria] = (totaisPorCategoria[t.categoria] || 0) + t.valor; });
            const entradasCategoria = Object.entries(totaisPorCategoria).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

            const chartWrapEl = document.getElementById('cartaoChartWrap');
            const listaCategoriaEl = document.getElementById('listaCartaoCategoria');
            if (chartWrapEl) chartWrapEl.style.display = entradasCategoria.length > 0 ? 'block' : 'none';
            if (listaCategoriaEl) {
                listaCategoriaEl.innerHTML = entradasCategoria.map(([cat, valor]) => `
                    <div class="acumulado-item">
                        <span style="display:flex; align-items:center; gap:8px;">
                            <i class="ph ph-${obterIconeCategoria(cat)}" style="font-size:18px; color:var(--text-muted);"></i> ${_esc(cat)}
                        </span>
                        <span style="color:var(--text-highlight); font-weight:700">R$ ${valor.toFixed(2)}</span>
                    </div>
                `).join('');
            }
            atualizarChartCartaoCategoria(entradasCategoria);

            const classeAnim = animarNaCarga ? ' item-anim' : '';
            const listaEl = document.getElementById('listaCartaoTransacoes');
            if (listaEl) {
                listaEl.innerHTML = transacoesOrdenadas.length === 0
                    ? `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:16px 0;">Nenhuma compra lançada ainda nesta fatura.</p>`
                    : transacoesOrdenadas.map((t, i) => `
                        <div class="cartao-transacao-item${classeAnim}" style="animation-delay:${Math.min(i * 0.03, 0.4)}s">
                            <div class="cartao-transacao-icon"><i class="ph ph-${obterIconeCategoria(t.categoria)}"></i></div>
                            <div class="cartao-transacao-main">
                                <button class="item-link cartao-transacao-desc" onclick="abrirModalCartaoTransacao(${cartao.id}, ${t.id})">${_esc(t.descricao)}</button>
                                <div class="cartao-transacao-tags">
                                    <span class="vencimento-tag" style="color:var(--text-muted); background-color:var(--bg-light);">${formatarData(t.data)}</span>
                                    <span class="vencimento-tag" style="color:var(--text-highlight-alt); background-color:var(--bg-blue-light);">${_esc(t.categoria)}</span>
                                </div>
                            </div>
                            <strong class="cartao-transacao-valor">R$ ${t.valor.toFixed(2)}</strong>
                        </div>
                    `).join('');
            }

            const vencEl = document.getElementById('cartaoVencimentoInfo');
            if (vencEl) vencEl.innerText = `Fecha dia ${cartao.diaFechamento} · Vence dia ${cartao.diaVencimento}`;

            animarNumero('cartaoTotalFatura', total, animarNaCarga ? 1800 : 500);

            const semDadosReais = _faturaSemDadosReais(fatura);
            const labelEl = document.getElementById('cartaoTotalFaturaLabel');
            if (labelEl) labelEl.innerText = semDadosReais && fatura.valorEstimado != null ? 'TOTAL DA FATURA (ESTIMADO)' : 'TOTAL DA FATURA';
            const estBtn = document.getElementById('cartaoEstimativaBtn');
            if (estBtn) {
                if (semDadosReais) {
                    estBtn.style.display = 'inline-flex';
                    estBtn.innerHTML = fatura.valorEstimado != null
                        ? '<i class="ph ph-pencil-simple"></i> Editar valor estimado'
                        : '<i class="ph ph-plus"></i> Definir valor estimado (planejamento)';
                } else {
                    estBtn.style.display = 'none';
                }
            }
        }

        // Valor estimado: só pra planejamento, enquanto a fatura ainda não tem nenhuma compra
        // real lançada ou importada. Some sozinho assim que a fatura ganha dados reais.
        function abrirModalEstimativaCartao() {
            const cartao = _cartaoAtivo();
            if (!cartao) return;
            const faturaLeitura = _faturaDoCartaoLeitura(cartao.id);
            abrirModalPrompt({
                titulo: 'Valor Estimado da Fatura',
                mensagem: `Só pra planejamento — reflete em Contas Fixas até você lançar ou importar compras de verdade em "${cartao.nome}". A partir daí, some sozinho.`,
                placeholder: 'Ex: 500,00',
                dinheiro: true,
                valorInicial: faturaLeitura.valorEstimado != null ? faturaLeitura.valorEstimado : '',
                textoConfirmar: 'Salvar',
                onConfirmar: (valor) => {
                    const fatura = _faturaDoCartao(cartao.id);
                    fatura.valorEstimado = (isNaN(valor) || valor <= 0) ? null : valor;
                    _sincronizarContaFixaDoCartao(cartao);
                    calcularEAtualizarVisual();
                    salvarDadosDoMesAtual();
                    mostrarToast(fatura.valorEstimado != null ? 'Valor estimado salvo.' : 'Valor estimado removido.', 'success');
                }
            });
        }

        // Popup único de criar/editar uma compra da fatura. transacaoId=null cria uma nova.
        function abrirModalCartaoTransacao(cartaoId, transacaoId) {
            const editando = transacaoId != null;
            const t = editando ? _faturaDoCartaoLeitura(cartaoId).transacoes.find(x => x.id === transacaoId) : null;
            if (editando && !t) return;

            const hojeStr = new Date().toISOString().split('T')[0];
            const opcoesCategoria = categoriasAtuais
                .filter(c => c !== 'Cartão de Crédito')
                .map(c => `<option value="${_esc(c)}" ${t && c === t.categoria ? 'selected' : ''}>${_esc(c)}</option>`)
                .join('');

            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">
                    <i class="ph ph-${editando ? 'pencil-simple' : 'plus-circle'}"></i> ${editando ? 'Editar Compra' : 'Nova Compra'}
                </h3>
                <input type="text" id="modalCartaoTransDescInput" placeholder="Ex: Supermercado" style="width:100%; margin-bottom:12px;" value="${t ? _esc(t.descricao) : ''}">
                <div class="input-inline" style="margin-bottom: 12px;">
                    <input type="text" inputmode="decimal" data-dinheiro id="modalCartaoTransValorInput" placeholder="Valor (R$)" style="flex:1;" value="${t ? _formatarDinheiroInput(t.valor) : ''}">
                    <input type="date" id="modalCartaoTransDataInput" style="flex:1;" value="${t ? t.data : hojeStr}">
                </div>
                <select id="modalCartaoTransCategoriaInput" style="width:100%; margin-bottom:20px;">${opcoesCategoria}</select>
                <div style="display: flex; gap: 10px;">
                    ${editando ? `<button class="btn-action btn-delete" id="modalBtnExcluirTrans" style="flex:0 0 auto; padding:0 14px;" title="Excluir"><i class="ph ph-trash"></i></button>` : ''}
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">Cancelar</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1;">${editando ? 'Salvar' : 'Adicionar'}</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                const descricao = overlay.querySelector('#modalCartaoTransDescInput').value.trim();
                const valor = _parseDinheiro(overlay.querySelector('#modalCartaoTransValorInput').value);
                const data = overlay.querySelector('#modalCartaoTransDataInput').value;
                const categoria = overlay.querySelector('#modalCartaoTransCategoriaInput').value;
                if (!descricao || isNaN(valor) || !data) {
                    mostrarToast('Preencha descrição, valor e data.', 'warning');
                    return;
                }
                _fecharModalGenerico();
                const fatura = _faturaDoCartao(cartaoId);
                if (editando) {
                    const alvo = fatura.transacoes.find(x => x.id === transacaoId) || t;
                    alvo.descricao = descricao; alvo.valor = valor; alvo.data = data; alvo.categoria = categoria;
                } else {
                    fatura.transacoes.push({ id: Date.now() + Math.floor(Math.random() * 1000), descricao, valor, data, categoria });
                }
                // Lançamento manual: o total volta a ser a soma das compras lançadas (não fica
                // preso a um valor confirmado de uma importação anterior nem a uma estimativa).
                fatura.valorConfirmado = null;
                fatura.valorEstimado = null;
                const cartao = cartoesConfig.find(c => c.id === cartaoId);
                _sincronizarContaFixaDoCartao(cartao);
                calcularEAtualizarVisual();
                salvarDadosDoMesAtual();
                mostrarToast(editando ? 'Compra atualizada.' : 'Compra adicionada.', 'success');
            };
            if (editando) {
                overlay.querySelector('#modalBtnExcluirTrans').onclick = () => {
                    _fecharModalGenerico();
                    deletarCartaoTransacao(cartaoId, transacaoId);
                };
            }
            overlay.querySelector('#modalBtnCancelar').onclick = _fecharModalGenerico;
        }

        function deletarCartaoTransacao(cartaoId, transacaoId) {
            const fatura = _faturaDoCartao(cartaoId);
            const idx = fatura.transacoes.findIndex(t => t.id === transacaoId);
            if (idx === -1) return;
            const item = fatura.transacoes[idx];
            fatura.transacoes.splice(idx, 1);
            fatura.valorConfirmado = null;

            const cartao = cartoesConfig.find(c => c.id === cartaoId);
            _sincronizarContaFixaDoCartao(cartao);
            calcularEAtualizarVisual();

            excluirComUndo({
                mensagem: `Compra excluída: ${item.descricao}`,
                restaurar: () => {
                    fatura.transacoes.splice(idx, 0, item);
                    _sincronizarContaFixaDoCartao(cartao);
                    calcularEAtualizarVisual();
                    salvarDadosDoMesAtual();
                },
                persistir: () => salvarDadosDoMesAtual()
            });
        }

        // Abre o popup de nova compra pro cartão selecionado no momento.
        function abrirModalNovaCompraCartao() {
            const cartao = _cartaoAtivo();
            if (!cartao) { mostrarToast('Cadastre um cartão em Configurações antes de lançar uma compra.', 'warning'); return; }
            abrirModalCartaoTransacao(cartao.id, null);
        }

        // Botão "+" do título do card: pergunta se é uma nova compra ou um novo cartão.
        function abrirMenuNovoItemCartao(btnEl) {
            abrirMenuContexto([
                { label: 'Nova Compra', icone: 'shopping-cart-simple', onClick: () => abrirModalNovaCompraCartao() },
                { label: 'Novo Cartão', icone: 'credit-card', onClick: () => abrirModalCartao(null) }
            ], btnEl);
        }

        // Apaga todas as compras + valor confirmado/estimado da fatura do cartão selecionado no
        // momento (a conta fixa vinculada zera junto). Pede confirmação antes, igual o "Limpar
        // extrato do mês" do card de Extrato Bancário.
        function confirmarLimparFaturaCartao() {
            const cartao = _cartaoAtivo();
            if (!cartao) { mostrarToast('Nenhum cartão selecionado.', 'warning'); return; }
            const fatura = _faturaDoCartaoLeitura(cartao.id);
            if (fatura.transacoes.length === 0 && fatura.valorConfirmado == null && fatura.valorEstimado == null) {
                mostrarToast(`Não há dados lançados na fatura de "${cartao.nome}" ainda.`, 'warning');
                return;
            }
            abrirModalConfirmacao({
                titulo: 'Limpar fatura',
                mensagem: `Isso vai apagar ${fatura.transacoes.length} compra(s) lançada(s), qualquer valor confirmado/estimado, e a conta fixa vinculada à fatura de "${cartao.nome}" neste mês. Essa ação não pode ser desfeita. Confirma?`,
                textoConfirmar: 'Apagar tudo',
                corConfirmar: 'var(--red-danger)',
                onConfirmar: () => _limparFaturaCartao(cartao)
            });
        }

        function _limparFaturaCartao(cartao) {
            // Só chega aqui se a fatura já tem dados (confirmarLimparFaturaCartao barra o resto),
            // então ela existe no estado — não precisa materializar.
            const fatura = _faturaDoCartaoLeitura(cartao.id);
            fatura.transacoes = [];
            fatura.valorConfirmado = null;
            fatura.valorEstimado = null;
            // Remove a conta fixa vinculada de vez — não faz sentido deixar uma conta de R$ 0,00
            // "pendurada" em Contas Fixas (e ainda por cima marcada como vencida) depois de limpar.
            window.activeFixas = window.activeFixas.filter(f => f.origemCartaoId !== cartao.id);
            calcularEAtualizarVisual();
            salvarDadosDoMesAtual();
            mostrarToast(`Fatura de "${cartao.nome}" apagada.`, 'success');
        }
