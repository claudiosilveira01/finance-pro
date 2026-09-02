// Calculadora inteligente (com soma de contas fixas)
        // === CALCULADORA INTELIGENTE ===
        function calcInput(val) {
            const visor = document.getElementById('calcVisor');
            let atual = visor.value;
            
            if(val === 'C') {
                visor.value = '';
            } else if(val === '⌫') {
                visor.value = atual.slice(0, -1);
            } else if(val === '=') {
                try {
                    if(/^[0-9+\-*/.% ]+$/.test(atual)) {
                        let resultado = Function('"use strict"; return (' + atual.replace(/%/g, '/100') + ')')();
                        visor.value = Number.isFinite(resultado) ? String(Math.round(resultado * 100000000) / 100000000) : 'Erro';
                    }
                } catch(e) {
                    visor.value = 'Erro';
                }
            } else {
                if(atual === 'Erro' || atual === '0') visor.value = '';
                visor.value += val;
            }
        }

        function inserirRestanteContas() {
            if(!window.activeFixas) return;
            const restante = window.activeFixas.reduce((acc, c) => acc + (c.pago ? 0 : c.valor), 0);

            const visor = document.getElementById('calcVisor');
            let atual = visor.value;
            if(atual === 'Erro' || atual === '0') visor.value = '';
            visor.value += restante.toFixed(2);
        }

        function validarInputCalculadora(input) {
            input.value = input.value.replace(/[^0-9+\-*/.%]/g, '');
        }

        function abrirModalFixas() {
            const modal = document.getElementById('modalFixasCalc');
            const lista = document.getElementById('listaFixasCalcModal');
            lista.innerHTML = '';

            if(!window.activeFixas || window.activeFixas.length === 0) {
                lista.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:24px 0;">Nenhuma conta fixa cadastrada neste mês.</p>';
            } else {
                window.activeFixas.forEach(f => {
                    lista.innerHTML += `
                        <div class="modal-item" data-valor="${f.valor}" onclick="this.classList.toggle('checked')">
                            <div>
                                <div style="font-weight:700;">${f.nome}</div>
                                <span class="modal-item-badge"><i class="ph ph-${obterIconeCategoria(f.categoria)}" style="font-size:11px;"></i>${f.categoria}</span>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px; font-weight:600;">R$ ${f.valor.toFixed(2)}</div>
                            </div>
                            <div class="modal-item-check"><i class="ph ph-check"></i></div>
                        </div>
                    `;
                });
            }
            modal.style.display = 'flex';
        }

        function fecharModalFixas() {
            document.getElementById('modalFixasCalc').style.display = 'none';
        }

        function aplicarSomaFixasModal() {
            const selecionados = document.querySelectorAll('#listaFixasCalcModal .modal-item.checked');
            let soma = 0;
            selecionados.forEach(el => soma += parseFloat(el.dataset.valor));

            const visor = document.getElementById('calcVisor');
            if(visor.value === '0' || visor.value === 'Erro' || visor.value === '') {
                visor.value = soma.toFixed(2);
            } else {
                visor.value += '+' + soma.toFixed(2);
            }

            fecharModalFixas();
        }
