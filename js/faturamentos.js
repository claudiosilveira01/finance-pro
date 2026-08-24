// Faturamentos/receitas do mês
        // Mantém o texto do botão de data (ícone + "Hoje"/"dd/mm") em sincronia com o <input
        // type="date"> real, que fica invisível por cima do botão e recebe o toque diretamente.
        function atualizarLabelDataFat() {
            const el = document.getElementById('fatData');
            const label = document.getElementById('fatDataLabel');
            if (!el || !label) return;
            if (!el.value) { label.textContent = 'Hoje'; return; }
            const [ano, mes, dia] = el.value.split('-');
            const hojeStr = new Date().toISOString().split('T')[0];
            label.textContent = el.value === hojeStr ? 'Hoje' : `${dia}/${mes}`;
        }

        function addFaturamento() {
            const nome = document.getElementById('fatNome').value.trim(); 
            const valor = parseFloat(document.getElementById('fatValor').value); 
            let data = document.getElementById('fatData').value;
            if(!nome || isNaN(valor)) return;
            if(!data) data = new Date().toISOString().split('T')[0];
            if(!window.activeFaturamentos) window.activeFaturamentos = [];
            
            window.activeFaturamentos.push({ id: Date.now(), nome, valor, data: data, noCaixa: false });
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
            document.getElementById('editFatValor').value = f.valor;
            document.getElementById('editFatData').value = f.data;
            document.getElementById('modalEditarFaturamento').style.display = 'flex';
        }

        function fecharModalEditarFaturamento() {
            document.getElementById('modalEditarFaturamento').style.display = 'none';
            idEditandoFaturamento = null;
        }

        function salvarEdicaoFaturamento() {
            if (idEditandoFaturamento === null) return;
            const nome = document.getElementById('editFatNome').value.trim();
            const valor = parseFloat(document.getElementById('editFatValor').value);
            const data = document.getElementById('editFatData').value;
            if (!nome || isNaN(valor) || !data) return;

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
