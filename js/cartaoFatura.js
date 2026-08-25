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

        function _faturaDoCartao(cartaoId) {
            if (!window.activeCartoesFaturas) window.activeCartoesFaturas = {};
            if (!window.activeCartoesFaturas[cartaoId]) window.activeCartoesFaturas[cartaoId] = { transacoes: [] };
            return window.activeCartoesFaturas[cartaoId];
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
            const total = fatura.transacoes.reduce((s, t) => s + t.valor, 0);

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
                `<button class="cartao-pill ${c.id === cartao.id ? 'ativo' : ''}" onclick="selecionarCartao(${c.id})">${c.nome}</button>`
            ).join('');

            const fatura = _faturaDoCartao(cartao.id);
            const transacoesOrdenadas = [...fatura.transacoes].sort((a, b) => b.data.localeCompare(a.data));
            const total = fatura.transacoes.reduce((s, t) => s + t.valor, 0);

            const classeAnim = animarNaCarga ? ' item-anim' : '';
            const listaEl = document.getElementById('listaCartaoTransacoes');
            if (listaEl) {
                listaEl.innerHTML = transacoesOrdenadas.length === 0
                    ? `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:16px 0;">Nenhuma compra lançada ainda nesta fatura.</p>`
                    : transacoesOrdenadas.map((t, i) => `
                        <div class="cartao-transacao-item${classeAnim}" style="animation-delay:${Math.min(i * 0.03, 0.4)}s">
                            <div class="cartao-transacao-icon"><i class="ph ph-${obterIconeCategoria(t.categoria)}"></i></div>
                            <div class="cartao-transacao-main">
                                <button class="item-link cartao-transacao-desc" onclick="abrirModalCartaoTransacao(${cartao.id}, ${t.id})">${t.descricao}</button>
                                <div class="cartao-transacao-tags">
                                    <span class="vencimento-tag" style="color:var(--text-muted); background-color:var(--bg-light);">${formatarData(t.data)}</span>
                                    <span class="vencimento-tag" style="color:var(--text-highlight-alt); background-color:var(--bg-blue-light);">${t.categoria}</span>
                                </div>
                            </div>
                            <strong class="cartao-transacao-valor">R$ ${t.valor.toFixed(2)}</strong>
                        </div>
                    `).join('');
            }

            const vencEl = document.getElementById('cartaoVencimentoInfo');
            if (vencEl) vencEl.innerText = `Fecha dia ${cartao.diaFechamento} · Vence dia ${cartao.diaVencimento}`;

            animarNumero('cartaoTotalFatura', total, animarNaCarga ? 1800 : 500);
        }

        // Popup único de criar/editar uma compra da fatura. transacaoId=null cria uma nova.
        function abrirModalCartaoTransacao(cartaoId, transacaoId) {
            const fatura = _faturaDoCartao(cartaoId);
            const editando = transacaoId != null;
            const t = editando ? fatura.transacoes.find(x => x.id === transacaoId) : null;
            if (editando && !t) return;

            const hojeStr = new Date().toISOString().split('T')[0];
            const opcoesCategoria = categoriasAtuais
                .filter(c => c !== 'Cartão de Crédito')
                .map(c => `<option value="${c}" ${t && c === t.categoria ? 'selected' : ''}>${c}</option>`)
                .join('');

            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">
                    <i class="ph ph-${editando ? 'pencil-simple' : 'plus-circle'}"></i> ${editando ? 'Editar Compra' : 'Nova Compra'}
                </h3>
                <input type="text" id="modalCartaoTransDescInput" placeholder="Ex: Supermercado" style="width:100%; margin-bottom:12px;" value="${t ? t.descricao : ''}">
                <div class="input-inline" style="margin-bottom: 12px;">
                    <input type="number" id="modalCartaoTransValorInput" placeholder="Valor (R$)" style="flex:1;" value="${t ? t.valor : ''}">
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
                const valor = parseFloat(overlay.querySelector('#modalCartaoTransValorInput').value);
                const data = overlay.querySelector('#modalCartaoTransDataInput').value;
                const categoria = overlay.querySelector('#modalCartaoTransCategoriaInput').value;
                if (!descricao || isNaN(valor) || !data) {
                    mostrarToast('Preencha descrição, valor e data.', 'warning');
                    return;
                }
                _fecharModalGenerico();
                if (editando) {
                    t.descricao = descricao; t.valor = valor; t.data = data; t.categoria = categoria;
                } else {
                    fatura.transacoes.push({ id: Date.now(), descricao, valor, data, categoria });
                }
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

        // Botão "+" do card: abre direto o popup de nova compra pro cartão selecionado no momento.
        function abrirModalNovaCompraCartao() {
            const cartao = _cartaoAtivo();
            if (!cartao) return;
            abrirModalCartaoTransacao(cartao.id, null);
        }
