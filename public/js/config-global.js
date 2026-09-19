// Configuração global do usuário no Supabase (categorias, assinaturas, visibilidade de cards)
        async function carregarConfigGlobal(callback) {
            try {
                const [c, meses] = await Promise.all([
                    rpc('get_config'),
                    rpc('get_meses_disponiveis')
                ]);

                if (c) {
                    if (Array.isArray(c.categorias) && c.categorias.length) categoriasAtuais = c.categorias;
                    assinaturasConfig = c.assinaturas || [];
                    ocultarCardAcumulado = c.ocultarCardAcumulado || false;
                    ocultarCardExtrato = c.ocultarCardExtrato || false;
                }

                mesesDisponiveis = _montarMesesDisponiveis(meses);

                aplicarVisibilidadeAcumulado();
                aplicarVisibilidadeExtrato();
                aplicarVisibilidadeSelecaoFixas();

                const dataHoje = new Date();
                const mesString = String(dataHoje.getMonth() + 1).padStart(2, '0');
                const anoMesAtualReal = `${dataHoje.getFullYear()}-${mesString}`;

                // O mês corrente sempre aparece no seletor mesmo sem nada salvo ainda. A linha em
                // `meses` só é criada de fato quando o primeiro item do mês for gravado (salvar_mes).
                if (!mesesDisponiveis.some(m => m.key === anoMesAtualReal)) {
                    mesesDisponiveis.push({ key: anoMesAtualReal, label: _labelMes(anoMesAtualReal) });
                    mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key));
                }

                // Retoma o último mês visto neste aparelho (localStorage, não sincronizado entre
                // dispositivos) em vez de sempre abrir no mês corrente do calendário — só se esse
                // mês ainda existir na lista (não foi um mês vazio que nunca chegou a ser salvo).
                const ultimoMesVisto = _lerEstadoUI('ultimoMes', null);
                mesAtualKey = (ultimoMesVisto && mesesDisponiveis.some(m => m.key === ultimoMesVisto))
                    ? ultimoMesVisto : anoMesAtualReal;

                renderizarMeses();
                renderizarListasDeCategorias();

                _seletoresDeMes().forEach(seletor => { seletor.value = mesAtualKey; });

                carregarMes(mesAtualKey, callback);
            } catch (err) {
                document.getElementById('loadingDiv').style.display = 'none';
                mostrarToast('Erro ao carregar seus dados. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: () => carregarConfigGlobal(callback) }
                });
            }
        }

        function salvarConfigGlobal() {
            if(!currentUser) return;
            window._saveEmVoo = (window._saveEmVoo || 0) + 1;
            rpc('salvar_config', { p: {
                categorias: categoriasAtuais,
                assinaturas: assinaturasConfig,
                ocultarCardAcumulado: ocultarCardAcumulado,
                ocultarCardExtrato: ocultarCardExtrato
            } }).catch(() => {
                mostrarToast('Erro ao salvar as configurações. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: salvarConfigGlobal }
                });
            }).finally(() => { window._saveEmVoo = Math.max(0, (window._saveEmVoo || 1) - 1); });
        }
