// Ordenação das tabelas de fixas e faturamentos
        function ordenarTabela(tabela, coluna) {
            if(tabela === 'fixas') {
                atualizarOrdenacaoCascata(ordFixas, coluna);
                calcularEAtualizarVisual();
            } else if(tabela === 'faturamentos') {
                atualizarOrdenacaoCascata(ordFaturamentos, coluna);
                calcularEAtualizarVisual();
            } else if(tabela === 'extrato') {
                ordExtrato.asc = (ordExtrato.col === coluna) ? !ordExtrato.asc : true;
                ordExtrato.col = coluna;
                renderizarExtrato();
            }
        }

        function atualizarOrdenacaoCascata(config, coluna) {
            let existingIndex = config.levels.findIndex(l => l.col === coluna);
            if(existingIndex === 0) {
                // já é o critério principal — só inverte a direção
                config.levels[0].asc = !config.levels[0].asc;
            } else if(existingIndex > 0) {
                // já existia como desempate — promove a principal, mantendo a direção
                const [level] = config.levels.splice(existingIndex, 1);
                config.levels.unshift(level);
            } else {
                // coluna nova vira o critério principal; a anterior (se houver) vira desempate
                const anterior = config.levels[0];
                config.levels = anterior ? [{ col: coluna, asc: true }, anterior] : [{ col: coluna, asc: true }];
            }
        }

        function aplicarOrdenacao(array, config) {
            let arr = [...array];

            if(config.levels) {
                if(config.levels.length === 0) return arr;
                return arr.sort((a, b) => {
                    for(let level of config.levels) {
                        let valA = a[level.col];
                        let valB = b[level.col];
                        if(level.col === 'pago') { valA = a.pago ? 1 : 0; valB = b.pago ? 1 : 0; }
                        if(level.col === 'data') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
                        if(typeof valA === 'string') valA = valA.toLowerCase();
                        if(typeof valB === 'string') valB = valB.toLowerCase();
                        if(valA !== valB) {
                            if (valA < valB) return level.asc ? -1 : 1;
                            if (valA > valB) return level.asc ? 1 : -1;
                        }
                    }
                    return 0;
                });
            } else if(config.col) {
                return arr.sort((a, b) => {
                    let valA = a[config.col];
                    let valB = b[config.col];
                    if(config.col === 'pago') { valA = a.pago ? 1 : 0; valB = b.pago ? 1 : 0; }
                    if(config.col === 'data') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
                    if(typeof valA === 'string') valA = valA.toLowerCase();
                    if(typeof valB === 'string') valB = valB.toLowerCase();
                    if (valA < valB) return config.asc ? -1 : 1;
                    if (valA > valB) return config.asc ? 1 : -1;
                    return 0;
                });
            }

            return arr;
        }
