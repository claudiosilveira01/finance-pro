// Exportação de dados: relatório mensal completo em PDF via jsPDF + autoTable
        function _pdfNomeMes(mesKey) {
            const [ano, mes] = (mesKey || '').split('-').map(Number);
            if (!ano || !mes) return mesKey || '';
            return `${_NOMES_MES[mes - 1]} de ${ano}`;
        }

        // Paleta do relatório — os mesmos tons de roxo/verde/vermelho do app (ver :root em
        // css/style.css), pra o PDF parecer uma extensão do Finance Pro e não um documento genérico.
        const _PDF_COR_PRIMARIA = [91, 63, 214];      // --purple-main
        const _PDF_COR_PRIMARIA_ESCURA = [59, 79, 209]; // --text-highlight-alt
        const _PDF_COR_VERDE = [22, 163, 74];          // --green-success
        const _PDF_COR_VERMELHA = [239, 68, 68];       // --red-danger
        const _PDF_COR_MUTED = [113, 108, 147];        // --text-muted
        const _PDF_COR_BG_LIGHT = [246, 245, 252];     // --bg-light
        const _PDF_COR_BORDA = [233, 230, 247];        // --border-color

        // Pula pra próxima página se não sobrar espaço suficiente pro título + início da próxima
        // seção (a margem de baixo já reserva espaço pro rodapé numerado, aplicado no fim).
        function _pdfGarantirEspaco(doc, y, minimo) {
            const alturaPagina = doc.internal.pageSize.getHeight();
            if (y + minimo > alturaPagina - 20) {
                doc.addPage();
                return 20;
            }
            return y;
        }

        // Insere um gráfico Chart.js como imagem, mantendo a proporção original (sem esticar/achatar).
        // Usa o <canvas> real (não chart.width/height, que ficam 0 se o gráfico estiver numa aba
        // escondida no mobile no momento da exportação) — e se ainda assim não der pra saber o
        // tamanho, pula só essa imagem em vez de travar o relatório inteiro.
        function _pdfInserirGrafico(doc, chart, x, y, larguraMax, alturaMax) {
            const larguraOriginal = chart.canvas && chart.canvas.width;
            const alturaOriginal = chart.canvas && chart.canvas.height;
            if (!larguraOriginal || !alturaOriginal) return 0;

            let largura = larguraMax, altura = larguraMax * (alturaOriginal / larguraOriginal);
            if (altura > alturaMax) { altura = alturaMax; largura = alturaMax * (larguraOriginal / alturaOriginal); }
            doc.addImage(chart.toBase64Image(), 'PNG', x, y, largura, altura);
            return altura;
        }

        // Título de seção padronizado: barra lateral roxa + texto, sempre no mesmo estilo.
        function _pdfTituloSecao(doc, texto, x, y, corPrimaria) {
            doc.setFillColor(...corPrimaria);
            doc.roundedRect(x, y - 4.2, 2.4, 6.2, 1.2, 1.2, 'F');
            doc.setFontSize(12.5);
            doc.setTextColor(...corPrimaria);
            doc.setFont(undefined, 'bold');
            doc.text(texto, x + 6, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(30, 30, 30);
        }

        // Cartão de indicador (KPI) — rótulo pequeno em cima, valor grande embaixo, com uma
        // tarja colorida na lateral. É o mesmo padrão visual dos "stat-row" do Painel de Controle
        // no app, só que desenhado manualmente porque o PDF não tem CSS.
        function _pdfKpiCard(doc, x, y, w, h, label, valorTexto, corDestaque) {
            doc.setFillColor(..._PDF_COR_BG_LIGHT);
            doc.roundedRect(x, y, w, h, 2.2, 2.2, 'F');
            doc.setFillColor(...corDestaque);
            doc.roundedRect(x, y, 2.2, h, 1.1, 1.1, 'F');

            doc.setFontSize(7);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(..._PDF_COR_MUTED);
            doc.text(label, x + 7, y + 9, { maxWidth: w - 10 });

            doc.setFontSize(12);
            doc.setTextColor(...corDestaque);
            doc.text(valorTexto, x + 7, y + h - 7, { maxWidth: w - 10 });

            doc.setFont(undefined, 'normal');
            doc.setTextColor(30, 30, 30);
        }

        // Desenha uma grade de KPIs em N colunas, devolvendo o Y logo abaixo da grade.
        function _pdfGradeKpis(doc, kpis, x, y, larguraTotal, colunas) {
            const gap = 5;
            const larguraCard = (larguraTotal - gap * (colunas - 1)) / colunas;
            const alturaCard = 24;
            kpis.forEach((kpi, i) => {
                const col = i % colunas;
                const linha = Math.floor(i / colunas);
                const cx = x + col * (larguraCard + gap);
                const cy = y + linha * (alturaCard + gap);
                _pdfKpiCard(doc, cx, cy, larguraCard, alturaCard, kpi.label, kpi.valor, kpi.cor);
            });
            const linhas = Math.ceil(kpis.length / colunas);
            return y + linhas * (alturaCard + gap) - gap;
        }

        // Estilo padrão pras tabelas do relatório — zebra roxo clarinho e cabeçalho na cor da marca,
        // em vez do cinza genérico padrão do autoTable.
        function _pdfEstiloTabela(extra) {
            return Object.assign({
                theme: 'striped',
                headStyles: { fillColor: _PDF_COR_PRIMARIA, textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: _PDF_COR_BG_LIGHT },
                styles: { fontSize: 9, textColor: [30, 30, 30], lineColor: _PDF_COR_BORDA, lineWidth: 0.1 }
            }, extra || {});
        }

        // Relatório mensal completo: Resumo Financeiro (destaque no topo, em cartões de indicador),
        // Receitas, Contas Fixas, Registro de Pagamentos, Extrato Bancário, Gastos por Categoria
        // (com gráficos). Seções sem nenhum dado no mês são puladas inteiras.
        function exportarRelatorioMensalPDF() {
            try {
                _gerarRelatorioMensalPDF();
            } catch (err) {
                mostrarToast('Erro ao gerar o relatório: ' + err.message, 'error', 6000);
            }
        }

        function _gerarRelatorioMensalPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const corPrimaria = _PDF_COR_PRIMARIA;
            const corVerde = _PDF_COR_VERDE;
            const corVermelha = _PDF_COR_VERMELHA;
            const larguraPagina = doc.internal.pageSize.getWidth();

            // Cabeçalho: faixa roxa da marca, com um "selo" FP (o mesmo espírito do ícone do app),
            // nome do produto, mês por extenso e data/hora de geração.
            doc.setFillColor(...corPrimaria);
            doc.rect(0, 0, larguraPagina, 36, 'F');

            doc.setFillColor(255, 255, 255);
            doc.roundedRect(14, 9, 17, 17, 4, 4, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...corPrimaria);
            doc.text('FP', 14 + 8.5, 9 + 11.5, { align: 'center' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(15);
            doc.text('Finance Pro', 37, 16.5);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9.5);
            doc.text(`Relatório Mensal — ${_pdfNomeMes(mesAtualKey)}`, 37, 24);
            doc.setFontSize(7.5);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, larguraPagina - 14, 31, { align: 'right' });
            doc.setTextColor(30, 30, 30);

            let y = 48;

            // Resumo Financeiro em cartões de indicador — visão executiva antes de entrar nos
            // detalhes de cada seção. Sempre calculado direto dos dados (nunca lido da tela), pra
            // não refletir um filtro que porventura esteja ativo em Contas Fixas no momento da exportação.
            const selectReceita = document.getElementById('sobraFaltaReceita');
            const selectOrcamento = document.getElementById('sobraFaltaOrcamento');
            const labelReceitaEscolhida = selectReceita && selectReceita.selectedOptions[0] ? selectReceita.selectedOptions[0].text : '—';
            const labelOrcamentoEscolhido = selectOrcamento && selectOrcamento.selectedOptions[0] ? selectOrcamento.selectedOptions[0].text : '—';
            const caixaAtual = _parseDinheiro(document.getElementById('saldoInput').value) || 0;
            // sobraFaltaZ mostra o valor sempre positivo (o sinal vem do rótulo "Sobra"/"Falta" ao
            // lado); a classe do box (positivo/negativo) é a fonte confiável do sinal aqui.
            const sobraFaltaPositiva = (document.getElementById('sobraFaltaResultadoBox')?.className || '').includes('positivo');
            const sobraFaltaLabel = document.getElementById('sobraFaltaResultadoLabel')?.innerText || 'Sobra/Falta Estimada';
            const sobraFaltaValorTexto = document.getElementById('sobraFaltaZ').innerText;

            const orcamentoFixoReal = (window.activeFixas || []).reduce((s, c) => s + c.valor, 0);
            const pagoReal = (window.activeFixas || []).filter(c => c.pago).reduce((s, c) => s + c.valor, 0);
            const restanteReal = orcamentoFixoReal - pagoReal;
            const totalReceitasReal = (window.activeFaturamentos || []).reduce((s, f) => s + f.valor, 0);

            _pdfTituloSecao(doc, 'Resumo Financeiro', 14, y, corPrimaria);
            y += 8;

            const kpis = [
                { label: 'ORÇAMENTO FIXO', valor: `R$ ${orcamentoFixoReal.toFixed(2)}`, cor: corPrimaria },
                { label: 'PAGO', valor: `R$ ${pagoReal.toFixed(2)}`, cor: corVerde },
                { label: 'RESTANTE CONTAS', valor: `R$ ${restanteReal.toFixed(2)}`, cor: corVermelha },
                { label: 'TOTAL DE RECEITAS', valor: `R$ ${totalReceitasReal.toFixed(2)}`, cor: corVerde },
                { label: 'CAIXA ATUAL', valor: `R$ ${caixaAtual.toFixed(2)}`, cor: _PDF_COR_PRIMARIA_ESCURA },
                { label: sobraFaltaLabel.toUpperCase(), valor: sobraFaltaValorTexto, cor: sobraFaltaPositiva ? corVerde : corVermelha }
            ];
            y = _pdfGradeKpis(doc, kpis, 14, y, larguraPagina - 28, 3);

            y += 6;
            doc.setFontSize(7.5);
            doc.setTextColor(...(_PDF_COR_MUTED));
            doc.text(`${sobraFaltaLabel}: Caixa Atual + Receitas (${labelReceitaEscolhida}) − Orçamento (${labelOrcamentoEscolhido})`, 14, y);
            doc.setTextColor(30, 30, 30);
            y += 12;

            if((window.activeFaturamentos || []).length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Receitas', 14, y, corPrimaria);
                doc.autoTable(_pdfEstiloTabela({
                    head: [['Data', 'Origem', 'Valor (R$)', 'No Caixa?']],
                    body: window.activeFaturamentos.map(f => [formatarData(f.data), f.nome, f.valor.toFixed(2), f.noCaixa ? 'Sim' : 'Não']),
                    startY: y + 5
                }));
                y = doc.lastAutoTable.finalY + 14;
            }

            if((window.activeFixas || []).length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Contas Fixas', 14, y, corPrimaria);
                doc.autoTable(_pdfEstiloTabela({
                    head: [['Item', 'Categoria', 'Venc.', 'Valor (R$)', 'Pago']],
                    body: [...window.activeFixas]
                        .sort((a, b) => (a.vencimento || 0) - (b.vencimento || 0))
                        .map(c => [c.nome, c.categoria, `Dia ${c.vencimento}`, c.valor.toFixed(2), c.pago ? 'Sim' : 'Não']),
                    startY: y + 5
                }));
                y = doc.lastAutoTable.finalY + 14;
            }

            // Cartões de Crédito: um bloco por cartão que teve compra lançada neste mês — tabela
            // das compras e o acumulado por categoria daquele cartão (calculado direto dos dados,
            // não a partir do gráfico da tela, que só reflete o cartão selecionado no momento).
            const cartoesComDados = (cartoesConfig || []).filter(c => {
                const fatura = (window.activeCartoesFaturas || {})[c.id];
                return fatura && fatura.transacoes && fatura.transacoes.length > 0;
            });
            if (cartoesComDados.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Cartões de Crédito', 14, y, corPrimaria);
                y += 8;

                cartoesComDados.forEach(cartao => {
                    const fatura = window.activeCartoesFaturas[cartao.id];
                    const totalFaturaCartao = _totalFatura(fatura);

                    y = _pdfGarantirEspaco(doc, y, 40);
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(...corPrimaria);
                    doc.text(cartao.nome, 14, y);
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(..._PDF_COR_MUTED);
                    doc.text(`Fecha dia ${cartao.diaFechamento} · Vence dia ${cartao.diaVencimento} · Total da fatura: R$ ${totalFaturaCartao.toFixed(2)}`, 14, y + 5);
                    doc.setTextColor(30, 30, 30);
                    y += 10;

                    doc.autoTable(_pdfEstiloTabela({
                        head: [['Data', 'Descrição', 'Categoria', 'Valor (R$)']],
                        body: [...fatura.transacoes].sort((a, b) => b.data.localeCompare(a.data)).map(t => [formatarData(t.data), t.descricao, t.categoria, t.valor.toFixed(2)]),
                        startY: y,
                        styles: { fontSize: 8, textColor: [30, 30, 30], lineColor: _PDF_COR_BORDA, lineWidth: 0.1 }
                    }));
                    y = doc.lastAutoTable.finalY + 6;

                    const totaisPorCategoriaCartao = {};
                    fatura.transacoes.forEach(t => { totaisPorCategoriaCartao[t.categoria] = (totaisPorCategoriaCartao[t.categoria] || 0) + t.valor; });
                    const catArrayCartao = Object.entries(totaisPorCategoriaCartao).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
                    if (catArrayCartao.length > 0) {
                        y = _pdfGarantirEspaco(doc, y, 20);
                        doc.autoTable(_pdfEstiloTabela({
                            head: [[`Categoria (${cartao.nome})`, 'Valor (R$)']],
                            body: catArrayCartao.map(([c, v]) => [c, v.toFixed(2)]),
                            startY: y,
                            styles: { fontSize: 8, textColor: [30, 30, 30], lineColor: _PDF_COR_BORDA, lineWidth: 0.1 }
                        }));
                        y = doc.lastAutoTable.finalY + 14;
                    } else {
                        y += 8;
                    }
                });
            }

            const registroPagamentos = window.activeRegistroPagamentos || [];
            if (registroPagamentos.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Registro de Pagamentos (Pago / Não Pago / Faturado)', 14, y, corPrimaria);
                doc.autoTable(_pdfEstiloTabela({
                    head: [['Data do Pagamento', 'Registrado em', 'Tipo', 'Item', 'Valor (R$)', 'Ação']],
                    body: [...registroPagamentos]
                        // Date.parse, não localeCompare: o cliente grava "...Z" e o Postgres
                        // devolve "...+00:00" no roundtrip — comparar como string embaralha os dois.
                        .sort((a, b) => (Date.parse(a.registradoEm) || 0) - (Date.parse(b.registradoEm) || 0))
                        .map(r => {
                            const ehAssinatura = r.tipo === 'assinatura';
                            // Data escolhida no popup ("Foi hoje" ou uma data específica) — pode
                            // ser diferente do dia em que o usuário de fato clicou no botão. Nas
                            // desmarcações (sem popup), cai no dia do próprio clique.
                            const dataPagamentoStr = r.dataPagamento || r.registradoEm.slice(0, 10);
                            return [
                                formatarData(dataPagamentoStr),
                                new Date(r.registradoEm).toLocaleString('pt-BR'),
                                ehAssinatura ? 'Assinatura' : 'Conta Fixa',
                                r.nome,
                                r.valor.toFixed(2),
                                ehAssinatura
                                    ? (r.marcadoComoPago ? 'Marcada como Faturada' : 'Voltou para Não Faturada')
                                    : (r.marcadoComoPago ? 'Marcado como Pago' : 'Marcado como Não Pago')
                            ];
                        }),
                    startY: y + 5,
                    styles: { fontSize: 8, textColor: [30, 30, 30], lineColor: _PDF_COR_BORDA, lineWidth: 0.1 }
                }));
                y = doc.lastAutoTable.finalY + 14;
            }

            const extrato = window.activeExtrato || [];
            if (extrato.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Extrato Bancário', 14, y, corPrimaria);
                y += 8;
                const totalEntradas = extrato.filter(t => t.direcao === 'entrada').reduce((s, t) => s + t.valor, 0);
                const totalSaidas = extrato.filter(t => t.direcao === 'saida').reduce((s, t) => s + t.valor, 0);
                y = _pdfGradeKpis(doc, [
                    { label: 'TOTAL DE ENTRADAS', valor: `+ R$ ${totalEntradas.toFixed(2)}`, cor: corVerde },
                    { label: 'TOTAL DE SAÍDAS', valor: `- R$ ${totalSaidas.toFixed(2)}`, cor: corVermelha }
                ], 14, y, larguraPagina - 28, 2);
                y += 8;

                doc.autoTable(_pdfEstiloTabela({
                    head: [['Data', 'Descrição', 'Tipo', 'Entrada/Saída', 'Valor (R$)']],
                    body: [...extrato].sort((a, b) => b.data.localeCompare(a.data)).map(t => [
                        formatarData(t.data), t.item, t.tipo, t.direcao === 'entrada' ? 'Entrada' : 'Saída',
                        `${t.direcao === 'entrada' ? '+' : '-'} ${t.valor.toFixed(2)}`
                    ]),
                    startY: y,
                    styles: { fontSize: 8, textColor: [30, 30, 30], lineColor: _PDF_COR_BORDA, lineWidth: 0.1 }
                }));
                y = doc.lastAutoTable.finalY + 14;
            }

            const chartDataArray = window.__ultimoChartDataArray || [];
            if (chartDataArray.some(v => v > 0)) {
                y = _pdfGarantirEspaco(doc, y, 90);
                _pdfTituloSecao(doc, 'Gastos por Categoria', 14, y, corPrimaria);
                y += 5;

                if (meuGraficoPizza && meuGraficoBarra) {
                    const alturaPizza = _pdfInserirGrafico(doc, meuGraficoPizza, 14, y, 85, 65);
                    const alturaBarra = _pdfInserirGrafico(doc, meuGraficoBarra, 105, y, 85, 65);
                    const alturaMaxima = Math.max(alturaPizza, alturaBarra);
                    if (alturaMaxima > 0) y += alturaMaxima + 8;
                }

                const catArray = categoriasAtuais
                    .map((c, i) => [c, chartDataArray[i] || 0])
                    .filter(([, valor]) => valor > 0)
                    .sort((a, b) => b[1] - a[1]);
                doc.autoTable(_pdfEstiloTabela({
                    head: [['Categoria', 'Valor (R$)']],
                    body: catArray.map(([c, v]) => [c, v.toFixed(2)]),
                    startY: y
                }));
                y = doc.lastAutoTable.finalY + 14;
            }

            // Rodapé numerado em todas as páginas, gerado por último (só agora sabemos o total).
            const totalPaginas = doc.internal.getNumberOfPages();
            const alturaPagina = doc.internal.pageSize.getHeight();
            for (let i = 1; i <= totalPaginas; i++) {
                doc.setPage(i);
                doc.setDrawColor(...(_PDF_COR_BORDA));
                doc.setLineWidth(0.3);
                doc.line(14, alturaPagina - 14, larguraPagina - 14, alturaPagina - 14);
                doc.setFontSize(8);
                doc.setTextColor(140, 140, 140);
                doc.text('Finance Pro', 14, alturaPagina - 9);
                doc.text(`Página ${i} de ${totalPaginas}`, larguraPagina - 14, alturaPagina - 9, { align: 'right' });
            }

            doc.save(`relatorio-${mesAtualKey}.pdf`);
            mostrarToast('Relatório mensal em PDF exportado.', 'success');
        }
