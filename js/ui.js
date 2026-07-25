// Navegação entre abas e modais de Calculadora/Configurações
        function switchTab(event, tabId) {
            if(window.innerWidth >= 900 && event) return;
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if(event) event.currentTarget.classList.add('active');
            if(tabId === 'tab-calendario') renderizarCalendario();
        }

        function abrirModalCalculadora() {
            document.getElementById('modalCalculadora').style.display = 'flex';
        }
        function fecharModalCalculadora() {
            document.getElementById('modalCalculadora').style.display = 'none';
        }

        function abrirModalConfig() {
            document.getElementById('modalConfig').style.display = 'flex';
        }
        function fecharModalConfig() {
            document.getElementById('modalConfig').style.display = 'none';
        }
