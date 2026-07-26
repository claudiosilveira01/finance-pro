// Função central: recalcula e redesenha todo o painel a partir do estado atual
        function calcularEAtualizarVisual() {
            let orcamento = 0, pago = 0, restante = 0, totalFaturamentos = 0;
            let totalPorCategoria = {};
            categoriasAtuais.forEach(c => totalPorCategoria[c] = 0);

            // Tabela Fixas — totais sempre somam o array completo, mesmo com filtro de busca ativo
            let fixasOrdenadas = aplicarOrdenacao(window.activeFixas, ordFixas);

            fixasOrdenadas.forEach(c => {
                orcamento += c.valor;
                if(c.pago) pago += c.valor; else restante += c.valor;
                if(totalPorCategoria[c.categoria] !== undefined) totalPorCategoria[c.categoria] += c.valor;
            });

            const tbodyFixas = document.getElementById('listaFixas');
            tbodyFixas.innerHTML = '';
            let somaSelecionadaFixas = 0;
            fixasOrdenadas.forEach(c => {
                let alerta = calcularAlertaVencimento(c.vencimento, c.pago);
                const marcado = fixasSelecionadas.has(c.id);
                if (marcado) somaSelecionadaFixas += c.valor;

                tbodyFixas.innerHTML += `
                    <tr>
                        <td class="td-check"><input type="checkbox" class="row-check" ${marcado ? 'checked' : ''} onchange="toggleSelecaoFixa(${c.id})"></td>
                        <td data-label="Item">
                            <button class="item-link" onclick="editarContaFixa(${c.id})">${c.nome}</button>
                            <div style="color:var(--text-muted); font-size:0.78rem; margin-top:2px;">${c.categoria}${c.obs ? ' · ' + c.obs : ''}</div>
                        </td>
                        <td data-label="Venc."><span class="vencimento-tag" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span></td>
                        <td data-label="Valor"><strong style="white-space:nowrap;">R$ ${c.valor.toFixed(2)}</strong></td>
                        <td data-label="Pago?"><button class="status-badge ${c.pago?'sim':'nao'}" onclick="togglePagoFixa(${c.id})">${c.pago?'Sim':'Não'}</button></td>
                    </tr>
                `;
            });
            [...fixasSelecionadas].forEach(id => { if (!fixasOrdenadas.some(c => c.id === id)) fixasSelecionadas.delete(id); });
            document.getElementById('mSomaSelecionadas').innerText = `R$ ${somaSelecionadaFixas.toFixed(2)}`;

            // Tabela Faturamentos
            let fatOrdenados = aplicarOrdenacao(window.activeFaturamentos, ordFaturamentos);
            fatOrdenados.forEach(f => { totalFaturamentos += f.valor; });

            const tbodyFat = document.getElementById('listaFaturamentos');
            tbodyFat.innerHTML = '';
            fatOrdenados.forEach(f => {
                tbodyFat.innerHTML += `
                    <tr>
                        <td data-label="Data" style="color:var(--text-muted); font-size:0.85rem">${formatarData(f.data)}</td>
                        <td data-label="Origem" style="font-weight: 500">${f.nome}</td>
                        <td data-label="Valor" style="color:var(--green-success); font-weight:700;">+ R$ ${f.valor.toFixed(2)}</td>
                        <td data-label="" style="text-align:right; white-space:nowrap;">
                            <button class="btn-action" onclick="editarFaturamento(${f.id})" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                            <button class="btn-action btn-delete" onclick="deletarItemGeral(${f.id}, 'faturamento')" title="Excluir"><i class="ph ph-trash"></i></button>
                        </td>
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
            let catIdx = 0;
            catArray.forEach(([cat, valor]) => {
                if(valor > 0) {
                    let icone = obterIconeCategoria(cat);
                    divAcumulados.innerHTML += `
                        <div class="acumulado-item item-anim" style="animation-delay:${catIdx * 0.04}s">
                            <span style="display:flex; align-items:center; gap:8px;">
                                <i class="ph ph-${icone}" style="font-size:18px; color:var(--text-muted);"></i> ${cat}
                            </span>
                            <span style="color:var(--text-highlight); font-weight:700">R$ ${valor.toFixed(2)}</span>
                        </div>`;
                    catIdx++;
                }
            });

            renderizarAssinaturas();
            renderizarExtrato();

            let chartDataArray = categoriasAtuais.map(c => totalPorCategoria[c]);
            updateChart(chartDataArray);

            // Garante que o calendário atualize sempre que salvar novos dados
            renderizarCalendario();
        }
