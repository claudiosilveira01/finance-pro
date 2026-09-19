// Navegação entre abas e modais de Calculadora/Configurações

        // Ordem visual das abas no bottom-nav — usada tanto pra saber se um swipe deve ir "pra
        // frente" ou "pra trás" quanto pra animar a pílula do indicador na direção certa.
        const ORDEM_ABAS_MOBILE = ['tab-fixas', 'tab-calendario', 'tab-dashboard'];

        function switchTab(event, tabId) {
            if(window.innerWidth >= 900 && event) return;
            const abaAtual = document.querySelector('.tab-content.active');
            const indiceAtual = abaAtual ? ORDEM_ABAS_MOBILE.indexOf(abaAtual.id) : -1;
            const indiceAlvo = ORDEM_ABAS_MOBILE.indexOf(tabId);
            const direcao = (event && indiceAtual !== -1 && indiceAlvo !== -1) ? Math.sign(indiceAlvo - indiceAtual) : 0;
            _irParaAba(tabId, direcao);
        }

        // direcao: -1 (veio da esquerda / aba anterior), 0 (sem animação — atalho do manifest,
        // clique não vindo do bottom-nav), 1 (veio da direita / próxima aba).
        // Trava uma troca de aba já em andamento — sem isso, um segundo swipe/toque disparado
        // antes da animação anterior terminar (100-240ms) sobrepunha as duas transições e piscava.
        let _trocandoDeAba = false;

        function _irParaAba(tabId, direcao) {
            if (_trocandoDeAba) return;
            const atual = document.querySelector('.tab-content.active');
            const alvo = document.getElementById(tabId);
            if (!alvo || atual === alvo) return;
            const mobile = window.innerWidth < 900;
            if (mobile && direcao !== 0) _trocandoDeAba = true;

            const concluirTroca = () => {
                if (atual) atual.classList.remove('active');
                alvo.classList.add('active');
                // Cards da aba que nunca tinha sido aberta (ex.: "Mês" logo após o login) dependiam
                // só do IntersectionObserver de anim.js pra sair do reveal-init (opacity:0) — no
                // Safari/iOS esse observer às vezes não refaz o cálculo quando o elemento sai de
                // display:none, e o card ficava invisível pra sempre ("nem aparecem"). Trocar de
                // aba agora revela na marra, sem depender do observer.
                _revelarCardsDaAba(alvo);
                // Mesmo problema do IntersectionObserver dos cards, só que pro gráfico "Acumulado
                // por Categoria" — sem isso ele podia nunca desenhar no mobile (ver anim.js).
                if (tabId === 'tab-dashboard' && typeof forcarRevelarGraficoCategoria === 'function') {
                    forcarRevelarGraficoCategoria();
                }
                if (mobile && direcao !== 0) {
                    const classeEntrada = direcao > 0 ? 'slide-in-right' : 'slide-in-left';
                    alvo.classList.add(classeEntrada);
                    setTimeout(() => alvo.classList.remove(classeEntrada), 240);
                }

                document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
                const navBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
                if (navBtn) { navBtn.classList.add('active'); moverIndicadorNav(navBtn); }

                // O recálculo pesado (tabelas, gráficos, calendário) só roda DEPOIS que o navegador
                // já pintou o primeiro frame da animação de entrada — rodando tudo síncrono no meio
                // da troca de classes, o JS travava a pintura da transição inteira até terminar (a
                // "piscada"/atraso relatado: a tela ficava parada e só then a animação tocava de
                // uma vez, comprimida). No frame seguinte a aba já está com display:block, então os
                // gráficos (Chart.js) já enxergam o canvas com o tamanho certo pra desenhar.
                requestAnimationFrame(() => {
                    // No mobile, trocar de aba reanima os detalhes (badges, listas, odômetro) —
                    // deixa o app "vivo". calcularEAtualizarVisual() já redesenha o calendário também.
                    if (tabId === 'tab-calendario' && !mobile) {
                        renderizarCalendario();
                    } else {
                        animarNaCarga = true;
                        calcularEAtualizarVisual();
                    }
                    _trocandoDeAba = false;
                });
            };

            // A aba que sai desliza+esmaece primeiro (rápido), só depois a próxima entra — evitar
            // sobrepor as duas ao mesmo tempo, já que tab-fixas/tab-calendario e tab-dashboard
            // vivem em colunas HTML diferentes (não dá pra fazer as duas deslizarem juntas sem
            // reestruturar o layout inteiro em colunas físicas). Duração curta de propósito — rápida
            // o bastante pra não parecer um "buraco" entre uma aba e outra.
            if (mobile && direcao !== 0 && atual) {
                const classeSaida = direcao > 0 ? 'slide-out-left' : 'slide-out-right';
                atual.classList.add(classeSaida);
                setTimeout(() => { atual.classList.remove(classeSaida); concluirTroca(); }, 100);
            } else {
                concluirTroca();
            }
        }

        // Força a revelação (classe reveal-in) de qualquer card ainda com reveal-init dentro da
        // aba que acabou de virar visível — não espera o IntersectionObserver de anim.js, que só
        // roda de verdade pro scroll normal do desktop.
        function _revelarCardsDaAba(aba) {
            if (!aba) return;
            const cards = aba.classList.contains('card') ? [aba] : [...aba.querySelectorAll('.card')];
            cards.forEach(c => c.classList.add('reveal-in'));
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

        // Deslizar (swipe) pra trocar de aba no mobile — mesma navegação do bottom-nav, só que
        // arrastando o dedo pra esquerda/direita em qualquer lugar da tela. Ignorado com um modal
        // aberto (senão atrapalharia gestos dentro dele) e com pouco deslocamento vertical (senão
        // um scroll normal da página seria confundido com swipe de aba).
        (function _configurarSwipeDeAbas() {
            let inicioX = 0, inicioY = 0, tocando = false;
            const LIMIAR_PX = 55;

            document.addEventListener('touchstart', e => {
                if (window.innerWidth >= 900 || e.touches.length !== 1) { tocando = false; return; }
                const modalAberto = [...document.querySelectorAll('.modal-overlay')].some(o => getComputedStyle(o).display !== 'none');
                if (modalAberto) { tocando = false; return; }
                inicioX = e.touches[0].clientX;
                inicioY = e.touches[0].clientY;
                tocando = true;
            }, { passive: true });

            document.addEventListener('touchend', e => {
                if (!tocando) return;
                tocando = false;
                const fimX = e.changedTouches[0].clientX;
                const fimY = e.changedTouches[0].clientY;
                const deltaX = fimX - inicioX;
                const deltaY = fimY - inicioY;
                if (Math.abs(deltaX) < LIMIAR_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

                const abaAtual = document.querySelector('.tab-content.active');
                const indiceAtual = abaAtual ? ORDEM_ABAS_MOBILE.indexOf(abaAtual.id) : -1;
                if (indiceAtual === -1) return;

                // Arrastar pra esquerda avança pra próxima aba (deltaX negativo), pra direita volta.
                const novoIndice = indiceAtual + (deltaX < 0 ? 1 : -1);
                if (novoIndice < 0 || novoIndice >= ORDEM_ABAS_MOBILE.length) return;
                _irParaAba(ORDEM_ABAS_MOBILE[novoIndice], deltaX < 0 ? 1 : -1);
            }, { passive: true });
        })();

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
