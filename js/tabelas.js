// Ordenação das tabelas de fixas e faturamentos
        function ordenarTabela(tabela, coluna) {
            if(tabela === 'fixas') { ordFixas.asc = (ordFixas.col === coluna) ? !ordFixas.asc : true; ordFixas.col = coluna; calcularEAtualizarVisual(); }
            else if(tabela === 'faturamentos') { ordFaturamentos.asc = (ordFaturamentos.col === coluna) ? !ordFaturamentos.asc : true; ordFaturamentos.col = coluna; calcularEAtualizarVisual(); }
            else if(tabela === 'extrato') { ordExtrato.asc = (ordExtrato.col === coluna) ? !ordExtrato.asc : true; ordExtrato.col = coluna; renderizarExtrato(); }
        }

        function aplicarOrdenacao(array, config) {
            if(!config.col) return array;
            let arr = [...array];
            return arr.sort((a, b) => {
                let valA = a[config.col]; let valB = b[config.col];
                if(config.col === 'pago') { valA = a.pago ? 1 : 0; valB = b.pago ? 1 : 0; }
                if(config.col === 'data') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
                if(typeof valA === 'string') valA = valA.toLowerCase();
                if(typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return config.asc ? -1 : 1;
                if (valA > valB) return config.asc ? 1 : -1;
                return 0;
            });
        }
