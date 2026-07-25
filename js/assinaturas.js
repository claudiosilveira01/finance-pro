// Assinaturas informativas (fora do orçamento fixo)
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

        function addAssinaturaInformativa() {
            const nome = document.getElementById('subNome').value.trim();
            const valor = parseFloat(document.getElementById('subValor').value);
            const venc = parseInt(document.getElementById('subVenc').value);
            if(!nome || isNaN(venc)) return;
            assinaturasConfig.push({ id: Date.now(), nome, valor: isNaN(valor) ? 0 : valor, vencimento: venc });
            salvarConfigGlobal();
            document.getElementById('subNome').value = '';
            document.getElementById('subValor').value = '';
            document.getElementById('subVenc').value = '';
            calcularEAtualizarVisual();
        }

        // Alimenta os dois lugares onde a lista de assinaturas aparece: o card do Dashboard e Configurações
        function renderizarAssinaturas() {
            let totalAssin = 0;
            const itensHtml = assinaturasConfig.map(s => {
                totalAssin += (s.valor || 0);
                let valorFormatado = s.valor ? ` - R$ ${s.valor.toFixed(2)}` : '';
                let alerta = calcularAlertaVencimento(s.vencimento, false);
                return `<div class="sub-item">
                    <span><i class="ph ph-bell" style="color:var(--sub-color); vertical-align:-2px;"></i> ${s.nome} <strong style="color:var(--text-highlight)">${valorFormatado}</strong></span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="vencimento-tag" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span>
                        <button class="btn-action" onclick="abrirModalAssinaturaParaFixa(${s.id})" title="Adicionar às Contas Fixas"><i class="ph ph-list-plus" style="font-size:1.1rem;"></i></button>
                        <button class="btn-action btn-delete" onclick="deletarAssinatura(${s.id})" title="Excluir"><i class="ph ph-trash" style="font-size:1.1rem;"></i></button>
                    </div>
                </div>`;
            }).join('');

            ['listaAssinaturasCard', 'listaAssinaturasConfig'].forEach(elId => {
                const el = document.getElementById(elId);
                if(el) el.innerHTML = itensHtml;
            });

            const totalEl = document.getElementById('totalAssinaturas');
            if(totalEl) totalEl.innerText = `R$ ${totalAssin.toFixed(2)}`;
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
