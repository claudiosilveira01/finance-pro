// Assinaturas informativas (fora do orçamento fixo)

        // Banco de ícones por categoria de assinatura — cada categoria já vem com um ícone Phosphor
        // pensado pro tipo de serviço (streaming, fitness, rastreamento...), escolhido na hora de
        // criar/editar a assinatura. Separado das categorias de orçamento (usadas em Contas Fixas).
        const CATEGORIAS_ASSINATURA = [
            { nome: 'Streaming de Vídeo', icone: 'youtube-logo' },
            { nome: 'Streaming de Música', icone: 'spotify-logo' },
            { nome: 'Nuvem / Armazenamento', icone: 'cloud' },
            { nome: 'Inteligência Artificial', icone: 'robot' },
            { nome: 'Produtividade', icone: 'briefcase' },
            { nome: 'Academia / Fitness', icone: 'barbell' },
            { nome: 'Rastreamento / Segurança', icone: 'satellite' },
            { nome: 'Internet / Telefonia', icone: 'wifi-high' },
            { nome: 'Jogos', icone: 'game-controller' },
            { nome: 'Notícias / Leitura', icone: 'newspaper' },
            { nome: 'Educação / Cursos', icone: 'graduation-cap' },
            { nome: 'Compras / Clube', icone: 'shopping-bag-open' },
            { nome: 'Saúde / Bem-estar', icone: 'heartbeat' },
            { nome: 'Seguro', icone: 'shield-check' },
            { nome: 'Alimentação / Delivery', icone: 'hamburger' },
            { nome: 'Transporte', icone: 'car' },
            { nome: 'Design / Criação', icone: 'palette' },
            { nome: 'Redes Sociais', icone: 'share-network' },
            { nome: 'Apple / Serviços', icone: 'apple-logo' },
            { nome: 'Google / Serviços', icone: 'google-logo' },
            { nome: 'Outros', icone: 'bell' }
        ];

        function obterIconeAssinatura(categoria) {
            const cat = CATEGORIAS_ASSINATURA.find(c => c.nome === categoria);
            return cat ? cat.icone : 'bell';
        }

        // Popup único de criar/editar assinatura (substitui o formulário que ficava em
        // Configurações). id=null cria uma nova; um id existente abre pra edição.
        function abrirModalAssinatura(id) {
            const editando = id != null;
            const sub = editando ? assinaturasConfig.find(s => s.id === id) : null;
            if (editando && !sub) return;

            const categoriaInicial = (sub && sub.categoria) || CATEGORIAS_ASSINATURA[0].nome;
            const opcoesCategoria = CATEGORIAS_ASSINATURA.map(c =>
                `<option value="${c.nome}" ${c.nome === categoriaInicial ? 'selected' : ''}>${c.nome}</option>`
            ).join('');

            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">
                    <i class="ph ph-${editando ? 'pencil-simple' : 'plus-circle'}"></i> ${editando ? 'Editar Assinatura' : 'Nova Assinatura'}
                </h3>
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
                    <div class="assinatura-item-icon" id="modalAssinIconePreview" style="width:52px; height:52px; min-width:52px; font-size:1.5rem;">
                        <i class="ph ph-${obterIconeAssinatura(categoriaInicial)}"></i>
                    </div>
                    <select id="modalAssinCategoriaSel" style="flex:1;">${opcoesCategoria}</select>
                </div>
                <input type="text" id="modalAssinNomeInput" placeholder="Ex: Netflix" style="width:100%; margin-bottom:12px;" value="${sub ? sub.nome : ''}">
                <div class="input-inline" style="margin-bottom: 20px;">
                    <input type="number" id="modalAssinValorInput" placeholder="Valor (R$)" style="flex:1;" value="${sub && sub.valor ? sub.valor : ''}">
                    <input type="number" id="modalAssinVencInput" placeholder="Dia Venc." min="1" max="31" style="flex:1;" value="${sub ? sub.vencimento : ''}">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">Cancelar</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1;">${editando ? 'Salvar' : 'Adicionar'}</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);

            const selectCat = overlay.querySelector('#modalAssinCategoriaSel');
            const iconePreview = overlay.querySelector('#modalAssinIconePreview');
            selectCat.onchange = () => {
                iconePreview.innerHTML = `<i class="ph ph-${obterIconeAssinatura(selectCat.value)}"></i>`;
            };

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                const nome = overlay.querySelector('#modalAssinNomeInput').value.trim();
                const valor = parseFloat(overlay.querySelector('#modalAssinValorInput').value);
                const venc = parseInt(overlay.querySelector('#modalAssinVencInput').value);
                const categoria = selectCat.value;
                if (!nome || isNaN(venc)) {
                    mostrarToast('Preencha ao menos o nome e o dia de vencimento.', 'warning');
                    return;
                }
                _fecharModalGenerico();
                if (editando) {
                    sub.nome = nome;
                    sub.valor = isNaN(valor) ? 0 : valor;
                    sub.vencimento = venc;
                    sub.categoria = categoria;
                } else {
                    assinaturasConfig.push({ id: Date.now(), nome, valor: isNaN(valor) ? 0 : valor, vencimento: venc, categoria });
                }
                salvarConfigGlobal();
                calcularEAtualizarVisual();
                mostrarToast(editando ? `"${nome}" atualizada.` : `"${nome}" adicionada.`, 'success');
            };
            overlay.querySelector('#modalBtnCancelar').onclick = _fecharModalGenerico;
        }

        function deletarAssinatura(id) {
            const idx = assinaturasConfig.findIndex(s => s.id === id);
            if(idx === -1) return;
            const item = assinaturasConfig[idx];

            assinaturasConfig.splice(idx, 1);
            calcularEAtualizarVisual();

            excluirComUndo({
                mensagem: `Assinatura excluída: ${item.nome}`,
                restaurar: () => { assinaturasConfig.splice(idx, 0, item); calcularEAtualizarVisual(); },
                persistir: () => salvarConfigGlobal()
            });
        }

        // Alimenta os dois lugares onde a lista de assinaturas aparece: o card do Dashboard e Configurações.
        // Sempre ordenada por dia de vencimento; "faturado" é por mês (faturadoEm guarda o mesAtualKey em
        // que foi marcado), então navegar entre meses mostra corretamente o status daquele mês específico.
        function renderizarAssinaturas() {
            let totalAssin = 0;
            const ordenadas = [...assinaturasConfig].sort((a, b) => (a.vencimento || 0) - (b.vencimento || 0));
            const itensHtml = ordenadas.map(s => {
                totalAssin += (s.valor || 0);
                let valorFormatado = s.valor ? `R$ ${s.valor.toFixed(2)}` : '';
                const faturado = s.faturadoEm === mesAtualKey;
                let alerta = calcularAlertaVencimento(s.vencimento, faturado);
                const icone = obterIconeAssinatura(s.categoria);
                return `<div class="assinatura-item">
                    <div class="assinatura-item-icon"><i class="ph ph-${icone}"></i></div>
                    <div class="assinatura-item-main">
                        <div class="assinatura-item-top">
                            <button class="item-link assinatura-item-nome" onclick="abrirModalAssinatura(${s.id})">${s.nome}</button>
                            <span class="assinatura-item-valor">${valorFormatado}</span>
                        </div>
                        <div class="assinatura-item-tags">
                            <button class="status-badge wide ${faturado ? 'sim' : 'nao'}" onclick="toggleFaturadoAssinatura(${s.id})" title="Marcar/desmarcar como faturado neste mês">${faturado ? 'Faturado' : 'Faturar'}</button>
                            <span class="vencimento-tag" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span>
                        </div>
                    </div>
                    <button class="btn-action assinatura-item-menu" onclick="abrirMenuAssinatura(${s.id}, this)" title="Mais opções"><i class="ph ph-dots-three-vertical" style="font-size:1.2rem;"></i></button>
                </div>`;
            }).join('');

            ['listaAssinaturasCard', 'listaAssinaturasConfig'].forEach(elId => {
                const el = document.getElementById(elId);
                if(el) el.innerHTML = itensHtml;
            });

            const totalEl = document.getElementById('totalAssinaturas');
            if(totalEl) totalEl.innerText = `R$ ${totalAssin.toFixed(2)}`;
        }

        // Alterna o status de faturado da assinatura para o mês atualmente selecionado no app. Ao
        // MARCAR como faturada, pergunta em que data o pagamento foi feito de verdade (o clique
        // nem sempre acontece no mesmo dia) — botão "Foi hoje" ou uma data escolhida. Ao desmarcar,
        // aplica na hora. Grava um registro do evento (mesmo mecanismo do Pago/Não Pago das contas
        // fixas) — usado só no Relatório Mensal em PDF, não aparece em nenhuma tela do app.
        function toggleFaturadoAssinatura(id) {
            const sub = assinaturasConfig.find(s => s.id === id);
            if(!sub) return;
            const jaFaturado = sub.faturadoEm === mesAtualKey;

            if (jaFaturado) {
                _aplicarToggleFaturadoAssinatura(id, false, null);
                return;
            }

            abrirModalData({
                titulo: `Quando você pagou/faturou "${sub.nome}"?`,
                onConfirmar: (dataPagamento) => _aplicarToggleFaturadoAssinatura(id, true, dataPagamento)
            });
        }

        function _aplicarToggleFaturadoAssinatura(id, marcarComoFaturado, dataPagamento) {
            const sub = assinaturasConfig.find(s => s.id === id);
            if(!sub) return;
            sub.faturadoEm = marcarComoFaturado ? mesAtualKey : null;
            salvarConfigGlobal();

            if (!window.activeRegistroPagamentos) window.activeRegistroPagamentos = [];
            window.activeRegistroPagamentos.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                contaId: id,
                nome: sub.nome,
                valor: sub.valor || 0,
                marcadoComoPago: marcarComoFaturado,
                tipo: 'assinatura',
                dataPagamento: dataPagamento,
                registradoEm: new Date().toISOString()
            });

            // O dinheiro sai de verdade do Caixa Atual ao marcar como faturada, e volta se
            // desmarcar (ex.: clicou por engano). ajustarCaixaAtual() já salva tudo de uma vez.
            ajustarCaixaAtual(marcarComoFaturado ? -(sub.valor || 0) : (sub.valor || 0));

            renderizarAssinaturas();
            mostrarToast(marcarComoFaturado ? `"${sub.nome}" marcada como faturada em ${mesAtualKey}.` : `"${sub.nome}" voltou para não faturada.`, 'success');
        }

        // Menu de ações por assinatura: Faturar, Adicionar às Contas Fixas, Classificação, Excluir.
        function abrirMenuAssinatura(id, btnEl) {
            const sub = assinaturasConfig.find(s => s.id === id);
            if(!sub) return;
            const faturado = sub.faturadoEm === mesAtualKey;
            abrirMenuContexto([
                { label: faturado ? 'Desfazer Faturamento' : 'Faturar', icone: faturado ? 'arrow-counter-clockwise' : 'check-circle', onClick: () => toggleFaturadoAssinatura(id) },
                { label: 'Editar', icone: 'pencil-simple', onClick: () => abrirModalAssinatura(id) },
                { label: 'Adicionar às Contas Fixas', icone: 'list-plus', onClick: () => abrirModalAssinaturaParaFixa(id) },
                { label: 'Excluir', icone: 'trash', perigo: true, onClick: () => deletarAssinatura(id) }
            ], btnEl);
        }

        // Abre modal pré-preenchido para transformar uma assinatura informativa numa conta fixa avulsa do mês atual
        function abrirModalAssinaturaParaFixa(id) {
            const sub = assinaturasConfig.find(s => s.id === id);
            if(!sub) return;

            const opcoesCategoria = categoriasAtuais.map(c => `<option value="${c}">${c}</option>`).join('');
            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">Adicionar às Contas Fixas</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">Confirme os dados da conta fixa a criar no mês atual, baseada em "${sub.nome}":</p>
                <div class="input-inline" style="margin-bottom: 10px;">
                    <input type="text" id="modalAssinNome" style="flex:2;" value="${sub.nome}" placeholder="Item">
                    <input type="number" id="modalAssinValor" style="flex:1;" value="${sub.valor || ''}" placeholder="R$">
                </div>
                <div class="input-inline" style="margin-bottom: 20px;">
                    <input type="number" id="modalAssinVenc" style="flex:1;" value="${sub.vencimento}" min="1" max="31" placeholder="Dia Venc.">
                    <select id="modalAssinCategoria" style="flex:1.5;">${opcoesCategoria}</select>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">Cancelar</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1; background: var(--green-success);">Adicionar</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                const nome = overlay.querySelector('#modalAssinNome').value.trim();
                const valor = parseFloat(overlay.querySelector('#modalAssinValor').value);
                const venc = parseInt(overlay.querySelector('#modalAssinVenc').value);
                const categoria = overlay.querySelector('#modalAssinCategoria').value;
                if(!nome || isNaN(valor) || isNaN(venc)) {
                    mostrarToast('Preencha nome, valor e dia de vencimento corretamente.', 'warning');
                    return;
                }
                _fecharModalGenerico();
                window.activeFixas.push({ id: Date.now(), nome, valor, vencimento: venc, categoria, obs: '', pago: false });
                salvarDadosDoMesAtual();
                calcularEAtualizarVisual();
                mostrarToast(`"${nome}" adicionada às contas fixas de ${mesAtualKey}.`, 'success');
            };
            overlay.querySelector('#modalBtnCancelar').onclick = _fecharModalGenerico;
        }
