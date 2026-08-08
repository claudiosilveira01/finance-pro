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

        // Esc fecha qualquer modal ou menu de contexto aberto no sistema
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            fecharMenuContexto();
            document.querySelectorAll('.modal-overlay').forEach(overlay => {
                if (getComputedStyle(overlay).display !== 'none') overlay.style.display = 'none';
            });
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
