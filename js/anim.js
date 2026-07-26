// Animações de entrada: cards sobem suavemente ao logar e conforme aparecem na tela
(function () {
    let observer = null;

    function iniciarAnimacoesDeEntrada() {
        const cards = document.querySelectorAll('#mainApp .card');
        if (!cards.length) return;

        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entradas) => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add('reveal-in');
                    observer.unobserve(entrada.target);
                }
            });
        }, { threshold: 0.15 });

        cards.forEach((card, i) => {
            card.classList.add('reveal-init');
            card.style.animationDelay = `${Math.min(i * 0.06, 0.4)}s`;
            observer.observe(card);
        });

        observarGraficoCategoria();
    }

    window.iniciarAnimacoesDeEntrada = iniciarAnimacoesDeEntrada;

    // O gráfico só recebe os dados reais (e portanto só "cresce") quando o card
    // dele realmente aparece na tela — senão a animação acontecia durante o
    // carregamento, antes do usuário rolar até lá, e parecia que nada tinha animado.
    let chartRevelado = false;
    let chartObserver = null;
    function observarGraficoCategoria() {
        if (chartRevelado) return;
        const cardGrafico = document.getElementById('chartCategorias')?.closest('.card');
        if (!cardGrafico) return;

        if (chartObserver) chartObserver.disconnect();
        chartObserver = new IntersectionObserver((entradas) => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting && !chartRevelado) {
                    chartRevelado = true;
                    if (window.__ultimoChartDataArray && typeof updateChart === 'function') {
                        updateChart(window.__ultimoChartDataArray);
                    }
                    chartObserver.disconnect();
                }
            });
        }, { threshold: 0.2 });
        chartObserver.observe(cardGrafico);
    }
    window.chartFoiRevelado = () => chartRevelado;

    // Efeito de contagem: anima o número de 0 até o valor final (usado no Painel de Controle)
    const contadoresAtivos = {};
    function animarNumero(elId, valorFinal, duracao = 1800) {
        const el = document.getElementById(elId);
        if (!el) return;
        if (contadoresAtivos[elId]) cancelAnimationFrame(contadoresAtivos[elId]);

        const inicio = performance.now();
        const passo = (agora) => {
            const progresso = Math.min((agora - inicio) / duracao, 1);
            const facilitado = 1 - Math.pow(1 - progresso, 3); // ease-out cubic
            const valorAtual = valorFinal * facilitado;
            el.innerText = `R$ ${valorAtual.toFixed(2)}`;
            if (progresso < 1) {
                contadoresAtivos[elId] = requestAnimationFrame(passo);
            } else {
                el.innerText = `R$ ${valorFinal.toFixed(2)}`;
                delete contadoresAtivos[elId];
            }
        };
        contadoresAtivos[elId] = requestAnimationFrame(passo);
    }

    window.animarNumero = animarNumero;
})();
