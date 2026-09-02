// Configuração global do usuário no Supabase (categorias, assinaturas, cartões, visibilidade de cards)
        async function carregarConfigGlobal(callback) {
            try {
                const [c, meses] = await Promise.all([
                    rpc('get_config'),
                    rpc('get_meses_disponiveis')
                ]);

                if (c) {
                    if (Array.isArray(c.categorias) && c.categorias.length) categoriasAtuais = c.categorias;
                    assinaturasConfig = c.assinaturas || [];
                    cartoesConfig = c.cartoesConfig || [];
                    ocultarCardAcumulado = c.ocultarCardAcumulado || false;
                    ocultarCardCartoes = c.ocultarCardCartoes || false;
                }

                mesesDisponiveis = _montarMesesDisponiveis(meses);

                aplicarVisibilidadeAcumulado();
                aplicarVisibilidadeCartoes();

                const dataHoje = new Date();
                const mesString = String(dataHoje.getMonth() + 1).padStart(2, '0');
                const anoMesAtualReal = `${dataHoje.getFullYear()}-${mesString}`;

                // O mês corrente sempre aparece no seletor mesmo sem nada salvo ainda. A linha em
                // `meses` só é criada de fato quando o primeiro item do mês for gravado (salvar_mes).
                if (!mesesDisponiveis.some(m => m.key === anoMesAtualReal)) {
                    mesesDisponiveis.push({ key: anoMesAtualReal, label: _labelMes(anoMesAtualReal) });
                    mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key));
                }

                mesAtualKey = anoMesAtualReal;

                renderizarMeses();
                renderizarListasDeCategorias();
                renderizarCartoesConfig();

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
            rpc('salvar_config', { p: {
                categorias: categoriasAtuais,
                assinaturas: assinaturasConfig,
                cartoesConfig: cartoesConfig,
                ocultarCardAcumulado: ocultarCardAcumulado,
                ocultarCardCartoes: ocultarCardCartoes
            } }).catch(() => {
                mostrarToast('Erro ao salvar as configurações. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: salvarConfigGlobal }
                });
            });
        }
