// Carregamento/gravação dos dados do mês ativo e gestão da lista de meses
        function carregarMes(anoMes) {
            if(!currentUser) return;
            document.getElementById('loadingDiv').style.display = 'flex';
            
            getMesesCollectionRef().doc(anoMes).get().then(doc => {
                if(doc.exists) {
                    let data = doc.data();
                    window.activeFixas = data.fixas || [];
                    window.activeFaturamentos = data.faturamentos || [];
                    window.activeExtrato = data.extrato || [];
                    window.activeRegistroPagamentos = data.registroPagamentos || [];
                    window.activeCartoesFaturas = data.cartoesFaturas || {};
                    document.getElementById('saldoInput').value = data.saldo || 0;
                } else {
                    window.activeFixas = [];
                    window.activeFaturamentos = [];
                    window.activeExtrato = [];
                    window.activeRegistroPagamentos = [];
                    window.activeCartoesFaturas = {};
                    document.getElementById('saldoInput').value = 0;
                }
                fixasSelecionadas.clear();
                extratoSelecionados.clear();
                diaCalendarioSelecionado = null;
                animarNaCarga = true;
                calcularEAtualizarVisual();
                document.getElementById('loadingDiv').style.display = 'none';
            }).catch(err => {
                document.getElementById('loadingDiv').style.display = 'none';
                mostrarToast('Erro ao carregar os dados do mês. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: () => carregarMes(anoMes) }
                });
            });
        }

        function salvarDadosDoMesAtual() {
            if(!currentUser) return;
            let dados = {
                fixas: window.activeFixas,
                faturamentos: window.activeFaturamentos || [],
                extrato: window.activeExtrato || [],
                registroPagamentos: window.activeRegistroPagamentos || [],
                cartoesFaturas: window.activeCartoesFaturas || {},
                saldo: parseFloat(document.getElementById('saldoInput').value) || 0
            };
            getMesesCollectionRef().doc(mesAtualKey).set(dados).catch(err => {
                mostrarToast('Erro ao salvar os dados do mês. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: salvarDadosDoMesAtual }
                });
            });
        }

        function renderizarMeses() {
            const seletor = document.getElementById('mesSeletor');
            const copiaSeletor = document.getElementById('mesCopiaSeletor');
            seletor.innerHTML = '';
            if(copiaSeletor) copiaSeletor.innerHTML = '<option value="">Selecione um mês...</option>';
            
            mesesDisponiveis.forEach(m => {
                seletor.innerHTML += `<option value="${m.key}">${m.label}</option>`;
                if(copiaSeletor) copiaSeletor.innerHTML += `<option value="${m.key}">${m.label}</option>`;
            });
        }

        function addNovoMes() {
            const inputVal = document.getElementById('novoMesInput').value; 
            if(!inputVal || mesesDisponiveis.some(m => m.key === inputVal)) return;

            const [ano, mes] = inputVal.split('-');
            const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const label = `${mesesNomes[parseInt(mes)-1]} / ${ano}`;

            mesesDisponiveis.push({ key: inputVal, label: label });
            mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key)); 
            
            salvarConfigGlobal();
            renderizarMeses();
            document.getElementById('novoMesInput').value = '';
            document.getElementById('mesSeletor').value = inputVal;
            mudarMesOuro();
        }

        function mudarMesOuro() {
            flushPendingDelete();
            mesAtualKey = document.getElementById('mesSeletor').value;
            carregarMes(mesAtualKey);
        }

        function navegarMes(direcao) {
            const seletor = document.getElementById('mesSeletor');
            const novoIndice = seletor.selectedIndex + direcao;
            if(novoIndice < 0 || novoIndice >= seletor.options.length) return;
            seletor.selectedIndex = novoIndice;
            mudarMesOuro();
        }

        function copiarContasFixas() {
            const mesOrigemKey = document.getElementById('mesCopiaSeletor').value;
            if(!mesOrigemKey) return mostrarToast('Selecione um mês de origem primeiro.', 'warning');
            if(mesOrigemKey === mesAtualKey) return mostrarToast('Você já está na aba do mesmo mês.', 'warning');

            abrirModalConfirmacao({
                titulo: 'Copiar Contas Fixas',
                mensagem: `Deseja copiar as contas fixas de ${mesOrigemKey} para o mês atual (${mesAtualKey})?\nO status de pagamento será redefinido para "Não".`,
                textoConfirmar: 'Copiar',
                corConfirmar: 'var(--warning-orange)',
                onConfirmar: () => _executarCopiaContasFixas(mesOrigemKey)
            });
        }

        function _executarCopiaContasFixas(mesOrigemKey) {
            document.getElementById('loadingDiv').style.display = 'flex';

            getMesesCollectionRef().doc(mesOrigemKey).get().then(doc => {
                if(doc.exists) {
                    let data = doc.data();
                    let fixasOrigem = data.fixas || [];
                    
                    if(fixasOrigem.length === 0) {
                        mostrarToast('Nenhuma conta fixa localizada no mês de origem.', 'warning');
                    } else {
                        fixasOrigem.forEach(f => {
                            window.activeFixas.push({
                                id: Date.now() + Math.floor(Math.random() * 1000),
                                nome: f.nome,
                                valor: f.valor,
                                vencimento: f.vencimento,
                                categoria: f.categoria,
                                obs: f.obs || '',
                                pago: false
                            });
                        });
                        salvarDadosDoMesAtual();
                        calcularEAtualizarVisual();
                        mostrarToast('Contas fixas copiadas com sucesso!', 'success');
                    }
                } else {
                    mostrarToast('Dados indisponíveis para o mês de origem.', 'error');
                }
                document.getElementById('loadingDiv').style.display = 'none';
            }).catch(err => {
                mostrarToast('Erro ao copiar as contas fixas: ' + err.message, 'error', 6000);
                document.getElementById('loadingDiv').style.display = 'none';
            });
        }

        function limparFixasDoMesAtual() {
            abrirModalConfirmacao({
                titulo: 'Apagar Contas Fixas',
                mensagem: `Tem certeza que deseja apagar TODAS as contas fixas de ${mesAtualKey}?\nEsta ação não pode ser desfeita.`,
                textoConfirmar: 'Apagar',
                onConfirmar: () => {
                    window.activeFixas = [];
                    salvarDadosDoMesAtual();
                    calcularEAtualizarVisual();
                }
            });
        }

        function salvarSaldoDoMes() {
            salvarDadosDoMesAtual();
            calcularEAtualizarVisual();
        }

        // Ajusta o Caixa Atual em `delta` (positivo soma, negativo desconta) e salva. Usado quando
        // marca/desmarca uma conta fixa ou assinatura como paga (o dinheiro sai/volta de verdade)
        // e quando o usuário confirma que uma receita específica já caiu na conta.
        function ajustarCaixaAtual(delta) {
            const input = document.getElementById('saldoInput');
            const atual = parseFloat(input.value) || 0;
            input.value = (atual + delta).toFixed(2);
            salvarDadosDoMesAtual();
        }
