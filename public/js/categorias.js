// Categorias de contas fixas (ícones e lista)
        function obterIconeCategoria(cat) {
            const iconesBase = {
                "Alimentação": "fork-knife",
                "Transporte": "car",
                "Lazer": "game-controller",
                "Educação": "graduation-cap",
                "Assinaturas": "arrows-clockwise",
                "Saúde": "heartbeat",
                "Comunicação": "wifi-high",
                "Tributos": "bank",
                "PIX Terceiros": "paper-plane-tilt",
                "Cartão de Crédito": "credit-card",
                "Outros": "dots-three"
            };
            return iconesBase[cat] || "tag";
        }

        function addCategoriaGlobal() { const nome = document.getElementById('novaCatNome').value.trim(); if(!nome || categoriasAtuais.includes(nome)) return; categoriasAtuais.push(nome); salvarConfigGlobal(); document.getElementById('novaCatNome').value = ''; renderizarListasDeCategorias(); calcularEAtualizarVisual(); }

        function renderizarListasDeCategorias() {
            const selFixas = document.getElementById('fixaCategoria');
            const boxConfig = document.getElementById('listaCategoriasConfig');

            selFixas.innerHTML = ''; boxConfig.innerHTML = '';
            categoriasAtuais.forEach(cat => {
                selFixas.innerHTML += `<option value="${cat}">${cat}</option>`;
                boxConfig.innerHTML += `
                    <span style="display:flex; align-items:center; gap:2px; background:var(--border-color); color:var(--text-main); padding:4px 4px 4px 12px; border-radius:999px; font-size:0.8rem; font-weight:600;">
                        <i class="ph ph-${obterIconeCategoria(cat)}" style="font-size:14px; margin-right:5px;"></i>${cat}
                        <button class="btn-action" style="padding:3px;" onclick="iniciarEdicaoCategoria('${cat}')" title="Editar"><i class="ph ph-pencil-simple" style="font-size:14px;"></i></button>
                        <button class="btn-action btn-delete" style="padding:3px;" onclick="excluirCategoriaGlobal('${cat}')" title="Excluir"><i class="ph ph-trash" style="font-size:14px;"></i></button>
                    </span>
                `;
            });
            if(meuGraficoPizza) meuGraficoPizza.data.labels = categoriasAtuais;
            if(meuGraficoBarra) meuGraficoBarra.data.labels = categoriasAtuais;
        }

        function iniciarEdicaoCategoria(nome) {
            abrirModalPrompt({
                titulo: 'Editar Categoria',
                mensagem: 'Se o novo nome já existir, as contas serão mescladas nela.',
                placeholder: 'Nome da categoria',
                valorInicial: nome,
                textoConfirmar: 'Salvar',
                onConfirmar: (novoNome) => editarCategoriaGlobal(nome, novoNome)
            });
        }

        // Renomeia a categoria em categoriasAtuais e propaga para as fixas de TODOS os meses
        // (categoria é rótulo canônico global, não por mês). Se "novo" já existir, funciona como merge.
        function editarCategoriaGlobal(antigo, novo) {
            novo = novo.trim();
            if(!novo || novo === antigo) return;

            if(categoriasAtuais.includes(novo)) {
                categoriasAtuais = categoriasAtuais.filter(c => c !== antigo);
            } else {
                const idx = categoriasAtuais.indexOf(antigo);
                if(idx === -1) return;
                categoriasAtuais[idx] = novo;
            }

            if(window.activeFixas) {
                window.activeFixas.forEach(f => { if(f.categoria === antigo) f.categoria = novo; });
            }
            if(window.activeCartoesFaturas) {
                Object.values(window.activeCartoesFaturas).forEach(fatura => {
                    (fatura.transacoes || []).forEach(t => { if(t.categoria === antigo) t.categoria = novo; });
                });
            }

            renderizarListasDeCategorias();
            calcularEAtualizarVisual();
            _persistirRenomeioCategoria(antigo, novo);
        }

        function _persistirRenomeioCategoria(antigo, novo) {
            // Array de categorias (config) + mês atual pelo caminho normal; renomear_categoria
            // propaga o novo nome pras fixas e transações de cartão de TODOS os meses de uma vez.
            salvarConfigGlobal();
            salvarDadosDoMesAtual();

            rpc('renomear_categoria', { p_antigo: antigo, p_novo: novo }).then(() => {
                mostrarToast(`Categoria atualizada para "${novo}" em todos os meses.`, 'success');
            }).catch(err => {
                mostrarToast('Não foi possível atualizar a categoria em todos os meses. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: () => _persistirRenomeioCategoria(antigo, novo) }
                });
            });
        }

        function excluirCategoriaGlobal(nome) {
            const outras = categoriasAtuais.filter(c => c !== nome);
            const emUsoEmFixas = (window.activeFixas || []).some(f => f.categoria === nome);
            const emUsoEmCartoes = Object.values(window.activeCartoesFaturas || {}).some(fatura => (fatura.transacoes || []).some(t => t.categoria === nome));
            const emUsoNoMesAtual = emUsoEmFixas || emUsoEmCartoes;

            if(emUsoNoMesAtual) {
                if(outras.length === 0) {
                    mostrarToast('Crie outra categoria antes de excluir esta — ela está em uso e não pode ficar sem substituta.', 'warning', 6000);
                    return;
                }
                abrirModalSelecao({
                    titulo: 'Categoria em uso',
                    mensagem: `"${nome}" está sendo usada em contas fixas deste mês.\nEscolha para qual categoria migrar essas contas antes de excluir:`,
                    opcoes: outras,
                    textoConfirmar: 'Migrar e Excluir',
                    onConfirmar: (destino) => editarCategoriaGlobal(nome, destino)
                });
                return;
            }

            _removerCategoriaSemUso(nome);
        }

        function _removerCategoriaSemUso(nome) {
            const idx = categoriasAtuais.indexOf(nome);
            if(idx === -1) return;

            categoriasAtuais.splice(idx, 1);
            renderizarListasDeCategorias();
            calcularEAtualizarVisual();

            excluirComUndo({
                mensagem: `Categoria excluída: ${nome}`,
                restaurar: () => {
                    categoriasAtuais.splice(idx, 0, nome);
                    renderizarListasDeCategorias();
                    calcularEAtualizarVisual();
                },
                persistir: () => salvarConfigGlobal()
            });
        }
