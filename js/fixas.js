// CRUD de contas fixas e cálculo de alerta de vencimento
        function calcularAlertaVencimento(diaVenc, pago) {
            if (pago) return { texto: `Dia ${diaVenc}`, cor: 'var(--badge-paid-text)', bg: 'var(--badge-paid-bg)' };

            const [ano, mes] = mesAtualKey.split('-').map(Number);
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            
            const dataVenc = new Date(ano, mes - 1, diaVenc); 
            dataVenc.setHours(0,0,0,0);
            
            const diffTime = dataVenc - hoje;
            const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDias < 0) {
                return { texto: `Vencido (${Math.abs(diffDias)}d)`, cor: 'white', bg: 'var(--red-danger)' };
            }
            if (diffDias === 0) {
                return { texto: `Vence Hoje!`, cor: 'white', bg: 'var(--red-danger)' };
            }
            if (diffDias <= 5) {
                return { texto: `Dia ${diaVenc} (${diffDias}d)`, cor: 'white', bg: 'var(--warning-orange)' };
            }
            return { texto: `Dia ${diaVenc}`, cor: 'white', bg: 'var(--green-success)' };
        }

        function salvarContaFixa() {
            const nome = document.getElementById('fixaNome').value.trim(); 
            const valor = parseFloat(document.getElementById('fixaValor').value); 
            const venc = parseInt(document.getElementById('fixaVenc').value); 
            const cat = document.getElementById('fixaCategoria').value;
            const obs = document.getElementById('fixaObs').value.trim();
            
            if(!nome || isNaN(valor) || isNaN(venc)) return;
            
            if (idEditandoFixa !== null) {
                window.activeFixas = window.activeFixas.map(c =>
                    c.id === idEditandoFixa ? { ...c, nome: nome, valor: valor, vencimento: venc, categoria: cat, obs: obs } : c
                );
                idEditandoFixa = null;
            } else {
                window.activeFixas.push({ id: Date.now(), nome, valor, vencimento: venc, categoria: cat, obs: obs, pago: false });
            }

            _resetarFormFixa();
            fecharModalNovaFixa();

            salvarDadosDoMesAtual();
            calcularEAtualizarVisual();
        }

        function abrirModalNovaFixa() {
            idEditandoFixa = null;
            _resetarFormFixa();
            document.getElementById('modalNovaFixa').style.display = 'flex';
        }

        function fecharModalNovaFixa() {
            document.getElementById('modalNovaFixa').style.display = 'none';
        }

        function _resetarFormFixa() {
            document.getElementById('fixaNome').value = '';
            document.getElementById('fixaValor').value = '';
            document.getElementById('fixaVenc').value = '';
            document.getElementById('fixaObs').value = '';
            document.getElementById('modalNovaFixaTitulo').innerHTML = '<span class="card-title-left"><i class="ph ph-plus"></i> Nova Conta Fixa</span>';
            document.getElementById('btnSalvarFixa').innerHTML = '<i class="ph ph-plus"></i> Salvar';
        }

        function editarContaFixa(id) {
            const conta = window.activeFixas.find(c => c.id === id);
            if (!conta) return;

            abrirModalNovaFixa();

            document.getElementById('fixaNome').value = conta.nome;
            document.getElementById('fixaValor').value = conta.valor;
            document.getElementById('fixaVenc').value = conta.vencimento;
            document.getElementById('fixaCategoria').value = conta.categoria;
            document.getElementById('fixaObs').value = conta.obs || '';

            idEditandoFixa = id;
            document.getElementById('modalNovaFixaTitulo').innerHTML = '<span class="card-title-left"><i class="ph ph-pencil-simple"></i> Editar Conta Fixa</span>';
            document.getElementById('btnSalvarFixa').innerHTML = '<i class="ph ph-check"></i> Salvar Alteração';
        }

        function cancelarEdicaoFixa() {
            idEditandoFixa = null;
            _resetarFormFixa();
            fecharModalNovaFixa();
        }

        function togglePagoFixa(id) { window.activeFixas = window.activeFixas.map(c => c.id === id ? { ...c, pago: !c.pago } : c); salvarDadosDoMesAtual(); calcularEAtualizarVisual(); }

        function deletarItemGeral(id, tipo) {
            const arr = tipo === 'fixa' ? window.activeFixas : window.activeFaturamentos;
            const idx = arr.findIndex(x => x.id === id);
            if(idx === -1) return;
            const item = arr[idx];

            arr.splice(idx, 1);
            calcularEAtualizarVisual();

            excluirComUndo({
                mensagem: `Item excluído: ${item.nome}`,
                restaurar: () => { arr.splice(idx, 0, item); calcularEAtualizarVisual(); },
                persistir: () => salvarDadosDoMesAtual()
            });
        }
