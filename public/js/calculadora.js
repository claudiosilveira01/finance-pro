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
                const resultado = _calcAvaliar(atual);
                if (resultado !== null) {
                    visor.value = Number.isFinite(resultado) ? String(Math.round(resultado * 100000000) / 100000000) : 'Erro';
                } else if (atual.trim()) {
                    visor.value = 'Erro';
                }
            } else {
                if(atual === 'Erro' || atual === '0') visor.value = '';
                visor.value += val;
            }
        }

        // Avaliador próprio (sem Function()/eval) pra calculadora: só + - * / e % (=/100), sem
        // parênteses (o teclado da calculadora não os oferece). Tokeniza, resolve * / % primeiro,
        // depois + -. Devolve null se a expressão não for válida.
        function _calcAvaliar(expr) {
            const limpa = String(expr).replace(/\s+/g, '').replace(/%/g, '/100');
            if (!limpa || !/^[0-9+\-*/.]+$/.test(limpa)) return null;

            const tokens = limpa.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
            if (!tokens || tokens.join('') !== limpa) return null;

            // Junta sinais unários (ex.: "5*-3" -> número -3; "-5+2" -> começa com -5).
            const nums = [], ops = [];
            let esperaNumero = true;
            for (let i = 0; i < tokens.length; i++) {
                const tk = tokens[i];
                if (esperaNumero) {
                    let sinal = 1;
                    while (tokens[i] === '+' || tokens[i] === '-') {
                        if (tokens[i] === '-') sinal = -sinal;
                        i++;
                    }
                    const n = parseFloat(tokens[i]);
                    if (isNaN(n)) return null;
                    nums.push(sinal * n);
                    esperaNumero = false;
                } else {
                    if (!'+-*/'.includes(tk)) return null;
                    ops.push(tk);
                    esperaNumero = true;
                }
            }
            if (esperaNumero || nums.length !== ops.length + 1) return null;

            // Passo 1: * e /
            for (let i = 0; i < ops.length; ) {
                if (ops[i] === '*' || ops[i] === '/') {
                    const r = ops[i] === '*' ? nums[i] * nums[i + 1] : nums[i] / nums[i + 1];
                    nums.splice(i, 2, r);
                    ops.splice(i, 1);
                } else i++;
            }
            // Passo 2: + e -
            let acc = nums[0];
            for (let i = 0; i < ops.length; i++) {
                acc = ops[i] === '+' ? acc + nums[i + 1] : acc - nums[i + 1];
            }
            return acc;
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
                                <div style="font-weight:700;">${_esc(f.nome)}</div>
                                <span class="modal-item-badge"><i class="ph ph-${obterIconeCategoria(f.categoria)}" style="font-size:11px;"></i>${_esc(f.categoria)}</span>
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
