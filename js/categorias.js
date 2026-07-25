// Categorias de contas fixas (ícones e lista)
        function obterIconeCategoria(cat) {
            const iconesBase = {
                "Alimentação": "restaurant",
                "Transporte": "directions_car",
                "Lazer": "sports_esports",
                "Educação": "school",
                "Assinaturas": "subscriptions",
                "Saúde": "health_and_safety",
                "Comunicação": "wifi",
                "Tributos": "account_balance",
                "PIX Terceiros": "send",
                "Outros": "more_horiz"
            };
            return iconesBase[cat] || "label";
        }

        function addCategoriaGlobal() { const nome = document.getElementById('novaCatNome').value.trim(); if(!nome || categoriasAtuais.includes(nome)) return; categoriasAtuais.push(nome); salvarConfigGlobal(); document.getElementById('novaCatNome').value = ''; renderizarListasDeCategorias(); calcularEAtualizarVisual(); }

        function renderizarListasDeCategorias() {
            const selFixas = document.getElementById('fixaCategoria'); 
            const boxConfig = document.getElementById('listaCategoriasConfig');
            
            selFixas.innerHTML = ''; boxConfig.innerHTML = '';
            categoriasAtuais.forEach(cat => { 
                selFixas.innerHTML += `<option value="${cat}">${cat}</option>`; 
                boxConfig.innerHTML += `<span style="background:var(--border-color); color:var(--text-main); padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600;">${cat}</span>`; 
            });
            if(meuGraficoPizza) meuGraficoPizza.data.labels = categoriasAtuais;
            if(meuGraficoBarra) meuGraficoBarra.data.labels = categoriasAtuais;
        }
