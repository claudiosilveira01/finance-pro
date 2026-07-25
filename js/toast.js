// Sistema de notificações toast (sucesso/erro/aviso/info), com botão de ação opcional
        function mostrarToast(msg, tipo = 'info', duracao = 4000, opcoes = {}) {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const cores = {
                success: 'var(--green-success)',
                error: 'var(--red-danger)',
                warning: 'var(--warning-orange)',
                info: 'var(--blue-accent)'
            };
            const icones = {
                success: 'check_circle',
                error: 'error',
                warning: 'warning',
                info: 'info'
            };
            const cor = cores[tipo] || cores.info;
            const icone = icones[tipo] || icones.info;

            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.borderLeftColor = cor;

            toast.innerHTML = `
                <span class="material-icons toast-icon" style="color:${cor};">${icone}</span>
                <span class="toast-msg">${msg}</span>
                ${opcoes.acao ? `<button class="toast-acao" style="color:${cor};">${opcoes.acao.texto}</button>` : ''}
                <button class="toast-close"><span class="material-icons">close</span></button>
            `;

            container.appendChild(toast);

            let jaRemovido = false;
            const remover = () => {
                if (jaRemovido) return;
                jaRemovido = true;
                toast.classList.add('toast-saindo');
                setTimeout(() => toast.remove(), 250);
            };

            const timer = setTimeout(remover, duracao);

            if (opcoes.acao) {
                toast.querySelector('.toast-acao').onclick = () => {
                    clearTimeout(timer);
                    remover();
                    opcoes.acao.callback();
                };
            }
            toast.querySelector('.toast-close').onclick = () => {
                clearTimeout(timer);
                remover();
            };
        }
