// Faturamentos/receitas do mês
        function addFaturamento() {
            const nome = document.getElementById('fatNome').value.trim();
            const valor = _parseDinheiro(document.getElementById('fatValor').value);
            let data = document.getElementById('fatData').value;
            if(!nome || isNaN(valor)) {
                mostrarToast('Preencha a origem e o valor da receita.', 'warning');
                return;
            }
            if(!data) data = new Date().toISOString().split('T')[0];
            if(!window.activeFaturamentos) window.activeFaturamentos = [];

            window.activeFaturamentos.push({ id: Date.now() + Math.floor(Math.random() * 1000), nome, valor, data: data, noCaixa: false });
            document.getElementById('fatNome').value = ''; document.getElementById('fatValor').value = '';
            salvarDadosDoMesAtual(); calcularEAtualizarVisual();
        }

        // "Puxa" uma receita específica pro Caixa Atual (soma o valor dela) quando o dinheiro cai
        // de verdade na conta — clicar de novo remove (ex.: marcou por engano). Evita contar a
        // mesma receita duas vezes: uma vez marcada, o botão vira um "já no caixa" até desmarcar.
        function toggleReceitaNoCaixa(id) {
            const f = window.activeFaturamentos.find(x => x.id === id);
            if (!f) return;
            const novoStatus = !f.noCaixa;
            window.activeFaturamentos = window.activeFaturamentos.map(x => x.id === id ? { ...x, noCaixa: novoStatus } : x);
            ajustarCaixaAtual(novoStatus ? f.valor : -f.valor);
            calcularEAtualizarVisual();
            mostrarToast(novoStatus ? `"${f.nome}" somada ao Caixa Atual.` : `"${f.nome}" removida do Caixa Atual.`, 'success');
        }

        function editarFaturamento(id) {
            const f = window.activeFaturamentos.find(x => x.id === id);
            if (!f) return;
            idEditandoFaturamento = id;
            document.getElementById('editFatNome').value = f.nome;
            document.getElementById('editFatValor').value = _formatarDinheiroInput(f.valor);
            document.getElementById('editFatData').value = f.data;
            _atualizarBotaoCaixaModalFat(f);
            document.getElementById('modalEditarFaturamento').style.display = 'flex';
        }

        function fecharModalEditarFaturamento() {
            document.getElementById('modalEditarFaturamento').style.display = 'none';
            idEditandoFaturamento = null;
        }

        // Reflete se essa receita já foi somada ao Caixa Atual no botão do popup — mesmo texto/cor
        // que o botão inline de antes tinha.
        function _atualizarBotaoCaixaModalFat(f) {
            const btn = document.getElementById('btnToggleCaixaFatModal');
            if (!btn || !f) return;
            if (f.noCaixa) {
                btn.innerHTML = '<i class="ph ph-check-circle"></i> Já somada ao Caixa — clique pra remover';
                btn.style.background = 'var(--gradient-green)';
            } else {
                btn.innerHTML = '<i class="ph ph-plus-circle"></i> Somar ao Caixa Atual';
                btn.style.background = '';
            }
        }

        // Botão "Somar/Remover do Caixa Atual" dentro do popup de editar Receita — mesma lógica de
        // toggleReceitaNoCaixa, só que sem fechar o popup (o usuário pode seguir editando).
        function toggleReceitaNoCaixaDoModal() {
            if (idEditandoFaturamento === null) return;
            toggleReceitaNoCaixa(idEditandoFaturamento);
            _atualizarBotaoCaixaModalFat(window.activeFaturamentos.find(x => x.id === idEditandoFaturamento));
        }

        function excluirFaturamentoDoModal() {
            if (idEditandoFaturamento === null) return;
            deletarItemGeral(idEditandoFaturamento, 'faturamento');
            idEditandoFaturamento = null;
            fecharModalEditarFaturamento();
        }

        function salvarEdicaoFaturamento() {
            if (idEditandoFaturamento === null) return;
            const nome = document.getElementById('editFatNome').value.trim();
            const valor = _parseDinheiro(document.getElementById('editFatValor').value);
            const data = document.getElementById('editFatData').value;
            if (!nome || isNaN(valor) || !data) {
                mostrarToast('Preencha origem, valor e data da receita.', 'warning');
                return;
            }

            const original = window.activeFaturamentos.find(f => f.id === idEditandoFaturamento);
            window.activeFaturamentos = window.activeFaturamentos.map(f =>
                f.id === idEditandoFaturamento ? { ...f, nome, valor, data } : f
            );
            fecharModalEditarFaturamento();

            // Se essa receita já tinha sido somada ao Caixa Atual, corrige a diferença do valor
            // editado em vez de deixar o Caixa Atual desatualizado.
            if (original && original.noCaixa && valor !== original.valor) {
                ajustarCaixaAtual(valor - original.valor);
            } else {
                salvarDadosDoMesAtual();
            }
            calcularEAtualizarVisual();
        }
