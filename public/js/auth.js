// Autenticação (Supabase Auth): login, recuperação de senha, logout e estado do usuário
        //
        // O onAuthStateChange é registrado só depois que TODOS os scripts carregaram — o
        // supabase-js pode disparar o INITIAL_SESSION quase imediatamente (lê a sessão do
        // localStorage), e o callback usa funções definidas em módulos que vêm depois deste.
        let _graficosIniciados = false;

        function _iniciarAuth() {
        sb.auth.onAuthStateChange((event, session) => {
            const loading = document.getElementById('loadingDiv');
            const user = session ? session.user : null;

            if (user) {
                // onAuthStateChange dispara em vários eventos (INITIAL_SESSION, SIGNED_IN,
                // TOKEN_REFRESHED...). Se já é o mesmo usuário, não faz nada — TOKEN_REFRESHED
                // em segundo plano não deve piscar a tela nem recarregar dados.
                if (currentUser && currentUser.id === user.id) return;
                currentUser = user;

                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                loading.style.display = 'flex';

                document.getElementById('fatData').value = new Date().toISOString().split('T')[0];
                atualizarLabelDataFat();
                // Os gráficos ficam presos ao <canvas> — inicializar de novo (ex.: logout e
                // login sem recarregar a página) faz o Chart.js estourar "Canvas already in use".
                if (!_graficosIniciados) {
                    initChart();
                    initChartSobraFalta();
                    initChartCartaoCategoria();
                    _graficosIniciados = true;
                }
                atualizarBotaoTema();
                carregarConfigGlobal(() => {
                    loading.style.display = 'none';
                    iniciarAnimacoesDeEntrada();
                });
            } else {
                currentUser = null;
                document.getElementById('loginScreen').style.display = 'block';
                document.getElementById('mainApp').style.display = 'none';
            }
        });
        }
        // Scripts no fim do <body> rodam com readyState 'interactive' — ainda falta o
        // DOMContentLoaded (e os módulos carregados depois deste). Só roda na hora se a página
        // já terminou de carregar de vez.
        if (document.readyState === 'complete') {
            _iniciarAuth();
        } else {
            window.addEventListener('DOMContentLoaded', _iniciarAuth);
        }

        function mostrarErroAuth(msg) {
            const el = document.getElementById('authErro');
            el.innerText = msg;
            el.style.display = 'block';
        }

        async function fazerLogin() {
            const email = document.getElementById('emailInput').value.trim();
            const senha = document.getElementById('senhaInput').value;
            if(!email || !senha) return mostrarErroAuth("Preencha e-mail e senha!");

            const { error } = await sb.auth.signInWithPassword({ email, password: senha });
            if (error) mostrarErroAuth("Erro: E-mail ou senha incorretos.");
        }

        // Cadastro fechado: as contas são criadas manualmente no painel do Supabase pelo
        // administrador. O botão "Criar Conta" fica escondido no index.html.
        function criarConta() {
            mostrarErroAuth("Cadastro fechado. Peça ao administrador para criar sua conta.");
        }

        async function fazerLogout() {
            await sb.auth.signOut();
        }

        async function recuperarSenha() {
            const email = document.getElementById('emailInput').value.trim();
            if(!email) return mostrarErroAuth('Digite seu e-mail no campo acima para receber o link de recuperação.');

            const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
            if (error) {
                mostrarErroAuth('Erro ao enviar e-mail de recuperação: ' + error.message);
            } else {
                mostrarToast('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success', 6000);
            }
        }
