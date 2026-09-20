// Navegação entre abas e modais de Calculadora/Configurações

        // Trava uma troca de aba já em andamento — sem isso, um segundo toque disparado antes do
        // recálculo terminar podia sobrepor duas trocas.
        let _trocandoDeAba = false;

        function switchTab(event, tabId) {
            if(window.innerWidth >= 900 && event) return;
            _irParaAba(tabId);
        }

        function _irParaAba(tabId) {
            if (_trocandoDeAba) return;
            const atual = document.querySelector('.tab-content.active');
            const alvo = document.getElementById(tabId);
            if (!alvo || atual === alvo) return;
            const mobile = window.innerWidth < 900;
            if (mobile) _trocandoDeAba = true;

            if (atual) atual.classList.remove('active');
            alvo.classList.add('active');

            // No mobile, os cards da aba que acabou de aparecer "sobem de baixo pra cima" de novo,
            // igual ao efeito de quando você loga pela primeira vez — ver _tocarEntradaDaAba abaixo.
            if (mobile) _tocarEntradaDaAba(alvo);

            // Mesmo problema do IntersectionObserver dos cards (ver anim.js), só que pro gráfico
            // "Acumulado por Categoria" — sem isso ele podia nunca desenhar no mobile.
            if (tabId === 'tab-dashboard' && typeof forcarRevelarGraficoCategoria === 'function') {
                forcarRevelarGraficoCategoria();
            }

            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            const navBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
            if (navBtn) { navBtn.classList.add('active'); moverIndicadorNav(navBtn); }

            // O recálculo pesado (tabelas, gráficos, calendário) só roda DEPOIS que o navegador já
            // pintou o primeiro frame da animação de entrada — rodando tudo síncrono no meio da
            // troca de classes, o JS travava a pintura da transição inteira até terminar (a
            // "piscada"/atraso relatado: a tela ficava parada e só depois a animação tocava de uma
            // vez, comprimida). No frame seguinte a aba já está com display:block, então os gráficos
            // (Chart.js) já enxergam o canvas com o tamanho certo pra desenhar.
            requestAnimationFrame(() => {
                // try/finally: se calcularEAtualizarVisual() (ou renderizarCalendario()) lançar
                // algum erro no meio do redesenho, a trava _trocandoDeAba precisa soltar do mesmo
                // jeito — sem isso, um erro deixava TODA troca de aba seguinte travada pra sempre.
                try {
                    // No mobile, trocar de aba reanima os detalhes (badges, listas, odômetro) —
                    // deixa o app "vivo". calcularEAtualizarVisual() já redesenha o calendário também.
                    if (tabId === 'tab-calendario' && !mobile) {
                        renderizarCalendario();
                    } else {
                        animarNaCarga = true;
                        calcularEAtualizarVisual();
                    }
                } finally {
                    _trocandoDeAba = false;
                }
            });
        }

        // Faz os cards (e as 3 linhas do Painel de Controle) da aba que acabou de aparecer
        // "surgirem de baixo pra cima" de novo — mesmo efeito do login, só que a cada troca de aba.
        //
        // O truque do "reflow forçado" (void el.offsetWidth) é necessário porque simplesmente tirar
        // e recolocar a mesma classe no mesmo instante não reinicia uma animação CSS — o navegador
        // "junta" as duas mudanças num só recálculo e trata como se nada tivesse mudado (a raiz da
        // "piscada"/animação que não reiniciava relatada pelo usuário, especialmente na aba
        // Calendário). Ler offsetWidth no meio força o navegador a aplicar a remoção da classe
        // antes de continuar — só então a re-adição conta como um começo novo de verdade.
        //
        // O atraso escalonado (animation-delay) é recalculado aqui, na ordem dos elementos DENTRO
        // desta aba — não mais um índice fixo da página inteira (calculado uma vez no login), que
        // embaralhava a ordem visual a cada troca.
        function _tocarEntradaDaAba(aba) {
            if (!aba) return;
            const cards = aba.classList.contains('card') ? [aba] : [...aba.querySelectorAll('.card')];
            cards.forEach((card, i) => {
                card.classList.remove('reveal-in');
                card.style.animationDelay = `${Math.min(i * 0.06, 0.3)}s`;
                void card.offsetWidth;
                card.classList.add('reveal-in');
            });
            const itens = [...aba.querySelectorAll('.stat-row')];
            itens.forEach((el, i) => {
                el.classList.remove('item-anim');
                el.style.animationDelay = `${Math.min(i * 0.06, 0.3)}s`;
                void el.offsetWidth;
                el.classList.add('item-anim');
            });
        }

        // Move a "pílula" do bottom-nav até ficar atrás do botão indicado, com transição suave (CSS).
        function moverIndicadorNav(btn) {
            const indicador = document.getElementById('navIndicator');
            const nav = document.querySelector('.bottom-nav');
            if (!indicador || !nav || !btn) return;
            const rectNav = nav.getBoundingClientRect();
            const rectBtn = btn.getBoundingClientRect();
            indicador.style.width = rectBtn.width + 'px';
            indicador.style.transform = `translateX(${rectBtn.left - rectNav.left}px)`;
        }

        window.addEventListener('DOMContentLoaded', () => {
            const ativo = document.querySelector('.nav-item.active');
            if (ativo) moverIndicadorNav(ativo);
        });
        // Reposiciona a pílula ao girar a tela ou redimensionar — sem isso ela ficaria "presa" nas
        // coordenadas antigas até a próxima troca de aba.
        window.addEventListener('resize', () => {
            const ativo = document.querySelector('.nav-item.active');
            if (ativo) moverIndicadorNav(ativo);
        });

        // Botão "Selecionar Contas" (Contas Fixas): liga/desliga as bolinhas de seleção da tabela
        // e a linha "SOMA SELECIONADA" logo abaixo — por padrão ficam ocultas.
        function toggleMostrarSelecaoFixas() {
            mostrarSelecaoFixas = !mostrarSelecaoFixas;
            _salvarEstadoUI('mostrarSelecaoFixas', mostrarSelecaoFixas);
            aplicarVisibilidadeSelecaoFixas();
        }
        function aplicarVisibilidadeSelecaoFixas() {
            const tab = document.getElementById('tab-fixas');
            const btn = document.getElementById('btnToggleSelecaoFixas');
            const boxSoma = document.getElementById('somaSelecionadaFixasBox');
            if (tab) tab.dataset.selecaoFixas = mostrarSelecaoFixas ? 'visivel' : 'oculta';
            if (btn) btn.classList.toggle('ativo', mostrarSelecaoFixas);
            if (boxSoma) boxSoma.style.display = mostrarSelecaoFixas ? 'flex' : 'none';
        }

        // Atalho do manifest (long-press no ícone do PWA → "Calendário de vencimentos"): abre o
        // app já na aba pedida, assim que o mainApp fica visível depois do login.
        (function _aplicarAtalhoDoManifest() {
            const alvo = new URLSearchParams(location.search).get('atalho');
            if (!alvo || !document.getElementById('tab-' + alvo)) return;
            let tentativas = 0;
            const tentar = () => {
                const app = document.getElementById('mainApp');
                if (app && app.style.display === 'block') {
                    switchTab(null, 'tab-' + alvo);
                } else if (tentativas++ < 40) {
                    setTimeout(tentar, 300);
                }
            };
            window.addEventListener('DOMContentLoaded', tentar);
        })();

        // Ao abrir, o visor já fica pronto pra receber dígito — sem precisar clicar nele antes
        // (como uma calculadora física/app "de verdade": abriu, já dá pra digitar). O foco só
        // funciona depois que o modal está de fato visível (display:flex aplicado), por isso o
        // requestAnimationFrame — focar um elemento ainda com display:none é ignorado pelo navegador.
        function abrirModalCalculadora() {
            document.getElementById('modalCalculadora').style.display = 'flex';
            const visor = document.getElementById('calcVisor');
            requestAnimationFrame(() => {
                visor.focus();
                visor.select();
            });
        }
        function fecharModalCalculadora() {
            document.getElementById('modalCalculadora').style.display = 'none';
        }
        // Enter no visor equivale a apertar "=" — comportamento esperado de qualquer calculadora
        // "de verdade", sem precisar tirar a mão do teclado pra clicar no botão.
        document.getElementById('calcVisor') && document.getElementById('calcVisor').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); calcInput('='); }
        });

        function abrirModalConfig() {
            document.getElementById('modalConfig').style.display = 'flex';
            if (typeof carregarConfigVerificacaoEmailNoModal === 'function') carregarConfigVerificacaoEmailNoModal();
        }
        function fecharModalConfig() {
            document.getElementById('modalConfig').style.display = 'none';
        }

        // Esc fecha qualquer modal ou menu de contexto aberto no sistema. Em vez de zerar o
        // display na marra (o que pulava a limpeza de estado de cada modal — idEditandoFixa,
        // idEditandoFaturamento, etc.), dispara o botão "Cancelar"/"X" do modal, que roda
        // o handler de fechamento certo. e.repeat evita disparo repetido ao segurar a tecla.
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || e.repeat) return;

            if (document.getElementById('kebabMenuAtivo')) { fecharMenuContexto(); return; }

            const abertos = [...document.querySelectorAll('.modal-overlay')]
                .filter(o => getComputedStyle(o).display !== 'none');
            if (!abertos.length) return;

            e.preventDefault();
            abertos.forEach(overlay => {
                const btn = overlay.querySelector('#modalBtnCancelar, .modal-close-x');
                if (btn) btn.click();
                else overlay.style.display = 'none';
            });
        });

        // Focus-trap: com um modal aberto, Tab/Shift+Tab circula só dentro dele — antes o Tab
        // escapava pros controles atrás do modal (U6 da auditoria).
        document.addEventListener('keydown', e => {
            if (e.key !== 'Tab') return;
            const abertos = [...document.querySelectorAll('.modal-overlay')]
                .filter(o => getComputedStyle(o).display !== 'none');
            const modal = abertos[abertos.length - 1];
            if (!modal) return;
            const foco = [...modal.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )].filter(el => el.offsetParent !== null);
            if (!foco.length) return;
            const primeiro = foco[0], ultimo = foco[foco.length - 1], ativo = document.activeElement;
            if (e.shiftKey && (ativo === primeiro || !modal.contains(ativo))) {
                e.preventDefault(); ultimo.focus();
            } else if (!e.shiftKey && (ativo === ultimo || !modal.contains(ativo))) {
                e.preventDefault(); primeiro.focus();
            }
        });

        // Card "Acumulado por Categoria": visibilidade controlada em Configurações (pouco usado por alguns usuários)
        function alternarVisibilidadeAcumulado(ocultar) {
            ocultarCardAcumulado = ocultar;
            aplicarVisibilidadeAcumulado();
            salvarConfigGlobal();
        }
        function aplicarVisibilidadeAcumulado() {
            const card = document.getElementById('cardAcumulado');
            if (card) card.style.display = ocultarCardAcumulado ? 'none' : '';
            const toggle = document.getElementById('toggleOcultarAcumulado');
            if (toggle) toggle.checked = ocultarCardAcumulado;
        }

        // Card "Extrato Bancário": visibilidade controlada em Configurações, igual o
        // "Acumulado por Categoria".
        function alternarVisibilidadeExtrato(ocultar) {
            ocultarCardExtrato = ocultar;
            aplicarVisibilidadeExtrato();
            salvarConfigGlobal();
        }
        function aplicarVisibilidadeExtrato() {
            const card = document.getElementById('cardExtrato');
            if (card) card.style.display = ocultarCardExtrato ? 'none' : '';
            const toggle = document.getElementById('toggleOcultarExtrato');
            if (toggle) toggle.checked = ocultarCardExtrato;
        }
