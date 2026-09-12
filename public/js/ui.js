// Navegação entre abas e modais de Calculadora/Configurações
        function switchTab(event, tabId) {
            if(window.innerWidth >= 900 && event) return;
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if(event) event.currentTarget.classList.add('active');

            // No mobile, trocar de aba reanima os detalhes (badges, listas, odômetro) — deixa o app "vivo".
            // calcularEAtualizarVisual() já cuida de redesenhar o calendário também.
            if (event) {
                animarNaCarga = true;
                calcularEAtualizarVisual();
            } else if (tabId === 'tab-calendario') {
                renderizarCalendario();
            }
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
