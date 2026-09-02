// Exclusão otimista com "Desfazer": remove da UI na hora, só persiste no banco
        // se a janela de undo expirar sem o usuário desfazer.
        let _pendingDelete = null;

        function excluirComUndo({ mensagem = 'Item excluído.', restaurar, persistir, duracao = 5000 }) {
            flushPendingDelete();

            let desfeito = false;
            const timer = setTimeout(() => {
                _pendingDelete = null;
                persistir();
            }, duracao);

            _pendingDelete = { persistir: () => { clearTimeout(timer); persistir(); } };

            mostrarToast(mensagem, 'info', duracao, {
                acao: {
                    texto: 'Desfazer',
                    callback: () => {
                        if(desfeito) return;
                        desfeito = true;
                        clearTimeout(timer);
                        _pendingDelete = null;
                        restaurar();
                    }
                }
            });
        }

        // Força a persistência de uma exclusão pendente (troca de mês, fechar a aba, etc.)
        function flushPendingDelete() {
            if(_pendingDelete) {
                const pendente = _pendingDelete;
                _pendingDelete = null;
                pendente.persistir();
            }
        }

        // Gravação keepalive direta nas RPCs — sobrevive ao fechamento da aba (o fetch normal do
        // supabase-js, e qualquer .then, são cortados). Usada quando a aba some com uma exclusão
        // pendente ou um save ainda em voo (A1 / U4 da auditoria). Best-effort, sem tratar retorno.
        function _flushKeepAlive() {
            if (!currentUser || !window._sbToken) return;
            const headers = {
                'Content-Type': 'application/json',
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${window._sbToken}`
            };
            const saldoEl = document.getElementById('saldoInput');
            try {
                fetch(`${SUPABASE_URL}/rest/v1/rpc/salvar_mes`, {
                    method: 'POST', keepalive: true, headers,
                    body: JSON.stringify({ p_ano_mes: mesAtualKey, p_dados: {
                        fixas: window.activeFixas || [],
                        faturamentos: window.activeFaturamentos || [],
                        extrato: window.activeExtrato || [],
                        registroPagamentos: window.activeRegistroPagamentos || [],
                        cartoesFaturas: window.activeCartoesFaturas || {},
                        saldo: _arred2(_parseDinheiro(saldoEl ? saldoEl.value : '') || 0)
                    } })
                });
                fetch(`${SUPABASE_URL}/rest/v1/rpc/salvar_config`, {
                    method: 'POST', keepalive: true, headers,
                    body: JSON.stringify({ p: {
                        categorias: categoriasAtuais,
                        assinaturas: assinaturasConfig,
                        cartoesConfig: cartoesConfig,
                        ocultarCardAcumulado: ocultarCardAcumulado,
                        ocultarCardCartoes: ocultarCardCartoes
                    } })
                });
            } catch (e) { /* aba fechando — nada a fazer */ }
        }

        // beforeunload (desktop) + pagehide (mobile, aba "congelada"): se havia exclusão pendente
        // ou save em voo, além do persistir normal (async, pode não completar) dispara a gravação
        // keepalive. _saidaTratada evita rodar duas vezes quando os dois eventos disparam.
        let _saidaTratada = false;
        function _aoSairDaPagina() {
            if (_saidaTratada) return;
            _saidaTratada = true;
            const tinhaAlgoPendente = !!_pendingDelete || !!window._saveEmVoo;
            flushPendingDelete();
            if (tinhaAlgoPendente) _flushKeepAlive();
        }
        window.addEventListener('beforeunload', _aoSairDaPagina);
        window.addEventListener('pagehide', _aoSairDaPagina);
        // Se a aba volta do bfcache, libera pra tratar a próxima saída.
        window.addEventListener('pageshow', () => { _saidaTratada = false; });
