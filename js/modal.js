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
