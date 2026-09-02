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

        function abrirModalCalculadora() {
            document.getElementById('modalCalculadora').style.display = 'flex';
        }
        function fecharModalCalculadora() {
            document.getElementById('modalCalculadora').style.display = 'none';
        }

        function abrirModalConfig() {
            document.getElementById('modalConfig').style.display = 'flex';
            if (typeof carregarConfigVerificacaoEmailNoModal === 'function') carregarConfigVerificacaoEmailNoModal();
        }
        function fecharModalConfig() {
            document.getElementById('modalConfig').style.display = 'none';
        }

        // Esc fecha qualquer modal ou menu de contexto aberto no sistema. Em vez de zerar o
        // display na marra (o que pulava a limpeza de estado de cada modal — idEditandoFixa,
        // window._cartaoRevisaoItens, etc.), dispara o botão "Cancelar"/"X" do modal, que roda
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

        // Card/aba "Cartões de Crédito": visibilidade controlada em Configurações, igual o
        // "Acumulado por Categoria" — mas aqui também esconde o botão da barra inferior no mobile.
        function alternarVisibilidadeCartoes(ocultar) {
            ocultarCardCartoes = ocultar;
            aplicarVisibilidadeCartoes();
            salvarConfigGlobal();
        }
        function aplicarVisibilidadeCartoes() {
            const card = document.getElementById('tab-cartoes');
            if (card) card.style.display = ocultarCardCartoes ? 'none' : '';
            const navBtn = document.getElementById('navBtnCartoes');
            if (navBtn) navBtn.style.display = ocultarCardCartoes ? 'none' : '';
            const toggle = document.getElementById('toggleOcultarCartoes');
            if (toggle) toggle.checked = ocultarCardCartoes;
        }
