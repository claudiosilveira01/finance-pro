// Autenticação (Supabase Auth): login, recuperação de senha, logout e estado do usuário
        //
        // O onAuthStateChange é registrado só depois que TODOS os scripts carregaram — o
        // supabase-js pode disparar o INITIAL_SESSION quase imediatamente (lê a sessão do
        // localStorage), e o callback usa funções definidas em módulos que vêm depois deste.
        let _graficosIniciados = false;

        function _iniciarAuth() {
        sb.auth.onAuthStateChange((event, session) => {
            const user = session ? session.user : null;
            // Token guardado pra gravação keepalive no fechamento da aba (ver _flushKeepAlive
            // em undo.js) — lá não dá pra await sb.auth.getSession().
            window._sbToken = session ? session.access_token : null;

            // IMPORTANTE: não chamar outras funções do supabase-js (ex.: sb.rpc) direto aqui
            // dentro — o callback roda segurando um lock interno do cliente, e a primeira RPC
            // sairia sem o token novo (como anon → 401). setTimeout(0) joga o trabalho pra fora
            // do callback, com a sessão já publicada.
            setTimeout(() => {
                const loading = document.getElementById('loadingDiv');

                if (user) {
                    // Vários eventos (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED...). Se já é o
                    // mesmo usuário, não faz nada — TOKEN_REFRESHED não deve piscar a tela.
                    if (currentUser && currentUser.id === user.id) return;
                    currentUser = user;

                    document.getElementById('loginScreen').style.display = 'none';
                    document.getElementById('mainApp').style.display = 'block';
                    loading.style.display = 'flex';

                    document.getElementById('fatData').value = new Date().toISOString().split('T')[0];
                    atualizarLabelDataFat();
                    // Os gráficos ficam presos ao <canvas> — reinicializar (logout→login sem
                    // recarregar) faz o Chart.js estourar "Canvas already in use".
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
                    loading.style.display = 'none';
                    document.getElementById('loginScreen').style.display = 'block';
                    document.getElementById('mainApp').style.display = 'none';
                }
            }, 0);
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

        // Cadastro fechado: contas são criadas manualmente no painel do Supabase. O botão
        // "Criar Conta" foi removido do index.html na migração — não há função de cadastro.

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
