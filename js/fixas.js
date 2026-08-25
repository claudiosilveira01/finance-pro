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
            const elNome = document.getElementById('fixaNome');
            const elValor = document.getElementById('fixaValor');
            const elVenc = document.getElementById('fixaVenc');
            const cat = document.getElementById('fixaCategoria').value;
            const obs = document.getElementById('fixaObs').value.trim();

            const nome = elNome.value.trim();
            const valor = parseFloat(elValor.value);
            const venc = parseInt(elVenc.value);

            [elNome, elValor, elVenc].forEach(el => el.classList.remove('campo-invalido'));

            const camposInvalidos = [];
            if(!nome) camposInvalidos.push(elNome);
            if(isNaN(valor)) camposInvalidos.push(elValor);
            if(isNaN(venc) || venc < 1 || venc > 31) camposInvalidos.push(elVenc);

            if(camposInvalidos.length > 0) {
                camposInvalidos.forEach(el => el.classList.add('campo-invalido'));
                camposInvalidos[0].focus();
                mostrarToast('Preencha nome, valor e dia de vencimento para salvar.', 'warning');
                return;
            }

            let ajusteCaixaPendente = 0;
            if (idEditandoFixa !== null) {
                const contaAntiga = window.activeFixas.find(c => c.id === idEditandoFixa);
                // Se a conta já estava paga, o valor antigo já tinha saído do Caixa Atual — corrige
                // pela diferença, senão o Caixa Atual fica com o valor de antes da edição.
                if (contaAntiga && contaAntiga.pago && contaAntiga.valor !== valor) {
                    ajusteCaixaPendente = contaAntiga.valor - valor;
                }
                window.activeFixas = window.activeFixas.map(c =>
                    c.id === idEditandoFixa ? { ...c, nome: nome, valor: valor, vencimento: venc, categoria: cat, obs: obs } : c
                );
                idEditandoFixa = null;
            } else {
                const novaConta = { id: Date.now(), nome, valor, vencimento: venc, categoria: cat, obs: obs, pago: false };
                window.activeFixas.push(novaConta);

                const recorrente = document.getElementById('fixaRecorrente').checked;
                const mesFinal = document.getElementById('fixaRecorrenteAte').value;
                if (recorrente && mesFinal) {
                    _duplicarContaEmMesesFuturos(novaConta, mesFinal);
                }
            }

            _resetarFormFixa();
            fecharModalNovaFixa();

            if (ajusteCaixaPendente !== 0) {
                ajustarCaixaAtual(ajusteCaixaPendente); // já salva tudo, incluindo o activeFixas atualizado
            } else {
                salvarDadosDoMesAtual();
            }
            calcularEAtualizarVisual();
        }

        // Copia a conta fixa para todos os meses entre o mês atual (exclusive) e mesFinal ("AAAA-MM", inclusive)
        function _duplicarContaEmMesesFuturos(contaBase, mesFinal) {
            if (mesFinal <= mesAtualKey) {
                mostrarToast('Escolha um mês futuro para repetir a conta.', 'warning');
                return;
            }

            const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            let [ano, mes] = mesAtualKey.split('-').map(Number);
            const chaves = [];

            while (chaves.length < 60) {
                mes++;
                if (mes > 12) { mes = 1; ano++; }
                const chave = `${ano}-${String(mes).padStart(2, '0')}`;
                chaves.push(chave);
                if (chave >= mesFinal) break;
            }

            let promessa = Promise.resolve();
            chaves.forEach(chave => {
                promessa = promessa.then(() => {
                    if (!mesesDisponiveis.some(m => m.key === chave)) {
                        const [a, m] = chave.split('-');
                        mesesDisponiveis.push({ key: chave, label: `${mesesNomes[parseInt(m) - 1]} / ${a}` });
                    }
                    return getMesesCollectionRef().doc(chave).get().then(doc => {
                        const dados = doc.exists ? doc.data() : { fixas: [], faturamentos: [], saldo: 0 };
                        dados.fixas = dados.fixas || [];
                        dados.fixas.push({
                            id: Date.now() + Math.floor(Math.random() * 100000),
                            nome: contaBase.nome, valor: contaBase.valor, vencimento: contaBase.vencimento,
                            categoria: contaBase.categoria, obs: contaBase.obs, pago: false
                        });
                        return getMesesCollectionRef().doc(chave).set(dados);
                    });
                });
            });

            promessa.then(() => {
                mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key));
                renderizarMeses();
                document.getElementById('mesSeletor').value = mesAtualKey;
                salvarConfigGlobal();
                mostrarToast(`"${contaBase.nome}" repetida até ${mesFinal}.`, 'success');
            }).catch(() => {
                mostrarToast('Erro ao duplicar a conta para os próximos meses. Verifique sua conexão.', 'error', 6000);
            });
        }

        function abrirModalNovaFixa() {
            idEditandoFixa = null;
            _resetarFormFixa();
            document.getElementById('fixaRecorrenteSection').style.display = 'block';
            document.getElementById('btnExcluirFixaModal').style.display = 'none';
            document.getElementById('fixaRecorrenteAte').min = mesAtualKey;
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
            ['fixaNome', 'fixaValor', 'fixaVenc'].forEach(id => document.getElementById(id).classList.remove('campo-invalido'));
            document.getElementById('fixaRecorrente').checked = false;
            document.getElementById('fixaRecorrenteAte').value = '';
            document.getElementById('fixaRecorrenteAte').disabled = true;
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
            document.getElementById('fixaRecorrenteSection').style.display = 'none';
            document.getElementById('btnExcluirFixaModal').style.display = 'flex';
            document.getElementById('modalNovaFixaTitulo').innerHTML = '<span class="card-title-left"><i class="ph ph-pencil-simple"></i> Editar Conta Fixa</span>';
            document.getElementById('btnSalvarFixa').innerHTML = '<i class="ph ph-check"></i> Salvar Alteração';
        }

        function excluirFixaDoModal() {
            if (idEditandoFixa === null) return;
            deletarItemGeral(idEditandoFixa, 'fixa');
            idEditandoFixa = null;
            fecharModalNovaFixa();
        }

        function cancelarEdicaoFixa() {
            idEditandoFixa = null;
            _resetarFormFixa();
            fecharModalNovaFixa();
        }

        // Alterna Pago/Não Pago. Ao MARCAR como pago, pergunta em que data o pagamento foi feito
        // de verdade (o clique nem sempre acontece no mesmo dia) — botão "Foi hoje" ou uma data
        // escolhida. Ao desmarcar, aplica na hora, sem perguntar nada. O registro do evento
        // (usado só no Relatório Mensal em PDF, não aparece em nenhuma tela do app) guarda essa
        // data escolhida separada da data/hora reais do clique.
        function togglePagoFixa(id) {
            const conta = window.activeFixas.find(c => c.id === id);
            if (!conta) return;

            if (conta.pago) {
                _aplicarTogglePagoFixa(id, false, null);
                return;
            }

            abrirModalData({
                titulo: `Quando você pagou "${conta.nome}"?`,
                onConfirmar: (dataPagamento) => _aplicarTogglePagoFixa(id, true, dataPagamento)
            });
        }

        function _aplicarTogglePagoFixa(id, novoStatus, dataPagamento) {
            const conta = window.activeFixas.find(c => c.id === id);
            if (!conta) return;
            window.activeFixas = window.activeFixas.map(c => c.id === id ? { ...c, pago: novoStatus } : c);

            if (!window.activeRegistroPagamentos) window.activeRegistroPagamentos = [];
            window.activeRegistroPagamentos.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                contaId: id,
                nome: conta.nome,
                valor: conta.valor,
                marcadoComoPago: novoStatus,
                tipo: 'fixa',
                dataPagamento: dataPagamento,
                registradoEm: new Date().toISOString()
            });

            // O dinheiro sai de verdade do Caixa Atual ao marcar como pago, e volta se desmarcar
            // (ex.: clicou por engano). ajustarCaixaAtual() já salva tudo de uma vez.
            ajustarCaixaAtual(novoStatus ? -conta.valor : conta.valor);
            calcularEAtualizarVisual();
        }

        function toggleSelecaoFixa(id) {
            if (fixasSelecionadas.has(id)) fixasSelecionadas.delete(id); else fixasSelecionadas.add(id);
            calcularEAtualizarVisual();
        }

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
                persistir: () => {
                    // Se a receita excluída já tinha sido somada ao Caixa Atual, desconta de volta
                    // — senão o Caixa Atual ficaria contando um dinheiro que não existe mais no app.
                    // Se a conta fixa excluída já estava paga, o valor tinha sido descontado do Caixa
                    // Atual ao marcar como paga — devolve, senão o Caixa Atual fica manco pra sempre.
                    if (tipo === 'faturamento' && item.noCaixa) {
                        ajustarCaixaAtual(-item.valor);
                    } else if (tipo === 'fixa' && item.pago) {
                        ajustarCaixaAtual(item.valor);
                    } else {
                        salvarDadosDoMesAtual();
                    }
                }
            });
        }
