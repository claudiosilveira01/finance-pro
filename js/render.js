// Função central: recalcula e redesenha todo o painel a partir do estado atual
        function calcularEAtualizarVisual() {
            // Congela o estado da flag no início: as animações (badges, listas, odômetro lento)
            // só tocam quando a carga foi armada (login, troca de mês, troca de aba no mobile) —
            // nunca num recálculo disparado por uma simples seleção/marcação de checkbox.
            const animarAgora = animarNaCarga;
            const duracaoOdometro = animarAgora ? 1800 : 500;
            const classeAnim = animarAgora ? ' item-anim' : '';
            const classeAnimBadge = animarAgora ? ' anim-pop' : '';

            let orcamento = 0, pago = 0, restante = 0, totalFaturamentos = 0;
            let totalPorCategoria = {};
            categoriasAtuais.forEach(c => totalPorCategoria[c] = 0);

            // Tabela Fixas — se houver filtros ativos, usa fixas filtradas; senão, usa todas.
            // O filtro é só uma forma de achar itens na lista: Orçamento/Pago/Restante, o gráfico
            // por categoria e o cálculo de Sobra/Falta sempre somam TODAS as contas fixas do mês,
            // nunca só o subconjunto filtrado — senão um filtro ativo mudaria silenciosamente
            // números que aparecem em outros cards do painel.
            const fixasParaRender = temFiltrosAtivos && temFiltrosAtivos() ? obterFixasFiltradas() : window.activeFixas;
            let fixasOrdenadas = aplicarOrdenacao(fixasParaRender, ordFixas);

            (window.activeFixas || []).forEach(c => {
                orcamento += c.valor;
                if(c.pago) pago += c.valor; else restante += c.valor;
                // Conta vinda de um cartão de crédito: a parte dela no gráfico vem detalhada
                // pelas categorias reais das compras da fatura (abaixo), não como um bloco só
                // "Cartão de Crédito" — senão contaria o mesmo dinheiro duas vezes.
                if (c.origemCartaoId) return;
                if(totalPorCategoria[c.categoria] !== undefined) totalPorCategoria[c.categoria] += c.valor;
            });

            Object.values(window.activeCartoesFaturas || {}).forEach(fatura => {
                (fatura.transacoes || []).forEach(t => {
                    if (totalPorCategoria[t.categoria] !== undefined) totalPorCategoria[t.categoria] += t.valor;
                });
            });

            const tbodyFixas = document.getElementById('listaFixas');
            if (tbodyFixas) tbodyFixas.innerHTML = '';
            let somaSelecionadaFixas = 0;
            fixasOrdenadas.forEach(c => {
                let alerta = calcularAlertaVencimento(c.vencimento, c.pago, c.origemCartaoId ? 1 : 0);
                const marcado = fixasSelecionadas.has(c.id);
                if (marcado) somaSelecionadaFixas += c.valor;
                if (!tbodyFixas) return;

                tbodyFixas.innerHTML += `
                    <tr>
                        <td class="td-check"><input type="checkbox" class="row-check" ${marcado ? 'checked' : ''} onchange="toggleSelecaoFixa(${c.id})"></td>
                        <td data-label="Item">
                            <button class="item-link" onclick="editarContaFixa(${c.id})">${c.nome}</button>
                            <div class="fixa-sub">${c.categoria}${c.obs ? ' · ' + c.obs : ''}</div>
                        </td>
                        <td data-label="Venc."><span class="vencimento-tag${classeAnimBadge}" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span></td>
                        <td data-label="Valor"><strong class="fixa-valor">R$ ${c.valor.toFixed(2)}</strong></td>
                        <td data-label="Pago?"><button class="status-badge${classeAnimBadge} ${c.pago?'sim':'nao'}" onclick="togglePagoFixa(${c.id})">${c.pago?'Sim':'Não'}</button></td>
                    </tr>
                `;
            });
            [...fixasSelecionadas].forEach(id => { if (!fixasOrdenadas.some(c => c.id === id)) fixasSelecionadas.delete(id); });
            animarNumero('mSomaSelecionadasCard', somaSelecionadaFixas, duracaoOdometro);

            // Tabela Faturamentos
            let fatOrdenados = aplicarOrdenacao(window.activeFaturamentos, ordFaturamentos);
            fatOrdenados.forEach(f => { totalFaturamentos += f.valor; });

            const tbodyFat = document.getElementById('listaFaturamentos');
            if (tbodyFat) tbodyFat.innerHTML = '';
            fatOrdenados.forEach(f => {
                if (!tbodyFat) return;
                tbodyFat.innerHTML += `
                    <tr>
                        <td data-label="Data" style="color:var(--text-muted); font-size:0.85rem">${formatarData(f.data)}</td>
                        <td data-label="Origem"><button class="item-link" onclick="editarFaturamento(${f.id})">${f.nome}</button></td>
                        <td data-label="Valor" style="color:var(--green-success); font-weight:700;">+ R$ ${f.valor.toFixed(2)}</td>
                        <td data-label="" style="text-align:right; white-space:nowrap;">
                            <button class="btn-action ${f.noCaixa ? 'btn-no-caixa-ativo' : ''}" onclick="toggleReceitaNoCaixa(${f.id})" title="${f.noCaixa ? 'Já somada ao Caixa Atual — clique pra remover' : 'Somar ao Caixa Atual'}"><i class="ph ${f.noCaixa ? 'ph-check-circle' : 'ph-plus-circle'}"></i></button>
                            <button class="btn-action btn-delete" onclick="deletarItemGeral(${f.id}, 'faturamento')" title="Excluir"><i class="ph ph-trash"></i></button>
                        </td>
                    </tr>
                `;
            });

            window.__ultimoOrcamentoFixo = orcamento;
            window.__ultimoRestanteContas = restante;
            window.__ultimoSomaSelecionada = somaSelecionadaFixas;

            animarNumero('mTotalReceitas', totalFaturamentos, duracaoOdometro);
            animarNumero('mOrcamento', orcamento, duracaoOdometro);
            animarNumero('mPago', pago, duracaoOdometro);
            animarNumero('mRestante', restante, duracaoOdometro);

            renderizarSobraFaltaEstimada();

            const divAcumulados = document.getElementById('listaAcumulados');
            if (divAcumulados) divAcumulados.innerHTML = '';

            let catArray = Object.entries(totalPorCategoria).sort((a,b) => b[1] - a[1]);
            let catIdx = 0;
            catArray.forEach(([cat, valor]) => {
                if(valor > 0 && divAcumulados) {
                    let icone = obterIconeCategoria(cat);
                    divAcumulados.innerHTML += `
                        <div class="acumulado-item${classeAnim}" style="animation-delay:${catIdx * 0.04}s">
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
            if (typeof renderizarCartoesDashboard === 'function') renderizarCartoesDashboard();

            let chartDataArray = categoriasAtuais.map(c => totalPorCategoria[c]);
            window.__ultimoChartDataArray = chartDataArray;
            if (!window.chartFoiRevelado || window.chartFoiRevelado()) {
                updateChart(chartDataArray);
            }

            // Garante que o calendário atualize sempre que salvar novos dados
            renderizarCalendario();

            // Consumida: até a próxima carga/troca de mês/troca de aba, os recálculos ficam "quietos".
            animarNaCarga = false;
        }

        // Card "Sobra/Falta Estimada": consulta livre, não faz parte do cálculo automático do
        // Painel de Controle. Base = Caixa Atual + Receitas ("Nenhuma", uma específica ou todas
        // somadas); Orçamento = "Nenhuma", Orçamento Fixo total ou só o Restante Contas (ainda não
        // pago); resultado = (Caixa Atual + Receitas) - Orçamento.
        function renderizarSobraFaltaEstimada() {
            const selectReceita = document.getElementById('sobraFaltaReceita');
            const selectOrcamento = document.getElementById('sobraFaltaOrcamento');
            if (!selectReceita || !selectOrcamento) return;

            const receitaSelecionadaAntes = selectReceita.value;
            const opcoesReceita = [
                { value: 'nenhuma', label: 'Nenhuma' },
                { value: 'total', label: 'Todas as Receitas' },
                ...(window.activeFaturamentos || []).map(f => ({ value: `fat-${f.id}`, label: `${f.nome} — R$ ${f.valor.toFixed(2)}` }))
            ];
            selectReceita.innerHTML = opcoesReceita.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
            selectReceita.value = opcoesReceita.some(o => o.value === receitaSelecionadaAntes) ? receitaSelecionadaAntes : 'total';

            let receitas = 0;
            if (selectReceita.value === 'total') {
                receitas = (window.activeFaturamentos || []).reduce((s, f) => s + f.valor, 0);
            } else if (selectReceita.value !== 'nenhuma') {
                const fatId = Number(selectReceita.value.replace('fat-', ''));
                const f = (window.activeFaturamentos || []).find(item => item.id === fatId);
                receitas = f ? f.valor : 0;
            }

            const caixaAtual = parseFloat(document.getElementById('saldoInput').value) || 0;
            let orcamento = 0;
            if (selectOrcamento.value === 'fixo') orcamento = window.__ultimoOrcamentoFixo || 0;
            else if (selectOrcamento.value === 'restante') orcamento = window.__ultimoRestanteContas || 0;
            else if (selectOrcamento.value === 'soma') orcamento = window.__ultimoSomaSelecionada || 0;

            const disponivel = caixaAtual + receitas;
            const z = disponivel - orcamento;

            document.getElementById('sobraFaltaCaixa').innerText = `R$ ${caixaAtual.toFixed(2)}`;
            document.getElementById('sobraFaltaX').innerText = `R$ ${receitas.toFixed(2)}`;
            document.getElementById('sobraFaltaY').innerText = `R$ ${orcamento.toFixed(2)}`;
            document.getElementById('sobraFaltaZ').innerText = `R$ ${Math.abs(z).toFixed(2)}`;
            document.getElementById('sobraFaltaResultadoLabel').innerText = z >= 0 ? 'Sobra estimada' : 'Falta estimada';
            document.getElementById('sobraFaltaResultadoBox').className = 'sobra-falta-resultado ' + (z >= 0 ? 'positivo' : 'negativo');

            if (typeof atualizarChartSobraFalta === 'function') atualizarChartSobraFalta(disponivel, orcamento, z >= 0);
        }

        // Reseta os dois seletores do card Sobra/Falta pra "Nenhuma" — atalho pra zerar a consulta.
        function limparSobraFaltaEstimada() {
            const selectReceita = document.getElementById('sobraFaltaReceita');
            const selectOrcamento = document.getElementById('sobraFaltaOrcamento');
            if (selectReceita) selectReceita.value = 'nenhuma';
            if (selectOrcamento) selectOrcamento.value = 'nenhuma';
            renderizarSobraFaltaEstimada();
        }
