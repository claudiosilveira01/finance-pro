// Modal genérico de confirmação/prompt, generalizando o padrão visual já usado em modalFixasCalc
        function _renderModalGenerico(html) {
            const overlay = document.getElementById('modalGenerico');
            overlay.querySelector('.modal-content').innerHTML = html;
            overlay.style.display = 'flex';
            return overlay;
        }

        function _fecharModalGenerico() {
            const overlay = document.getElementById('modalGenerico');
            overlay.style.display = 'none';
            overlay.querySelector('.modal-content').innerHTML = '';
        }

        // Menu de contexto compacto (kebab): abre perto do botão-âncora, sempre dentro da viewport,
        // fecha ao clicar fora ou Esc. itens = [{ label, icone, perigo, onClick }]
        function abrirMenuContexto(itens, ancoraEl) {
            fecharMenuContexto();
            const menu = document.createElement('div');
            menu.className = 'kebab-menu';
            menu.id = 'kebabMenuAtivo';
            menu.innerHTML = itens.map((it, i) =>
                `<div class="kebab-menu-item${it.perigo ? ' danger' : ''}" data-idx="${i}"><i class="ph ph-${it.icone}"></i> ${it.label}</div>`
            ).join('');
            document.body.appendChild(menu);

            const rect = ancoraEl.getBoundingClientRect();
            const menuRect = menu.getBoundingClientRect();
            let top = rect.bottom + 6;
            let left = rect.right - menuRect.width;
            if (left < 8) left = 8;
            if (left + menuRect.width > window.innerWidth - 8) left = window.innerWidth - menuRect.width - 8;
            if (top + menuRect.height > window.innerHeight - 8) top = rect.top - menuRect.height - 6;
            menu.style.top = `${Math.max(8, top)}px`;
            menu.style.left = `${left}px`;

            menu.querySelectorAll('.kebab-menu-item').forEach(el => {
                el.onclick = () => {
                    const item = itens[Number(el.dataset.idx)];
                    fecharMenuContexto();
                    if (item.onClick) item.onClick();
                };
            });

            setTimeout(() => document.addEventListener('click', _fecharMenuContextoAoClicarFora), 0);
        }

        function fecharMenuContexto() {
            const menu = document.getElementById('kebabMenuAtivo');
            if (menu) menu.remove();
            document.removeEventListener('click', _fecharMenuContextoAoClicarFora);
        }

        function _fecharMenuContextoAoClicarFora(e) {
            const menu = document.getElementById('kebabMenuAtivo');
            if (menu && !menu.contains(e.target)) fecharMenuContexto();
        }

        function abrirModalConfirmacao({
            titulo = 'Confirmar ação',
            mensagem = '',
            textoConfirmar = 'Confirmar',
            textoCancelar = 'Cancelar',
            corConfirmar = 'var(--red-danger)',
            onConfirmar,
            onCancelar
        }) {
            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">${titulo}</h3>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px; white-space: pre-line;">${mensagem}</p>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">${textoCancelar}</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1; background: ${corConfirmar};">${textoConfirmar}</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                _fecharModalGenerico();
                if (onConfirmar) onConfirmar();
            };
            overlay.querySelector('#modalBtnCancelar').onclick = () => {
                _fecharModalGenerico();
                if (onCancelar) onCancelar();
            };
        }

        function abrirModalPrompt({
            titulo = 'Informe um valor',
            mensagem = '',
            valorInicial = '',
            placeholder = '',
            textoConfirmar = 'Salvar',
            textoCancelar = 'Cancelar',
            onConfirmar
        }) {
            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">${titulo}</h3>
                ${mensagem ? `<p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 15px;">${mensagem}</p>` : ''}
                <input type="text" id="modalPromptInput" placeholder="${placeholder}" style="width: 100%; margin-bottom: 20px;">
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">${textoCancelar}</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1; background: var(--blue-accent);">${textoConfirmar}</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);
            const input = overlay.querySelector('#modalPromptInput');
            input.value = valorInicial;
            input.focus();

            const confirmar = () => {
                const valor = input.value.trim();
                _fecharModalGenerico();
                if (onConfirmar) onConfirmar(valor);
            };

            overlay.querySelector('#modalBtnConfirmar').onclick = confirmar;
            overlay.querySelector('#modalBtnCancelar').onclick = _fecharModalGenerico;
            input.addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
        }

        function abrirModalSelecao({
            titulo = 'Selecione uma opção',
            mensagem = '',
            opcoes = [],
            valorInicial = '',
            textoConfirmar = 'Confirmar',
            textoCancelar = 'Cancelar',
            onConfirmar
        }) {
            const opcoesHtml = opcoes.map(o => `<option value="${o}" ${o === valorInicial ? 'selected' : ''}>${o}</option>`).join('');
            const html = `
                <h3 style="margin-bottom: 15px; color: var(--text-highlight); font-size: 1.1rem;">${titulo}</h3>
                ${mensagem ? `<p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 15px; white-space: pre-line;">${mensagem}</p>` : ''}
                <select id="modalSelecaoInput" style="width: 100%; margin-bottom: 20px;">${opcoesHtml}</select>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-flat" id="modalBtnCancelar" style="flex: 1; background: var(--text-muted);">${textoCancelar}</button>
                    <button class="btn-flat" id="modalBtnConfirmar" style="flex: 1; background: var(--blue-accent);">${textoConfirmar}</button>
                </div>
            `;
            const overlay = _renderModalGenerico(html);
            const select = overlay.querySelector('#modalSelecaoInput');

            overlay.querySelector('#modalBtnConfirmar').onclick = () => {
                const valor = select.value;
                _fecharModalGenerico();
                if (onConfirmar) onConfirmar(valor);
            };
            overlay.querySelector('#modalBtnCancelar').onclick = _fecharModalGenerico;
        }
