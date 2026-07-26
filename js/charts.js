// Gráficos de gasto por categoria (Chart.js)
        function initChart() {
            const ctxPizza = document.getElementById('chartCategorias').getContext('2d');
            meuGraficoPizza = new Chart(ctxPizza, {
                type: 'doughnut',
                data: { labels: categoriasAtuais, datasets: [{ data: Array(categoriasAtuais.length).fill(0), backgroundColor: coresCategorias, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, animation: { duration: 900, easing: 'easeOutQuart' } }
            });

            const ctxBar = document.getElementById('barChartCategorias').getContext('2d');
            meuGraficoBarra = new Chart(ctxBar, {
                type: 'bar',
                data: { labels: categoriasAtuais, datasets: [{ label: 'Gasto', data: Array(categoriasAtuais.length).fill(0), backgroundColor: coresCategorias, borderRadius: 6 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    animation: { duration: 900, easing: 'easeOutQuart' },
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
