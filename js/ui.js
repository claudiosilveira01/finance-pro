// Navegação entre abas e toggle do painel de configurações no desktop
        function toggleConfigDesktop() {
            const configTab = document.getElementById('tab-config');
            const btn = document.getElementById('btnToggleConfig');
            
            if (configTab.classList.contains('desktop-hidden')) {
                configTab.classList.remove('desktop-hidden');
                btn.innerHTML = '<span style="display:flex; align-items:center; gap:8px;"><span class="material-icons">visibility_off</span> Ocultar Configurações no Painel</span>';
            } else {
                configTab.classList.add('desktop-hidden');
                btn.innerHTML = '<span style="display:flex; align-items:center; gap:8px;"><span class="material-icons">visibility</span> Mostrar Configurações no Painel</span>';
            }
        }

        function switchTab(event, tabId) {
            if(window.innerWidth >= 900 && event) return; 
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if(event) event.currentTarget.classList.add('active');
            if(tabId === 'tab-calendario') renderizarCalendario();
        }
