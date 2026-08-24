// Exportação de dados: relatório mensal completo em PDF via jsPDF + autoTable
        const _PDF_MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        function _pdfNomeMes(mesKey) {
            const [ano, mes] = (mesKey || '').split('-').map(Number);
            if (!ano || !mes) return mesKey || '';
            return `${_PDF_MESES_NOMES[mes - 1]} de ${ano}`;
        }

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
            doc.setDrawColor(...corPrimaria);
            doc.setLineWidth(1.2);
            doc.line(x, y - 4, x, y + 1.5);
            doc.setFontSize(13);
            doc.setTextColor(...corPrimaria);
            doc.setFont(undefined, 'bold');
            doc.text(texto, x + 4, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(30, 30, 30);
        }

        // Relatório mensal completo: Resumo Financeiro (destaque no topo), Receitas, Contas Fixas,
        // Registro de Pagamentos, Extrato Bancário, Gastos por Categoria (com gráficos). Seções sem
        // nenhum dado no mês são puladas inteiras.
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
            const corPrimaria = [67, 28, 93];
            const corVerde = [16, 185, 129];
            const corVermelha = [239, 68, 68];
            const larguraPagina = doc.internal.pageSize.getWidth();

            // Cabeçalho: faixa colorida com título, mês por extenso e data/hora de geração.
            doc.setFillColor(...corPrimaria);
            doc.rect(0, 0, larguraPagina, 30, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('Relatório Mensal', 14, 16);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(11);
            doc.text(`Planner Financeiro — ${_pdfNomeMes(mesAtualKey)}`, 14, 24);
            doc.setFontSize(8);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, larguraPagina - 14, 24, { align: 'right' });
            doc.setTextColor(30, 30, 30);

            let y = 40;

            // Resumo Financeiro primeiro — visão executiva antes de entrar nos detalhes de cada seção.
            const selectBase = document.getElementById('sobraFaltaBase');
            const labelBaseEscolhida = selectBase && selectBase.selectedOptions[0] ? selectBase.selectedOptions[0].text : '—';
            const caixaAtual = parseFloat(document.getElementById('saldoInput').value) || 0;
            const zTexto = document.getElementById('sobraFaltaZ').innerText;
            const zValor = parseFloat(zTexto.replace('R$', '').trim()) || 0;

            _pdfTituloSecao(doc, 'Resumo Financeiro', 14, y, corPrimaria);
            doc.autoTable({
                body: [
                    ['Orçamento Fixo', document.getElementById('mOrcamento').innerText],
                    ['Restante Contas', document.getElementById('mRestante').innerText],
                    ['Pago', document.getElementById('mPago').innerText],
                    ['Total de Receitas', document.getElementById('mTotalReceitas').innerText],
                    ['Caixa Atual', `R$ ${caixaAtual.toFixed(2)}`],
                    [`Sobra/Falta Estimada (base: ${labelBaseEscolhida})`, zTexto]
                ],
                startY: y + 5,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 5, lineColor: [225, 220, 235], lineWidth: 0.3 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 }, 1: { halign: 'right', fontStyle: 'bold' } },
                didParseCell: (data) => {
                    if (data.row.index === 5 && data.column.index === 1) {
                        data.cell.styles.textColor = zValor >= 0 ? corVerde : corVermelha;
                    }
                }
            });
            y = doc.lastAutoTable.finalY + 14;

            if((window.activeFaturamentos || []).length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Receitas', 14, y, corPrimaria);
                doc.autoTable({
                    head: [['Data', 'Origem', 'Valor (R$)', 'No Caixa?']],
                    body: window.activeFaturamentos.map(f => [formatarData(f.data), f.nome, f.valor.toFixed(2), f.noCaixa ? 'Sim' : 'Não']),
                    startY: y + 5,
                    theme: 'striped',
                    headStyles: { fillColor: corPrimaria }
                });
                y = doc.lastAutoTable.finalY + 14;
            }

            if((window.activeFixas || []).length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Contas Fixas', 14, y, corPrimaria);
                doc.autoTable({
                    head: [['Item', 'Categoria', 'Venc.', 'Valor (R$)', 'Pago']],
                    body: window.activeFixas.map(c => [c.nome, c.categoria, `Dia ${c.vencimento}`, c.valor.toFixed(2), c.pago ? 'Sim' : 'Não']),
                    startY: y + 5,
                    theme: 'striped',
                    headStyles: { fillColor: corPrimaria }
                });
                y = doc.lastAutoTable.finalY + 14;
            }

            const registroPagamentos = window.activeRegistroPagamentos || [];
            if (registroPagamentos.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Registro de Pagamentos (Pago / Não Pago / Faturado)', 14, y, corPrimaria);
                doc.autoTable({
                    head: [['Data do Pagamento', 'Registrado em', 'Tipo', 'Item', 'Valor (R$)', 'Ação']],
                    body: [...registroPagamentos]
                        .sort((a, b) => a.registradoEm.localeCompare(b.registradoEm))
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
                    theme: 'striped',
                    headStyles: { fillColor: corPrimaria },
                    styles: { fontSize: 8 }
                });
                y = doc.lastAutoTable.finalY + 14;
            }

            const extrato = window.activeExtrato || [];
            if (extrato.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                _pdfTituloSecao(doc, 'Extrato Bancário', 14, y, corPrimaria);
                const totalEntradas = extrato.filter(t => t.direcao === 'entrada').reduce((s, t) => s + t.valor, 0);
                const totalSaidas = extrato.filter(t => t.direcao === 'saida').reduce((s, t) => s + t.valor, 0);
                doc.autoTable({
                    body: [
                        ['Total de Entradas', `+ R$ ${totalEntradas.toFixed(2)}`],
                        ['Total de Saídas', `- R$ ${totalSaidas.toFixed(2)}`]
                    ],
                    startY: y + 5,
                    theme: 'plain',
                    styles: { fontStyle: 'bold' },
                    didParseCell: (data) => {
                        if (data.column.index === 1) data.cell.styles.textColor = data.row.index === 0 ? corVerde : corVermelha;
                    }
                });
                doc.autoTable({
                    head: [['Data', 'Descrição', 'Tipo', 'Entrada/Saída', 'Valor (R$)']],
                    body: [...extrato].sort((a, b) => b.data.localeCompare(a.data)).map(t => [
                        formatarData(t.data), t.item, t.tipo, t.direcao === 'entrada' ? 'Entrada' : 'Saída',
                        `${t.direcao === 'entrada' ? '+' : '-'} ${t.valor.toFixed(2)}`
                    ]),
                    startY: doc.lastAutoTable.finalY + 6,
                    theme: 'striped',
                    headStyles: { fillColor: corPrimaria },
                    styles: { fontSize: 8 }
                });
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
                doc.autoTable({
                    head: [['Categoria', 'Valor (R$)']],
                    body: catArray.map(([c, v]) => [c, v.toFixed(2)]),
                    startY: y,
                    theme: 'striped',
                    headStyles: { fillColor: corPrimaria }
                });
                y = doc.lastAutoTable.finalY + 14;
            }

            // Rodapé numerado em todas as páginas, gerado por último (só agora sabemos o total).
            const totalPaginas = doc.internal.getNumberOfPages();
            const alturaPagina = doc.internal.pageSize.getHeight();
            for (let i = 1; i <= totalPaginas; i++) {
                doc.setPage(i);
                doc.setDrawColor(225, 220, 235);
                doc.setLineWidth(0.3);
                doc.line(14, alturaPagina - 14, larguraPagina - 14, alturaPagina - 14);
                doc.setFontSize(8);
                doc.setTextColor(140, 140, 140);
                doc.text('Planner Financeiro', 14, alturaPagina - 9);
                doc.text(`Página ${i} de ${totalPaginas}`, larguraPagina - 14, alturaPagina - 9, { align: 'right' });
            }

            doc.save(`relatorio-${mesAtualKey}.pdf`);
            mostrarToast('Relatório mensal em PDF exportado.', 'success');
        }
