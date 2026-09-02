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

        window.addEventListener('beforeunload', flushPendingDelete);
