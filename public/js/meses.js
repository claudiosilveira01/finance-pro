// Carregamento/gravação dos dados do mês ativo e gestão da lista de meses
        function carregarMes(anoMes, callback) {
            if(!currentUser) return;
            document.getElementById('loadingDiv').style.display = 'flex';

            rpc('get_mes', { p_ano_mes: anoMes }).then(data => {
                data = data || {};
                window.activeFixas = data.fixas || [];
                window.activeFaturamentos = data.faturamentos || [];
                window.activeExtrato = data.extrato || [];
                window.activeRegistroPagamentos = data.registroPagamentos || [];
                window.activeCartoesFaturas = data.cartoesFaturas || {};
                const saldoArred = _arred2(data.saldo || 0);
                document.getElementById('saldoInput').value = saldoArred ? _formatarDinheiroInput(saldoArred) : '';

                fixasSelecionadas.clear();
                extratoSelecionados.clear();
                diaCalendarioSelecionado = null;
                animarNaCarga = true;
                calcularEAtualizarVisual();
                document.getElementById('loadingDiv').style.display = 'none';
                if (callback) callback();
            }).catch(err => {
                document.getElementById('loadingDiv').style.display = 'none';
                mostrarToast('Erro ao carregar os dados do mês. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: () => carregarMes(anoMes, callback) }
                });
            });
        }

        function salvarDadosDoMesAtual() {
            if(!currentUser) return Promise.resolve();
            let dados = {
                fixas: window.activeFixas,
                faturamentos: window.activeFaturamentos || [],
                extrato: window.activeExtrato || [],
                registroPagamentos: window.activeRegistroPagamentos || [],
                cartoesFaturas: window.activeCartoesFaturas || {},
                saldo: _arred2(_parseDinheiro(document.getElementById('saldoInput').value) || 0)
            };
            // Mês novo passa a aparecer no seletor assim que tem algo salvo.
            if (!mesesDisponiveis.some(m => m.key === mesAtualKey)) {
                mesesDisponiveis.push({ key: mesAtualKey, label: _labelMes(mesAtualKey) });
                mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key));
                renderizarMeses();
                _seletoresDeMes().forEach(seletor => { seletor.value = mesAtualKey; });
            }
            // _saveEmVoo: se a aba fechar com um save ainda pendente, o pagehide dispara uma
            // gravação keepalive (undo.js) pra não perder a alteração.
            window._saveEmVoo = (window._saveEmVoo || 0) + 1;
            return rpc('salvar_mes', { p_ano_mes: mesAtualKey, p_dados: dados }).catch(err => {
                mostrarToast('Erro ao salvar os dados do mês. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: salvarDadosDoMesAtual }
                });
            }).finally(() => { window._saveEmVoo = Math.max(0, (window._saveEmVoo || 1) - 1); });
        }

        // Seletor de mês duplicado (desktop no card "Planner Financeiro" + mobile em cima de
        // Contas Fixas) — os dois <select> ficam sempre com as mesmas opções e o mesmo valor.
        function _seletoresDeMes() {
            return [document.getElementById('mesSeletor'), document.getElementById('mesSeletorMobile')].filter(Boolean);
        }

        function renderizarMeses() {
            const copiaSeletor = document.getElementById('mesCopiaSeletor');
            if(copiaSeletor) copiaSeletor.innerHTML = '<option value="">Selecione um mês...</option>';

            const opcoesHtml = mesesDisponiveis.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
            _seletoresDeMes().forEach(seletor => { seletor.innerHTML = opcoesHtml; });
            if(copiaSeletor) mesesDisponiveis.forEach(m => { copiaSeletor.innerHTML += `<option value="${m.key}">${m.label}</option>`; });
        }

        function addNovoMes() {
            const inputVal = document.getElementById('novoMesInput').value;
            if(!inputVal || mesesDisponiveis.some(m => m.key === inputVal)) return;

            mesesDisponiveis.push({ key: inputVal, label: _labelMes(inputVal) });
            mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key));

            // Cria a linha vazia do mês no banco pra ele "grudar" mesmo sem nenhum item ainda.
            rpc('salvar_mes', { p_ano_mes: inputVal, p_dados: {
                fixas: [], faturamentos: [], extrato: [], registroPagamentos: [], cartoesFaturas: {}, saldo: 0
            } }).catch(() => {
                mostrarToast('Erro ao criar o mês. Verifique sua conexão.', 'error', 6000);
            });

            renderizarMeses();
            document.getElementById('novoMesInput').value = '';
            _seletoresDeMes().forEach(seletor => { seletor.value = inputVal; });
            mudarMesOuro();
        }

        function mudarMesOuro(origemEl) {
            flushPendingDelete();
            mesAtualKey = (origemEl || document.getElementById('mesSeletor')).value;
            _seletoresDeMes().forEach(seletor => { seletor.value = mesAtualKey; });
            carregarMes(mesAtualKey);
        }

        function navegarMes(direcao) {
            const seletor = document.getElementById('mesSeletor');
            const novoIndice = seletor.selectedIndex + direcao;
            if(novoIndice < 0 || novoIndice >= seletor.options.length) return;
            seletor.selectedIndex = novoIndice;
            mudarMesOuro(seletor);
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

            rpc('get_mes', { p_ano_mes: mesOrigemKey }).then(data => {
                const fixasOrigem = (data && data.fixas) || [];

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
                document.getElementById('loadingDiv').style.display = 'none';
            }).catch(err => {
                mostrarToast('Erro ao copiar as contas fixas. Verifique sua conexão.', 'error', 6000);
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

        function salvarSaldoDoMes(el) {
            // Se o valor não mudou desde que o campo ganhou foco, não regrava — o blur do Caixa
            // Atual disparava um salvar_mes redundante logo depois de ajustarCaixaAtual já ter
            // gravado (marcar conta como paga, somar receita ao caixa, etc.). B8 da auditoria.
            if (el && el.dataset.saldoAoFocar === el.value) {
                calcularEAtualizarVisual();
                return;
            }
            salvarDadosDoMesAtual();
            calcularEAtualizarVisual();
        }

        // Ajusta o Caixa Atual em `delta` (positivo soma, negativo desconta) e salva. Usado quando
        // marca/desmarca uma conta fixa ou assinatura como paga (o dinheiro sai/volta de verdade)
        // e quando o usuário confirma que uma receita específica já caiu na conta.
        function ajustarCaixaAtual(delta) {
            const input = document.getElementById('saldoInput');
            const atual = _parseDinheiro(input.value) || 0;
            input.value = _formatarDinheiroInput(_arred2(atual + delta));
            salvarDadosDoMesAtual();
        }
