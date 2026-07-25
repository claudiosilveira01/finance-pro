// Faturamentos/receitas do mês
        function addFaturamento() {
            const nome = document.getElementById('fatNome').value.trim(); 
            const valor = parseFloat(document.getElementById('fatValor').value); 
            let data = document.getElementById('fatData').value;
            if(!nome || isNaN(valor)) return;
            if(!data) data = new Date().toISOString().split('T')[0];
            if(!window.activeFaturamentos) window.activeFaturamentos = [];
            
            window.activeFaturamentos.push({ id: Date.now(), nome, valor, data: data });
            document.getElementById('fatNome').value = ''; document.getElementById('fatValor').value = '';
            salvarDadosDoMesAtual(); calcularEAtualizarVisual();
        }
