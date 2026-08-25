// Gráficos de gasto por categoria (Chart.js)
        function initChart() {
            const ctxPizza = document.getElementById('chartCategorias').getContext('2d');
            meuGraficoPizza = new Chart(ctxPizza, {
                type: 'doughnut',
                data: { labels: categoriasAtuais, datasets: [{ data: Array(categoriasAtuais.length).fill(0), backgroundColor: coresCategorias, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, animation: { duration: 1700, easing: 'easeOutQuart' } }
            });

            const ctxBar = document.getElementById('barChartCategorias').getContext('2d');
            meuGraficoBarra = new Chart(ctxBar, {
                type: 'bar',
                data: { labels: categoriasAtuais, datasets: [{ label: 'Gasto', data: Array(categoriasAtuais.length).fill(0), backgroundColor: coresCategorias, borderRadius: 6 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    animation: { duration: 1700, easing: 'easeOutQuart' },
                    scales: {
                        y: { display: false, beginAtZero: true },
                        x: { ticks: { display: false }, grid: { display: false } }
                    }
                }
            });
        }

        function updateChart(dataArray) {
            if(meuGraficoPizza) {
                meuGraficoPizza.data.datasets[0].data = dataArray;
                meuGraficoPizza.update();
            }
            if(meuGraficoBarra) {
                meuGraficoBarra.data.datasets[0].data = dataArray;
                meuGraficoBarra.update();
            }
        }

        // Gráfico de barras horizontais do card "Sobra/Falta Estimada": compara visualmente o
        // valor disponível (Caixa Atual + Receitas escolhidas) contra o Orçamento escolhido.
        function initChartSobraFalta() {
            const ctx = document.getElementById('chartSobraFalta');
            if (!ctx) return;
            chartSobraFalta = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Disponível', 'Orçamento'],
                    datasets: [{ data: [0, 0], backgroundColor: ['#10B981', '#8B7CF6'], borderRadius: 8, barThickness: 28 }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `R$ ${ctx.raw.toFixed(2)}` } }
                    },
                    animation: { duration: 900, easing: 'easeOutQuart' },
                    scales: {
                        x: { beginAtZero: true, ticks: { callback: (v) => `R$ ${v}` } },
                        y: { ticks: { font: { weight: '700' } } }
                    }
                }
            });
        }

        function atualizarChartSobraFalta(disponivel, orcamento, positivo) {
            if (!chartSobraFalta) return;
            chartSobraFalta.data.datasets[0].data = [disponivel, orcamento];
            chartSobraFalta.data.datasets[0].backgroundColor = [positivo ? '#10B981' : '#EF4444', '#8B7CF6'];
            chartSobraFalta.update();
        }

        // Gráfico "Gastos por Categoria" de dentro do card Cartões de Crédito: só as compras do
        // cartão selecionado no momento, uma rosquinha (doughnut) com as categorias que de fato
        // têm gasto (diferente do gráfico geral do Dashboard, que sempre mostra a lista fixa toda).
        function initChartCartaoCategoria() {
            const ctx = document.getElementById('chartCartaoCategoria');
            if (!ctx) return;
            chartCartaoCategoria = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, animation: { duration: 1100, easing: 'easeOutQuart' } }
            });
        }

        function atualizarChartCartaoCategoria(entradas) {
            if (!chartCartaoCategoria) return;
            chartCartaoCategoria.data.labels = entradas.map(([cat]) => cat);
            chartCartaoCategoria.data.datasets[0].data = entradas.map(([, v]) => v);
            chartCartaoCategoria.data.datasets[0].backgroundColor = entradas.map(([cat]) => {
                const idx = categoriasAtuais.indexOf(cat);
                return coresCategorias[idx >= 0 ? idx % coresCategorias.length : 0];
            });
            chartCartaoCategoria.update();
        }
