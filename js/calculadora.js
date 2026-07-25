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

        function validarInputCalculadora(input) {
            input.value = input.value.replace(/[^0-9+\-*/.%]/g, '');
        }

        function abrirModalFixas() {
            const modal = document.getElementById('modalFixasCalc');
            const lista = document.getElementById('listaFixasCalcModal');
            lista.innerHTML = '';
            
            if(!window.activeFixas || window.activeFixas.length === 0) {
                lista.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Nenhuma conta fixa cadastrada neste mês.</p>';
            } else {
                window.activeFixas.forEach(f => {
                    lista.innerHTML += `
                        <div class="modal-item">
                            <div>
                                <div style="font-weight:600;">${f.nome}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">R$ ${f.valor.toFixed(2)}</div>
                            </div>
                            <input type="checkbox" class="fixa-calc-check" value="${f.valor}" style="width: 20px; height: 20px; cursor: pointer;">
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
            const checks = document.querySelectorAll('.fixa-calc-check:checked');
            let soma = 0;
            checks.forEach(chk => soma += parseFloat(chk.value));
            
            const visor = document.getElementById('calcVisor');
            if(visor.value === '0' || visor.value === 'Erro' || visor.value === '') {
                visor.value = soma.toFixed(2);
            } else {
                visor.value += '+' + soma.toFixed(2);
            }
            
            fecharModalFixas();
        }
