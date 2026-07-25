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
                doc.setFontSize(13);
                doc.text('Faturamentos / Receitas', 14, y);
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

            doc.setFontSize(13);
            doc.text('Resumo', 14, y);
            doc.autoTable({
                body: [
                    ['Saldo Estimado', document.getElementById('mSaldoEstimado').innerText],
                    ['Orçamento Fixo', document.getElementById('mOrcamento').innerText],
                    ['Pago', document.getElementById('mPago').innerText],
                    ['Restante Contas', document.getElementById('mRestante').innerText],
                    ['Falta / Sobra', document.getElementById('mResultado').innerText]
                ],
                startY: y + 4,
                theme: 'plain',
                styles: { fontStyle: 'bold' }
            });

            doc.save(`relatorio-${mesAtualKey}.pdf`);
            mostrarToast('Relatório mensal em PDF exportado.', 'success');
        }
