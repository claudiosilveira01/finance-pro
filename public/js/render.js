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
            const fixasParaRender = temFiltrosAtivos() ? obterFixasFiltradas() : window.activeFixas;
            let fixasOrdenadas = aplicarOrdenacao(fixasParaRender, ordFixas);

            (window.activeFixas || []).forEach(c => {
                orcamento += c.valor;
                if(c.pago) pago += c.valor; else restante += c.valor;
                if(totalPorCategoria[c.categoria] !== undefined) totalPorCategoria[c.categoria] += c.valor;
            });

            const tbodyFixas = document.getElementById('listaFixas');
            if (tbodyFixas) tbodyFixas.innerHTML = '';
            // Soma sempre a partir de TODAS as contas do mês, não só da tabela filtrada — senão
            // um item marcado que um filtro esconde some da soma sem o usuário desmarcar nada.
            let somaSelecionadaFixas = 0;
            (window.activeFixas || []).forEach(c => { if (fixasSelecionadas.has(c.id)) somaSelecionadaFixas += c.valor; });
            fixasOrdenadas.forEach(c => {
                let alerta = calcularAlertaVencimento(c.vencimento, c.pago);
                const marcado = fixasSelecionadas.has(c.id);
                if (!tbodyFixas) return;

                tbodyFixas.innerHTML += `
                    <tr>
                        <td class="td-check"><input type="checkbox" class="row-check" ${marcado ? 'checked' : ''} onchange="toggleSelecaoFixa(${c.id})"></td>
                        <td data-label="Item">
                            <button class="item-link" onclick="editarContaFixa(${c.id})">${_esc(c.nome)}</button>
                            <div class="fixa-sub">${_esc(c.categoria)}${c.obs ? ' · ' + _esc(c.obs) : ''}</div>
                        </td>
                        <td data-label="Venc."><span class="vencimento-tag${classeAnimBadge}" style="color:${alerta.cor}; background-color:${alerta.bg}">${alerta.texto}</span></td>
                        <td data-label="Valor"><strong class="fixa-valor">R$ ${c.valor.toFixed(2)}</strong></td>
                        <td data-label="Pago?"><button class="status-badge${classeAnimBadge} ${c.pago?'sim':'nao'}" onclick="togglePagoFixa(${c.id})">${c.pago?'Sim':'Não'}</button></td>
                    </tr>
                `;
            });
            [...fixasSelecionadas].forEach(id => { if (!(window.activeFixas || []).some(c => c.id === id)) fixasSelecionadas.delete(id); });
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
                        <td data-label="Origem"><button class="item-link" onclick="editarFaturamento(${f.id})">${_esc(f.nome)}</button></td>
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
                                <i class="ph ph-${icone}" style="font-size:18px; color:var(--text-muted);"></i> ${_esc(cat)}
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
        // Painel de Controle. Base = Caixa Atual + Receitas ("Nenhuma", uma específica ou — só no
        // seletor mobile — todas somadas); Orçamento = Fixo, Restante Contas ou Soma das
        // Selecionadas; resultado = (Caixa Atual + Receitas) - Orçamento.
        //
        // Orçamento vira 3 botões (Fixo/Restante/Soma) tanto no mobile quanto no desktop. Receitas
        // vira botões (um por receita cadastrada) só no desktop — no mobile continua o <select> de
        // sempre (com a opção extra "Todas as Receitas", que os botões do desktop não têm).
        // Ambas as escolhas ficam salvas em localStorage (função _salvarEstadoUI/_lerEstadoUI em
        // config.js), então sobrevivem a fechar a aba e trocar de mês.
        function renderizarSobraFaltaEstimada() {
            const receitasDisponiveis = window.activeFaturamentos || [];

            // Se a receita escolhida foi excluída nesse meio tempo, volta pra "Nenhuma" — nunca
            // aponta pra um id que não existe mais.
            if (sobraFaltaReceitaEscolha !== 'nenhuma' && sobraFaltaReceitaEscolha !== 'total'
                && !receitasDisponiveis.some(f => `fat-${f.id}` === sobraFaltaReceitaEscolha)) {
                sobraFaltaReceitaEscolha = 'nenhuma';
            }

            _renderizarOrcamentoBotoesSobraFalta();
            _renderizarReceitaBotoesSobraFalta(receitasDisponiveis);
            _sincronizarReceitaSelectMobileSobraFalta(receitasDisponiveis);

            let receitas = 0;
            if (sobraFaltaReceitaEscolha === 'total') {
                receitas = receitasDisponiveis.reduce((s, f) => s + f.valor, 0);
            } else if (sobraFaltaReceitaEscolha !== 'nenhuma') {
                const fatId = Number(sobraFaltaReceitaEscolha.replace('fat-', ''));
                const f = receitasDisponiveis.find(item => item.id === fatId);
                receitas = f ? f.valor : 0;
            }

            const caixaAtual = _parseDinheiro(document.getElementById('saldoInput').value) || 0;
            let orcamento = 0;
            if (sobraFaltaOrcamentoEscolha === 'fixo') orcamento = window.__ultimoOrcamentoFixo || 0;
            else if (sobraFaltaOrcamentoEscolha === 'restante') orcamento = window.__ultimoRestanteContas || 0;
            else if (sobraFaltaOrcamentoEscolha === 'soma') orcamento = window.__ultimoSomaSelecionada || 0;

            const disponivel = caixaAtual + receitas;
            const z = disponivel - orcamento;

            document.getElementById('sobraFaltaZ').innerText = `R$ ${Math.abs(z).toFixed(2)}`;
            document.getElementById('sobraFaltaResultadoLabel').innerText = z >= 0 ? 'Sobra estimada' : 'Falta estimada';
            document.getElementById('sobraFaltaResultadoBox').className = 'sobra-falta-resultado ' + (z >= 0 ? 'positivo' : 'negativo');

            atualizarChartSobraFalta(disponivel, orcamento, z >= 0);
        }

        function selecionarOrcamentoSobraFalta(valor) {
            sobraFaltaOrcamentoEscolha = valor;
            _salvarEstadoUI('sobraFaltaOrcamento', valor);
            renderizarSobraFaltaEstimada();
        }
        function selecionarReceitaSobraFalta(valor) {
            sobraFaltaReceitaEscolha = valor;
            _salvarEstadoUI('sobraFaltaReceita', valor);
            renderizarSobraFaltaEstimada();
        }

        function _renderizarOrcamentoBotoesSobraFalta() {
            const box = document.getElementById('sobraFaltaOrcamentoBotoes');
            if (!box) return;
            const opcoes = [
                { valor: 'fixo', label: 'Fixo', icone: 'wallet' },
                { valor: 'restante', label: 'Restante', icone: 'hourglass-medium' },
                { valor: 'soma', label: 'Soma', icone: 'calculator' }
            ];
            box.innerHTML = opcoes.map(o => `
                <button type="button" class="sobra-opcao-btn ${o.valor === sobraFaltaOrcamentoEscolha ? 'ativo' : ''}" onclick="selecionarOrcamentoSobraFalta('${o.valor}')">
                    <i class="ph ph-${o.icone}"></i> ${o.label}
                </button>
            `).join('');
        }

        function _renderizarReceitaBotoesSobraFalta(receitas) {
            const box = document.getElementById('sobraFaltaReceitaBotoes');
            if (!box) return;
            const opcoes = [
                { valor: 'nenhuma', label: 'Nenhuma', icone: 'prohibit' },
                { valor: 'total', label: 'Somar Todas', icone: 'currency-dollar' },
                ...receitas.map(f => ({ valor: `fat-${f.id}`, label: f.nome, icone: 'currency-dollar' }))
            ];
            box.innerHTML = opcoes.map(o => `
                <button type="button" class="sobra-opcao-btn ${o.valor === sobraFaltaReceitaEscolha ? 'ativo' : ''}" onclick="selecionarReceitaSobraFalta('${_esc(o.valor)}')">
                    <i class="ph ph-${o.icone}"></i> ${_esc(o.label)}
                </button>
            `).join('');
        }

        // O <select> do mobile mantém as 3 categorias de sempre (Nenhuma/Todas/individual) — só
        // reflete a mesma escolha guardada em sobraFaltaReceitaEscolha, sem duplicar estado.
        function _sincronizarReceitaSelectMobileSobraFalta(receitas) {
            const select = document.getElementById('sobraFaltaReceita');
            if (!select) return;
            const opcoes = [
                { value: 'nenhuma', label: 'Nenhuma' },
                { value: 'total', label: 'Todas as Receitas' },
                ...receitas.map(f => ({ value: `fat-${f.id}`, label: `${f.nome} — R$ ${f.valor.toFixed(2)}` }))
            ];
            select.innerHTML = opcoes.map(o => `<option value="${_esc(o.value)}">${_esc(o.label)}</option>`).join('');
            select.value = sobraFaltaReceitaEscolha;
        }

        // Limpa tudo do card Sobra/Falta: Orçamento volta pra "Fixo" (padrão), Receitas volta pra
        // "Nenhuma", e o Caixa Atual volta a ficar vazio (não "0,00" — vazio de verdade).
        function limparSobraFaltaEstimada() {
            const saldoInput = document.getElementById('saldoInput');
            if (saldoInput) saldoInput.value = '';
            selecionarOrcamentoSobraFalta('fixo');
            selecionarReceitaSobraFalta('nenhuma');
            salvarDadosDoMesAtual();
        }
