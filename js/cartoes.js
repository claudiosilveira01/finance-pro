// Cadastro dos cartões de crédito (Fase 1: só o cadastro em Configurações + estrutura de dados —
// o card "Cartões de Crédito" do Dashboard, a importação de fatura e os gráficos vêm nas próximas fases).
        function renderizarCartoesConfig() {
            const box = document.getElementById('listaCartoesConfig');
            if (!box) return;

            if (cartoesConfig.length === 0) {
                box.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:14px 0;">Nenhum cartão cadastrado ainda.</p>`;
                return;
            }

            box.innerHTML = cartoesConfig.map(c => `
                <div class="cartao-item">
                    <div class="cartao-item-icon"><i class="ph ph-credit-card"></i></div>
                    <div class="cartao-item-main">
                        <button class="item-link cartao-item-nome" onclick="abrirModalCartao(${c.id})">${c.nome}</button>
                        <div class="cartao-item-tags">
                            <span class="vencimento-tag" style="color:var(--text-highlight-alt); background-color:var(--bg-blue-light);">Fecha dia ${c.diaFechamento}</span>
                            <span class="vencimento-tag" style="color:var(--blue-accent); background-color:var(--bg-blue-light);">Vence dia ${c.diaVencimento}</span>
                        </div>
                    </div>
                    <button class="btn-action cartao-item-menu" onclick="abrirMenuCartao(${c.id}, this)" title="Mais opções"><i class="ph ph-dots-three-vertical" style="font-size:1.2rem;"></i></button>
                </div>
            `).join('');
        }

        // Popup único de criar/editar cartão. id=null cria um novo; um id existente abre pra edição.
        function abrirModalCartao(id) {
            const editando = id != null;
            const cartao = editando ? cartoesConfig.find(c => c.id === id) : null;
            if (editando && !cartao) return;

            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">
                    <i class="ph ph-${editando ? 'pencil-simple' : 'plus-circle'}"></i> ${editando ? 'Editar Cartão' : 'Novo Cartão'}
                </h3>
                <input type="text" id="modalCartaoNomeInput" placeholder="Ex: Nubank" style="width:100%; margin-bottom:12px;" value="${cartao ? cartao.nome : ''}">
                <div class="input-inline" style="margin-bottom: 20px;">
                    <input type="number" id="modalCartaoFechamentoInput" placeholder="Dia do Fechamento" min="1" max="31" style="flex:1;" value="${cartao ? cartao.diaFechamento : ''}">
                    <input type="number" id="modalCartaoVencimentoInput" placeholder="Dia do Vencimento" min="1" max="31" style="flex:1;" value="${cartao ? cartao.diaVencimento : ''}">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">Cancelar</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1;">${editando ? 'Salvar' : 'Adicionar'}</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                const nome = overlay.querySelector('#modalCartaoNomeInput').value.trim();
                const fechamento = parseInt(overlay.querySelector('#modalCartaoFechamentoInput').value);
                const vencimento = parseInt(overlay.querySelector('#modalCartaoVencimentoInput').value);
                if (!nome || isNaN(fechamento) || fechamento < 1 || fechamento > 31 || isNaN(vencimento) || vencimento < 1 || vencimento > 31) {
                    mostrarToast('Preencha o nome e os dois dias (entre 1 e 31).', 'warning');
                    return;
                }
                _fecharModalGenerico();
                if (editando) {
                    cartao.nome = nome;
                    cartao.diaFechamento = fechamento;
                    cartao.diaVencimento = vencimento;
                } else {
                    cartoesConfig.push({ id: Date.now(), nome, diaFechamento: fechamento, diaVencimento: vencimento });
                }
                salvarConfigGlobal();
                renderizarCartoesConfig();
                renderizarCartoesDashboard();
                mostrarToast(editando ? `"${nome}" atualizado.` : `"${nome}" cadastrado.`, 'success');
            };
            overlay.querySelector('#modalBtnCancelar').onclick = _fecharModalGenerico;
        }

        function abrirMenuCartao(id, btnEl) {
            const cartao = cartoesConfig.find(c => c.id === id);
            if (!cartao) return;
            abrirMenuContexto([
                { label: 'Editar', icone: 'pencil-simple', onClick: () => abrirModalCartao(id) },
                { label: 'Excluir', icone: 'trash', perigo: true, onClick: () => deletarCartao(id) }
            ], btnEl);
        }

        function deletarCartao(id) {
            const idx = cartoesConfig.findIndex(c => c.id === id);
            if (idx === -1) return;
            const item = cartoesConfig[idx];

            cartoesConfig.splice(idx, 1);
            renderizarCartoesConfig();
            renderizarCartoesDashboard();

            excluirComUndo({
                mensagem: `Cartão excluído: ${item.nome}`,
                restaurar: () => { cartoesConfig.splice(idx, 0, item); renderizarCartoesConfig(); renderizarCartoesDashboard(); },
                persistir: () => salvarConfigGlobal()
            });
        }
