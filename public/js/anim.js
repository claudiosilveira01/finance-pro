// Animações de entrada: cards (e as linhas do Painel de Controle) sobem suavemente conforme
// aparecem de verdade na área visível da tela — ao logar, ao rolar a página (desktop) e, no
// mobile, também ao trocar de aba e rolar dentro dela. O gatilho é sempre o mesmo em qualquer
// tela: IntersectionObserver, a API do navegador que avisa quando um elemento entra/sai da área
// visível — nunca um "assim que a aba abre, anima tudo de uma vez", que fazia cards fora da tela
// já nascerem prontos, sem nenhuma ligação com o gesto de rolar (a sensação de "soltos" relatada).
(function () {
    let observerCards = null;
    let observerItens = null;

    function iniciarAnimacoesDeEntrada() {
        observerCards = new IntersectionObserver((entradas) => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add('reveal-in');
                    observerCards.unobserve(entrada.target);
                }
            });
        }, { threshold: 0.15 });

        observerItens = new IntersectionObserver((entradas) => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.remove('item-anim-init');
                    entrada.target.classList.add('item-anim');
                    observerItens.unobserve(entrada.target);
                }
            });
        }, { threshold: 0.15 });

        armarCards(document.querySelectorAll('#mainApp .card'));
        armarItens(document.querySelectorAll('#mainApp .stat-row'));

        observarGraficoCategoria();
    }
    window.iniciarAnimacoesDeEntrada = iniciarAnimacoesDeEntrada;

    // "Arma" cada card pra revelar quando entrar de vez na área visível: volta ao estado
    // escondido (reveal-init) e recalcula o atraso escalonado na ordem desses elementos
    // especificamente — nunca um índice fixo da página inteira, que embaralhava a ordem visual
    // toda vez que um subconjunto diferente de cards era revelado (ex.: numa troca de aba).
    function armarCards(cards) {
        if (!observerCards) return;
        [...cards].forEach((card, i) => {
            card.classList.remove('reveal-in');
            card.classList.add('reveal-init');
            card.style.animationDelay = `${Math.min(i * 0.07, 0.35)}s`;
            observerCards.observe(card);
        });
    }
    function armarItens(itens) {
        if (!observerItens) return;
        [...itens].forEach((el, i) => {
            el.classList.remove('item-anim');
            el.classList.add('item-anim-init');
            el.style.animationDelay = `${Math.min(i * 0.07, 0.35)}s`;
            observerItens.observe(el);
        });
    }

    // Chamado pelo ui.js sempre que uma aba vira visível no mobile (switchTab): rearma a
    // revelação por rolagem dos cards (e das 3 linhas do Painel de Controle) dessa aba
    // especificamente. Cards já visíveis na hora da troca revelam na hora (igual ao login);
    // os que estão mais abaixo só revelam quando o usuário rolar até eles de verdade.
    function rearmarRevelacaoDaAba(aba) {
        if (!aba) return;
        const cards = aba.classList.contains('card') ? [aba] : aba.querySelectorAll('.card');
        armarCards(cards);
        armarItens(aba.querySelectorAll('.stat-row'));
    }
    window.rearmarRevelacaoDaAba = rearmarRevelacaoDaAba;

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
    // Mesmo problema do reveal-in dos cards: no mobile, o card do gráfico às vezes está dentro de
    // uma aba ainda display:none quando observarGraficoCategoria() registra o IntersectionObserver
    // — se o Safari/iOS não refizer o cálculo ao trocar de aba, o gráfico nunca ganha os dados
    // (fica em branco pra sempre). Troca de aba chama isto direto, sem depender do observer.
    window.forcarRevelarGraficoCategoria = function () {
        if (chartRevelado) return;
        chartRevelado = true;
        if (chartObserver) chartObserver.disconnect();
        if (window.__ultimoChartDataArray && typeof updateChart === 'function') {
            updateChart(window.__ultimoChartDataArray);
        }
    };

    // Efeito de contagem do Painel de Controle. Só conta "do zero" (efeito de entrada completo)
    // na carga inicial, troca de mês ou troca de aba — via a flag global animarNaCarga, lida no
    // momento da chamada (calcularEAtualizarVisual só zera a flag depois de chamar tudo). Fora
    // disso (ex.: marcar uma conta como paga, somar uma receita ao Caixa Atual), cada número só
    // anima se o SEU valor de fato mudou, e parte do valor anterior — não do zero — pra não fazer
    // todos os outros números "piscarem" de novo por causa de uma ação que não tem nada a ver com eles.
    const contadoresAtivos = {};
    const valoresAnteriores = {};
    const _semMovimento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function animarNumero(elId, valorFinal, duracao = 1800) {
        const el = document.getElementById(elId);
        if (!el) return;
        if (contadoresAtivos[elId]) cancelAnimationFrame(contadoresAtivos[elId]);

        // Acessibilidade: quem pediu menos movimento vê o número final direto, sem contagem.
        if (_semMovimento()) {
            valoresAnteriores[elId] = valorFinal;
            el.innerText = `R$ ${valorFinal.toFixed(2)}`;
            return;
        }

        const valorAnterior = valoresAnteriores[elId];
        const primeiraVez = valorAnterior === undefined;
        const mudou = primeiraVez || Math.abs(valorAnterior - valorFinal) > 0.001;
        valoresAnteriores[elId] = valorFinal;

        if (!mudou) {
            el.innerText = `R$ ${valorFinal.toFixed(2)}`;
            return;
        }

        const doZero = animarNaCarga || primeiraVez;
        const valorInicial = doZero ? 0 : valorAnterior;
        const duracaoReal = doZero ? duracao : Math.min(duracao, 500);

        const inicio = performance.now();
        const passo = (agora) => {
            const progresso = Math.min((agora - inicio) / duracaoReal, 1);
            const facilitado = 1 - Math.pow(1 - progresso, 3); // ease-out cubic
            const valorAtual = valorInicial + (valorFinal - valorInicial) * facilitado;
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
