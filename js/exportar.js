// Exportação de dados: CSV manual (com BOM UTF-8) e relatório mensal em PDF via jsPDF + autoTable
        function _csvEscape(valor) {
            const str = String(valor ?? '');
            if(/["\n;]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
            return str;
        }

        function _baixarCSV(nomeArquivo, cabecalho, linhas) {
            const conteudo = [cabecalho, ...linhas].map(l => l.map(_csvEscape).join(';')).join('\r\n');
            const BOM = '﻿'; // garante acentuação correta ao abrir no Excel
            const blob = new Blob([BOM + conteudo], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nomeArquivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportarFixasCSV() {
            const cabecalho = ['Item', 'Categoria', 'Vencimento', 'Valor (R$)', 'Pago', 'Observações'];
            const linhas = (window.activeFixas || []).map(c => [
                c.nome, c.categoria, `Dia ${c.vencimento}`, c.valor.toFixed(2), c.pago ? 'Sim' : 'Não', c.obs || ''
            ]);
            _baixarCSV(`contas-fixas-${mesAtualKey}.csv`, cabecalho, linhas);
            mostrarToast('CSV de contas fixas exportado.', 'success');
        }

        function exportarFaturamentosCSV() {
            const cabecalho = ['Data', 'Origem', 'Valor (R$)'];
            const linhas = (window.activeFaturamentos || []).map(f => [
                formatarData(f.data), f.nome, f.valor.toFixed(2)
            ]);
            _baixarCSV(`faturamentos-${mesAtualKey}.csv`, cabecalho, linhas);
            mostrarToast('CSV de faturamentos exportado.', 'success');
        }

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
        function _pdfInserirGrafico(doc, chart, x, y, larguraMax, alturaMax) {
            const larguraOriginal = chart.width, alturaOriginal = chart.height;
            let largura = larguraMax, altura = larguraMax * (alturaOriginal / larguraOriginal);
            if (altura > alturaMax) { altura = alturaMax; largura = alturaMax * (larguraOriginal / alturaOriginal); }
            doc.addImage(chart.toBase64Image(), 'PNG', x, y, largura, altura);
            return altura;
        }

        // Relatório mensal completo: Receitas, Contas Fixas, Extrato Bancário, Gastos por Categoria
        // (com gráficos) e Resumo Financeiro. Seções sem nenhum dado no mês são puladas inteiras.
        function exportarRelatorioMensalPDF() {
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
                    y += Math.max(alturaPizza, alturaBarra) + 8;
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
