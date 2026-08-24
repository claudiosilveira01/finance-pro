// Exportação de dados: relatório mensal completo em PDF via jsPDF + autoTable
        // Pula pra próxima página se não sobrar espaço suficiente pro título + início da próxima seção.
        function _pdfGarantirEspaco(doc, y, minimo) {
            const alturaPagina = doc.internal.pageSize.getHeight();
            if (y + minimo > alturaPagina - 14) {
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

        // Relatório mensal completo: Receitas, Contas Fixas, Extrato Bancário, Gastos por Categoria
        // (com gráficos) e Resumo Financeiro. Seções sem nenhum dado no mês são puladas inteiras.
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
            const corCabecalho = [67, 28, 93];

            doc.setFontSize(16);
            doc.text('Relatório Mensal — Planner Financeiro', 14, 18);
            doc.setFontSize(11);
            doc.text(`Mês: ${mesAtualKey}`, 14, 26);

            let y = 34;

            if((window.activeFaturamentos || []).length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                doc.setFontSize(13);
                doc.text('Receitas', 14, y);
                doc.autoTable({
                    head: [['Data', 'Origem', 'Valor (R$)']],
                    body: window.activeFaturamentos.map(f => [formatarData(f.data), f.nome, f.valor.toFixed(2)]),
                    startY: y + 4,
                    theme: 'striped',
                    headStyles: { fillColor: corCabecalho }
                });
                y = doc.lastAutoTable.finalY + 12;
            }

            if((window.activeFixas || []).length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                doc.setFontSize(13);
                doc.text('Contas Fixas', 14, y);
                doc.autoTable({
                    head: [['Item', 'Categoria', 'Venc.', 'Valor (R$)', 'Pago']],
                    body: window.activeFixas.map(c => [c.nome, c.categoria, `Dia ${c.vencimento}`, c.valor.toFixed(2), c.pago ? 'Sim' : 'Não']),
                    startY: y + 4,
                    theme: 'striped',
                    headStyles: { fillColor: corCabecalho }
                });
                y = doc.lastAutoTable.finalY + 12;
            }

            const registroPagamentos = window.activeRegistroPagamentos || [];
            if (registroPagamentos.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                doc.setFontSize(13);
                doc.text('Registro de Pagamentos (Pago / Não Pago / Faturado)', 14, y);
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
                    startY: y + 4,
                    theme: 'striped',
                    headStyles: { fillColor: corCabecalho },
                    styles: { fontSize: 8 }
                });
                y = doc.lastAutoTable.finalY + 12;
            }

            const extrato = window.activeExtrato || [];
            if (extrato.length > 0) {
                y = _pdfGarantirEspaco(doc, y, 30);
                doc.setFontSize(13);
                doc.text('Extrato Bancário', 14, y);
                const totalEntradas = extrato.filter(t => t.direcao === 'entrada').reduce((s, t) => s + t.valor, 0);
                const totalSaidas = extrato.filter(t => t.direcao === 'saida').reduce((s, t) => s + t.valor, 0);
                doc.autoTable({
                    body: [
                        ['Total de Entradas', `+ R$ ${totalEntradas.toFixed(2)}`],
                        ['Total de Saídas', `- R$ ${totalSaidas.toFixed(2)}`]
                    ],
                    startY: y + 4,
                    theme: 'plain',
                    styles: { fontStyle: 'bold' }
                });
                doc.autoTable({
                    head: [['Data', 'Descrição', 'Tipo', 'Entrada/Saída', 'Valor (R$)']],
                    body: [...extrato].sort((a, b) => b.data.localeCompare(a.data)).map(t => [
                        formatarData(t.data), t.item, t.tipo, t.direcao === 'entrada' ? 'Entrada' : 'Saída',
                        `${t.direcao === 'entrada' ? '+' : '-'} ${t.valor.toFixed(2)}`
                    ]),
                    startY: doc.lastAutoTable.finalY + 6,
                    theme: 'striped',
                    headStyles: { fillColor: corCabecalho },
                    styles: { fontSize: 8 }
                });
                y = doc.lastAutoTable.finalY + 12;
            }

            const chartDataArray = window.__ultimoChartDataArray || [];
            if (chartDataArray.some(v => v > 0)) {
                y = _pdfGarantirEspaco(doc, y, 90);
                doc.setFontSize(13);
                doc.text('Gastos por Categoria', 14, y);
                y += 4;

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
                    headStyles: { fillColor: corCabecalho }
                });
                y = doc.lastAutoTable.finalY + 12;
            }

            y = _pdfGarantirEspaco(doc, y, 60);
            doc.setFontSize(13);
            doc.text('Resumo Financeiro', 14, y);
            doc.autoTable({
                body: [
                    ['Orçamento Fixo', document.getElementById('mOrcamento').innerText],
                    ['Restante Contas', document.getElementById('mRestante').innerText],
                    ['Pago', document.getElementById('mPago').innerText],
                    ['Saldo Estimado', document.getElementById('mSaldoEstimado').innerText],
                    ['Falta / Sobra', document.getElementById('mResultado').innerText]
                ],
                startY: y + 4,
                theme: 'plain',
                styles: { fontStyle: 'bold' }
            });

            doc.save(`relatorio-${mesAtualKey}.pdf`);
            mostrarToast('Relatório mensal em PDF exportado.', 'success');
        }
