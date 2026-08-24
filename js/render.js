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

            // Tabela Fixas — se houver filtros ativos, usa fixas filtradas; senão, usa todas
            const fixasParaRender = temFiltrosAtivos && temFiltrosAtivos() ? obterFixasFiltradas() : window.activeFixas;
            let fixasOrdenadas = aplicarOrdenacao(fixasParaRender, ordFixas);

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
                            <div class="fixa-sub">${c.categoria}${c.obs ? ' · ' + c.obs : ''}</div>
                        </td>
                        <td data-label="Venc."><span class="vencimento-tag${classeAnimBadge}" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span></td>
                        <td data-label="Valor"><strong class="fixa-valor">R$ ${c.valor.toFixed(2)}</strong></td>
                        <td data-label="Pago?"><button class="status-badge${classeAnimBadge} ${c.pago?'sim':'nao'}" onclick="togglePagoFixa(${c.id})">${c.pago?'Sim':'Não'}</button></td>
                    </tr>
                `;
            });
            [...fixasSelecionadas].forEach(id => { if (!fixasOrdenadas.some(c => c.id === id)) fixasSelecionadas.delete(id); });
            animarNumero('mSomaSelecionadas', somaSelecionadaFixas, duracaoOdometro);
            animarNumero('mSomaSelecionadasCard', somaSelecionadaFixas, duracaoOdometro);

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
                            <button class="btn-action ${f.noCaixa ? 'btn-no-caixa-ativo' : ''}" onclick="toggleReceitaNoCaixa(${f.id})" title="${f.noCaixa ? 'Já somada ao Caixa Atual — clique pra remover' : 'Somar ao Caixa Atual'}"><i class="ph ${f.noCaixa ? 'ph-check-circle' : 'ph-plus-circle'}"></i></button>
                            <button class="btn-action" onclick="editarFaturamento(${f.id})" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                            <button class="btn-action btn-delete" onclick="deletarItemGeral(${f.id}, 'faturamento')" title="Excluir"><i class="ph ph-trash"></i></button>
                        </td>
                    </tr>
                `;
            });

            window.__ultimoOrcamentoFixo = orcamento;

            animarNumero('mTotalReceitas', totalFaturamentos, duracaoOdometro);
            animarNumero('mOrcamento', orcamento, duracaoOdometro);
            animarNumero('mPago', pago, duracaoOdometro);
            animarNumero('mRestante', restante, duracaoOdometro);

            renderizarSobraFaltaEstimada();

            const divAcumulados = document.getElementById('listaAcumulados');
            divAcumulados.innerHTML = '';
            
            let catArray = Object.entries(totalPorCategoria).sort((a,b) => b[1] - a[1]);
            let catIdx = 0;
            catArray.forEach(([cat, valor]) => {
                if(valor > 0) {
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
        // Painel de Controle. X = base escolhida pelo usuário (total das receitas, o Caixa Atual,
        // ou uma receita específica), Y = Orçamento Fixo total, Z = X - Y.
        function renderizarSobraFaltaEstimada() {
            const select = document.getElementById('sobraFaltaBase');
            if (!select) return;

            const valorSelecionadoAntes = select.value;
            const opcoes = [
                { value: 'total', label: 'Total das Receitas' },
                { value: 'caixa', label: 'Caixa Atual' },
                ...(window.activeFaturamentos || []).map(f => ({ value: `fat-${f.id}`, label: `${f.nome} — R$ ${f.valor.toFixed(2)}` }))
            ];
            select.innerHTML = opcoes.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
            select.value = opcoes.some(o => o.value === valorSelecionadoAntes) ? valorSelecionadoAntes : 'total';

            let x = 0;
            if (select.value === 'total') {
                x = (window.activeFaturamentos || []).reduce((s, f) => s + f.valor, 0);
            } else if (select.value === 'caixa') {
                x = parseFloat(document.getElementById('saldoInput').value) || 0;
            } else {
                const fatId = Number(select.value.replace('fat-', ''));
                const f = (window.activeFaturamentos || []).find(item => item.id === fatId);
                x = f ? f.valor : 0;
            }

            const orcamento = window.__ultimoOrcamentoFixo || 0;
            const z = x - orcamento;

            document.getElementById('sobraFaltaX').innerText = `R$ ${x.toFixed(2)}`;
            document.getElementById('sobraFaltaY').innerText = `R$ ${orcamento.toFixed(2)}`;
            const elZ = document.getElementById('sobraFaltaZ');
            elZ.innerText = `R$ ${z.toFixed(2)}`;
            elZ.style.color = z >= 0 ? 'var(--green-success)' : 'var(--red-danger)';
        }
