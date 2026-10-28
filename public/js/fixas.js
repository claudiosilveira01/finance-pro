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
            const valor = _parseDinheiro(elValor.value);
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

            const parcela = _lerParcelasDoForm();
            if (!parcela.valido) {
                mostrarToast('Confira as parcelas: a parcela atual não pode passar do total.', 'warning');
                return;
            }
            const parcelaAtual = parcela.ativo ? parcela.atual : null;
            const parcelaTotal = parcela.ativo ? parcela.total : null;

            let ajusteCaixaPendente = 0;
            let propagarParcelas = null;
            if (idEditandoFixa !== null) {
                const contaAntiga = window.activeFixas.find(c => c.id === idEditandoFixa);
                // Se a conta já estava paga, o valor antigo já tinha saído do Caixa Atual — corrige
                // pela diferença, senão o Caixa Atual fica com o valor de antes da edição.
                if (contaAntiga && contaAntiga.pago && contaAntiga.valor !== valor) {
                    ajusteCaixaPendente = contaAntiga.valor - valor;
                }
                // Conta vinculada: o valor é calculado pelo banco (falta do orçamento), não pelo app.
                const vinculada = !!(contaAntiga && contaAntiga.vinculoTipo);
                window.activeFixas = window.activeFixas.map(c =>
                    c.id === idEditandoFixa ? { ...c, nome: nome, valor: vinculada ? c.valor : valor, vencimento: venc, categoria: cat, obs: obs, parcelaAtual: parcelaAtual, parcelaTotal: parcelaTotal } : c
                );
                // Parcelas: se a conta era parcelada OU passou a ser, os meses seguintes seguem a edição.
                if (contaAntiga && (contaAntiga.parcelaTotal || parcela.ativo) && !vinculada) {
                    propagarParcelas = {
                        nomeAntigo: contaAntiga.nome,
                        totalAntigo: contaAntiga.parcelaTotal ?? null,
                        base: { nome, valor, vencimento: venc, categoria: cat, obs, parcelaAtual, parcelaTotal }
                    };
                }
                idEditandoFixa = null;
            } else {
                const novaConta = { id: Date.now() + Math.floor(Math.random() * 1000), nome, valor, vencimento: venc, categoria: cat, obs: obs, pago: false, parcelaAtual, parcelaTotal };
                window.activeFixas.push(novaConta);

                if (parcela.ativo) {
                    // Conta parcelada repete sozinha até a última parcela (ex.: 3 de 5 → mais 2 meses).
                    const restantes = parcela.total - parcela.atual;
                    if (restantes > 0) _duplicarContaEmMesesFuturos(novaConta, _somarMesKey(mesAtualKey, restantes));
                } else {
                    const recorrente = document.getElementById('fixaRecorrente').checked;
                    const mesFinal = document.getElementById('fixaRecorrenteAte').value;
                    if (recorrente && mesFinal) {
                        _duplicarContaEmMesesFuturos(novaConta, mesFinal);
                    }
                }
            }

            _resetarFormFixa();
            fecharModalNovaFixa();

            if (ajusteCaixaPendente !== 0) {
                ajustarCaixaAtual(ajusteCaixaPendente); // já salva tudo, incluindo o activeFixas atualizado
            } else {
                salvarDadosDoMesAtual();
            }
            if (propagarParcelas) _propagarParcelasFuturas(propagarParcelas);
            calcularEAtualizarVisual();
        }

        // Atualiza, no banco, as parcelas dos meses seguintes de uma conta parcelada editada.
        function _propagarParcelasFuturas(p) {
            rpc('atualizar_parcelas_futuras', {
                p_ano_mes: mesAtualKey,
                p_nome_antigo: p.nomeAntigo,
                p_total_antigo: p.totalAntigo,
                p_base: p.base
            }).then(() => {
                mostrarToast('Parcelas dos próximos meses atualizadas.', 'success');
            }).catch(() => {
                mostrarToast('Erro ao atualizar as parcelas dos próximos meses. Verifique sua conexão.', 'error', 6000);
            });
        }

        // Copia a conta fixa para todos os meses entre o mês atual (exclusive) e mesFinal ("AAAA-MM", inclusive).
        // O servidor cria as linhas de `meses` que faltarem e devolve a lista atualizada de meses.
        function _duplicarContaEmMesesFuturos(contaBase, mesFinal) {
            if (mesFinal <= mesAtualKey) {
                mostrarToast('Escolha um mês futuro para repetir a conta.', 'warning');
                return;
            }

            rpc('repetir_fixa', {
                p_base: {
                    nome: contaBase.nome, valor: contaBase.valor, vencimento: contaBase.vencimento,
                    categoria: contaBase.categoria, obs: contaBase.obs || '',
                    parcelaAtual: contaBase.parcelaAtual ?? null, parcelaTotal: contaBase.parcelaTotal ?? null
                },
                p_de: mesAtualKey,
                p_ate: mesFinal
            }).then(mesesAtualizados => {
                mesesDisponiveis = _montarMesesDisponiveis(mesesAtualizados);
                renderizarMeses();
                _seletoresDeMes().forEach(seletor => { seletor.value = mesAtualKey; });
                mostrarToast(`"${contaBase.nome}" repetida até ${mesFinal}.`, 'success');
            }).catch(() => {
                mostrarToast('Erro ao duplicar a conta para os próximos meses. Verifique sua conexão.', 'error', 6000);
            });
        }

        function abrirModalNovaFixa() {
            idEditandoFixa = null;
            _resetarFormFixa();
            document.getElementById('btnExcluirFixaModal').style.display = 'none';
            document.getElementById('fixaRecorrenteAte').min = mesAtualKey;
            document.getElementById('modalNovaFixa').style.display = 'flex';
            atualizarCamposParcela();
        }

        function fecharModalNovaFixa() {
            document.getElementById('modalNovaFixa').style.display = 'none';
            // Fechar pelo "X" (ou Esc) também descarta a edição em andamento — senão idEditandoFixa
            // ficava setado e a próxima abertura de "Nova Conta" achava que era uma edição.
            idEditandoFixa = null;
            _resetarFormFixa();
        }

        function _resetarFormFixa() {
            document.getElementById('fixaNome').value = '';
            document.getElementById('fixaValor').value = '';
            document.getElementById('fixaVenc').value = '';
            document.getElementById('fixaObs').value = '';
            document.getElementById('fixaValor').disabled = false;
            ['fixaNome', 'fixaValor', 'fixaVenc'].forEach(id => document.getElementById(id).classList.remove('campo-invalido'));
            document.getElementById('fixaRecorrente').checked = false;
            document.getElementById('fixaRecorrenteAte').value = '';
            document.getElementById('fixaRecorrenteAte').disabled = true;
            document.getElementById('fixaParcelado').checked = false;
            document.getElementById('fixaParcelaAtual').value = 1;
            document.getElementById('fixaParcelaTotal').value = 12;
            document.getElementById('modalNovaFixaTitulo').innerHTML = '<span class="card-title-left"><i class="ph ph-plus"></i> Nova Conta Fixa</span>';
            document.getElementById('btnSalvarFixa').innerHTML = '<i class="ph ph-plus"></i> Salvar';
        }

        function editarContaFixa(id) {
            const conta = window.activeFixas.find(c => c.id === id);
            if (!conta) return;

            abrirModalNovaFixa();

            document.getElementById('fixaNome').value = conta.nome;
            document.getElementById('fixaValor').value = _formatarDinheiroInput(conta.valor);
            document.getElementById('fixaVenc').value = conta.vencimento;
            document.getElementById('fixaCategoria').value = conta.categoria;
            document.getElementById('fixaObs').value = conta.obs || '';
            document.getElementById('fixaParcelado').checked = !!conta.parcelaTotal;
            document.getElementById('fixaParcelaAtual').value = conta.parcelaAtual || 1;
            document.getElementById('fixaParcelaTotal').value = conta.parcelaTotal || 12;

            idEditandoFixa = id;
            // Conta vinculada: não pode ser excluída nem ter o valor alterado (o banco calcula).
            const vinculada = !!conta.vinculoTipo;
            document.getElementById('fixaValor').disabled = vinculada;
            document.getElementById('btnExcluirFixaModal').style.display = vinculada ? 'none' : 'flex';
            document.getElementById('modalNovaFixaTitulo').innerHTML = '<span class="card-title-left"><i class="ph ph-pencil-simple"></i> Editar Conta Fixa</span>';
            document.getElementById('btnSalvarFixa').innerHTML = '<i class="ph ph-check"></i> Salvar Alteração';
            atualizarCamposParcela();
        }

        // ---------- Parcelamento ----------
        const _MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

        // "2026-10" + 3 -> "2027-01"
        function _somarMesKey(anoMes, n) {
            const [ano, mes] = anoMes.split('-').map(Number);
            const d = new Date(ano, mes - 1 + n, 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        // "2027-01" -> "jan/2027"
        function _mesCurto(anoMes) {
            const [ano, mes] = anoMes.split('-');
            return `${_MESES_CURTOS[parseInt(mes, 10) - 1]}/${ano}`;
        }

        function _lerParcelasDoForm() {
            const ativo = document.getElementById('fixaParcelado').checked;
            const atual = parseInt(document.getElementById('fixaParcelaAtual').value, 10);
            const total = parseInt(document.getElementById('fixaParcelaTotal').value, 10);
            const valido = !ativo || (atual >= 1 && total >= atual);
            return { ativo, atual, total, valido };
        }

        // Mostra/esconde os campos de parcela, escreve o resumo e decide se a repetição manual aparece.
        function atualizarCamposParcela() {
            const p = _lerParcelasDoForm();
            const emEdicao = idEditandoFixa !== null;
            document.getElementById('fixaParcelaCampos').style.display = p.ativo ? 'block' : 'none';
            // Conta parcelada já se repete até a última parcela; a repetição manual só vale para conta comum.
            document.getElementById('fixaRecorrenteSection').style.display = (p.ativo || emEdicao) ? 'none' : 'block';

            const aviso = document.getElementById('fixaParcelaAviso');
            const resumo = document.getElementById('fixaParcelaResumo');
            aviso.style.display = (p.ativo && !p.valido) ? 'block' : 'none';
            resumo.textContent = '';
            if (!p.ativo || !p.valido) return;

            const faltam = p.total - p.atual;
            resumo.textContent = faltam > 0
                ? `Aparece por mais ${faltam} ${faltam === 1 ? 'mês' : 'meses'}, até ${_mesCurto(_somarMesKey(mesAtualKey, faltam))}.`
                : 'Esta é a última parcela. A conta não se repete.';
            if (emEdicao) resumo.textContent += ' Na edição, a mudança vale só para este mês.';
        }

        function ajustarParcela(campoId, delta) {
            const campo = document.getElementById(campoId);
            const atualValor = parseInt(campo.value, 10) || 1;
            campo.value = Math.max(1, Math.min(120, atualValor + delta));
            atualizarCamposParcela();
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

        // Remove do banco as parcelas dos meses seguintes de uma conta parcelada excluída.
        function apagarParcelasFuturas(conta, mes) {
            rpc('apagar_parcelas_futuras', {
                p_ano_mes: mes,
                p_nome: conta.nome,
                p_total: conta.parcelaTotal
            }).catch(() => {
                mostrarToast('Erro ao apagar as parcelas dos próximos meses. Verifique sua conexão.', 'error', 6000);
            });
        }

        function deletarItemGeral(id, tipo) {
            const arr = tipo === 'fixa' ? window.activeFixas : window.activeFaturamentos;
            const idx = arr.findIndex(x => x.id === id);
            if(idx === -1) return;
            const item = arr[idx];
            if (tipo === 'fixa' && item.vinculoTipo) {
                mostrarToast('Esta conta é automática (vinculada) e não pode ser excluída.', 'warning');
                return;
            }

            arr.splice(idx, 1);
            calcularEAtualizarVisual();
            const mesDaExclusao = mesAtualKey;

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
                    if (tipo === 'fixa' && item.parcelaTotal) apagarParcelasFuturas(item, mesDaExclusao);
                }
            });
        }
