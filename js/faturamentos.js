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
            
            window.activeFaturamentos.push({ id: Date.now(), nome, valor, data: data });
            document.getElementById('fatNome').value = ''; document.getElementById('fatValor').value = '';
            salvarDadosDoMesAtual(); calcularEAtualizarVisual();
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

            window.activeFaturamentos = window.activeFaturamentos.map(f =>
                f.id === idEditandoFaturamento ? { ...f, nome, valor, data } : f
            );
            fecharModalEditarFaturamento();
            salvarDadosDoMesAtual();
            calcularEAtualizarVisual();
        }
