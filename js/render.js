// Função central: recalcula e redesenha todo o painel a partir do estado atual
        function calcularEAtualizarVisual() {
            let orcamento = 0, pago = 0, restante = 0, totalFaturamentos = 0;
            let totalPorCategoria = {};
            categoriasAtuais.forEach(c => totalPorCategoria[c] = 0);

            // Tabela Fixas
            const tbodyFixas = document.getElementById('listaFixas');
            tbodyFixas.innerHTML = '';
            let fixasOrdenadas = aplicarOrdenacao(window.activeFixas, ordFixas);
            
            fixasOrdenadas.forEach(c => {
                orcamento += c.valor;
                if(c.pago) pago += c.valor; else restante += c.valor;
                if(totalPorCategoria[c.categoria] !== undefined) totalPorCategoria[c.categoria] += c.valor;
                
                let alerta = calcularAlertaVencimento(c.vencimento, c.pago);

                tbodyFixas.innerHTML += `
                    <tr>
                        <td>
                            <strong style="font-size: 0.95rem;">${c.nome}</strong>
                            ${c.obs ? `<div style="color:var(--text-muted); font-size:0.8rem; margin-top:3px;">${c.obs}</div>` : ''}
                        </td>
                        <td>
                            <span style="background:var(--border-color); color:var(--text-main); padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:600; white-space:nowrap;">${c.categoria}</span>
                        </td>
                        <td><span class="vencimento-tag" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span></td>
                        <td><strong style="white-space:nowrap;">R$ ${c.valor.toFixed(2)}</strong></td>
                        <td><button class="status-badge ${c.pago?'sim':'nao'}" onclick="togglePagoFixa(${c.id})">${c.pago?'Sim':'Não'}</button></td>
                        <td style="text-align:right;">
                            <div style="display:flex; justify-content: flex-end; gap: 5px;">
                                <button class="btn-action" onclick="editarContaFixa(${c.id})" title="Editar"><span class="material-icons" style="font-size: 18px;">edit</span></button>
                                <button class="btn-action btn-delete" onclick="deletarItemGeral(${c.id}, 'fixa')" title="Excluir"><span class="material-icons" style="font-size: 18px;">delete</span></button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            // Tabela Faturamentos
            const tbodyFat = document.getElementById('listaFaturamentos');
            tbodyFat.innerHTML = '';
            let fatOrdenados = aplicarOrdenacao(window.activeFaturamentos, ordFaturamentos);
            
            fatOrdenados.forEach(f => {
                totalFaturamentos += f.valor;
                tbodyFat.innerHTML += `
                    <tr>
                        <td style="color:var(--text-muted); font-size:0.85rem">${formatarData(f.data)}</td>
                        <td style="font-weight: 500">${f.nome}</td>
                        <td style="color:var(--green-success); font-weight:700;">+ R$ ${f.valor.toFixed(2)}</td>
                        <td style="text-align:right;"><button class="btn-action btn-delete" onclick="deletarItemGeral(${f.id}, 'faturamento')"><span class="material-icons">delete</span></button></td>
                    </tr>
                `;
            });

            const saldoCaixaInicial = parseFloat(document.getElementById('saldoInput').value) || 0;
            const saldoEstimado = saldoCaixaInicial + totalFaturamentos;
            let resultadoFinal = saldoEstimado - restante;

            document.getElementById('mSaldoEstimado').innerText = `R$ ${saldoEstimado.toFixed(2)}`;
            document.getElementById('mOrcamento').innerText = `R$ ${orcamento.toFixed(2)}`;
            document.getElementById('mPago').innerText = `R$ ${pago.toFixed(2)}`;
            document.getElementById('mRestante').innerText = `R$ ${restante.toFixed(2)}`;
            
            const elRes = document.getElementById('mResultado');
            elRes.innerText = `R$ ${resultadoFinal.toFixed(2)}`;
            elRes.style.color = resultadoFinal >= 0 ? 'var(--green-success)' : 'var(--red-danger)';

            const divAcumulados = document.getElementById('listaAcumulados');
            divAcumulados.innerHTML = '';
            
            let catArray = Object.entries(totalPorCategoria).sort((a,b) => b[1] - a[1]);
            catArray.forEach(([cat, valor]) => {
                if(valor > 0) {
                    let icone = obterIconeCategoria(cat);
                    divAcumulados.innerHTML += `
                        <div class="acumulado-item">
                            <span style="display:flex; align-items:center; gap:8px;">
                                <span class="material-icons" style="font-size:18px; color:var(--text-muted);">${icone}</span> ${cat}
                            </span>
                            <span style="color:var(--text-highlight); font-weight:700">R$ ${valor.toFixed(2)}</span>
                        </div>`;
                }
            });

            const divSubs = document.getElementById('listaAssinaturasCard');
            divSubs.innerHTML = '';
            let totalAssin = 0;
            assinaturasConfig.forEach(s => {
                totalAssin += (s.valor || 0);
                let valorFormatado = s.valor ? ` - R$ ${s.valor.toFixed(2)}` : '';
                let alerta = calcularAlertaVencimento(s.vencimento, false); 
                divSubs.innerHTML += `<div class="sub-item"><span>🔔 ${s.nome} <strong style="color:var(--text-highlight)">${valorFormatado}</strong></span><div style="display:flex; align-items:center; gap:10px;"><span class="vencimento-tag" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span><button class="btn-action btn-delete" onclick="deletarAssinatura(${s.id})"><span class="material-icons" style="font-size:1.1rem;">delete</span></button></div></div>`;
            });
            document.getElementById('totalAssinaturas').innerText = `R$ ${totalAssin.toFixed(2)}`;

            let chartDataArray = categoriasAtuais.map(c => totalPorCategoria[c]);
            updateChart(chartDataArray);

            // Garante que o calendário atualize sempre que salvar novos dados
            renderizarCalendario();
        }
