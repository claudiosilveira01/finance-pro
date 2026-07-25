// Assinaturas informativas (fora do orçamento fixo)
        function deletarAssinatura(id) { assinaturasConfig = assinaturasConfig.filter(s => s.id !== id); salvarConfigGlobal(); calcularEAtualizarVisual(); }

        function addAssinaturaInformativa() { 
            const nome = document.getElementById('subNome').value.trim(); 
            const valor = parseFloat(document.getElementById('subValor').value);
            const venc = parseInt(document.getElementById('subVenc').value); 
            if(!nome || isNaN(venc)) return; 
            assinaturasConfig.push({ id: Date.now(), nome, valor: isNaN(valor) ? 0 : valor, vencimento: venc }); 
            salvarConfigGlobal(); 
            document.getElementById('subNome').value = ''; 
            document.getElementById('subValor').value = ''; 
            document.getElementById('subVenc').value = ''; 
            calcularEAtualizarVisual(); 
        }
