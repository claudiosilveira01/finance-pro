// Configuração global do usuário no Firestore (categorias, assinaturas, meses)
        function carregarConfigGlobal(callback) {
            getConfigDocRef().get().then(doc => {
                if(doc.exists) {
                    let data = doc.data();
                    categoriasAtuais = data.categorias || categoriasAtuais;
                    assinaturasConfig = data.assinaturas || assinaturasConfig;
                    cartoesConfig = data.cartoesConfig || cartoesConfig;
                    mesesDisponiveis = data.meses || [];
                    ocultarCardAcumulado = data.ocultarCardAcumulado || false;
                    ocultarCardCartoes = data.ocultarCardCartoes || false;
                }
                aplicarVisibilidadeAcumulado();
                aplicarVisibilidadeCartoes();
                verificarNotificacoesAtivas();
                
                const dataHoje = new Date();
                const mesString = String(dataHoje.getMonth() + 1).padStart(2, '0');
                const anoMesAtualReal = `${dataHoje.getFullYear()}-${mesString}`;
                
                if(!mesesDisponiveis.some(m => m.key === anoMesAtualReal)) {
                    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                    const label = `${mesesNomes[dataHoje.getMonth()]} / ${dataHoje.getFullYear()}`;
                    mesesDisponiveis.push({ key: anoMesAtualReal, label: label });
                    mesesDisponiveis.sort((a, b) => a.key.localeCompare(b.key));
                    salvarConfigGlobal();
                }

                mesAtualKey = anoMesAtualReal;

                renderizarMeses();
                renderizarListasDeCategorias();
                renderizarCartoesConfig();

                _seletoresDeMes().forEach(seletor => { seletor.value = mesAtualKey; });
                carregarMes(mesAtualKey, callback);
            }).catch(err => {
                document.getElementById('loadingDiv').style.display = 'none';
                mostrarToast('Erro ao carregar seus dados. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: () => carregarConfigGlobal(callback) }
                });
            });
        }

        function salvarConfigGlobal() {
            if(!currentUser) return;
            getConfigDocRef().set({
                categorias: categoriasAtuais,
                assinaturas: assinaturasConfig,
                cartoesConfig: cartoesConfig,
                meses: mesesDisponiveis,
                ocultarCardAcumulado: ocultarCardAcumulado,
                ocultarCardCartoes: ocultarCardCartoes
            }, {merge: true}).catch(err => {
                mostrarToast('Erro ao salvar as configurações. Verifique sua conexão.', 'error', 6000, {
                    acao: { texto: 'Tentar de novo', callback: salvarConfigGlobal }
                });
            });
        }
