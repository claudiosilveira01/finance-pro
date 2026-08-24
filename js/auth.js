// Autenticação: login, cadastro, logout e estado do usuário
        auth.onAuthStateChanged(user => {
            const loading = document.getElementById('loadingDiv');
            if(user) {
                currentUser = user;
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                loading.style.display = 'flex';
                
                document.getElementById('fatData').value = new Date().toISOString().split('T')[0];
                atualizarLabelDataFat();
                initChart();
                initChartSobraFalta();
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

        function mostrarErroAuth(msg) {
            const el = document.getElementById('authErro');
            el.innerText = msg;
            el.style.display = 'block';
        }

        function fazerLogin() {
            const email = document.getElementById('emailInput').value;
            const senha = document.getElementById('senhaInput').value;
            if(!email || !senha) return mostrarErroAuth("Preencha e-mail e senha!");
            auth.signInWithEmailAndPassword(email, senha).catch(err => mostrarErroAuth("Erro: E-mail ou senha incorretos."));
        }

        function criarConta() {
            const email = document.getElementById('emailInput').value;
            const senha = document.getElementById('senhaInput').value;
            if(!email || !senha) return mostrarErroAuth("Preencha e-mail e senha para criar conta!");
            if(senha.length < 6) return mostrarErroAuth("A senha deve ter pelo menos 6 caracteres.");
            auth.createUserWithEmailAndPassword(email, senha).catch(err => mostrarErroAuth("Erro ao criar conta: " + err.message));
        }

        function fazerLogout() { auth.signOut(); }

        function recuperarSenha() {
            const email = document.getElementById('emailInput').value.trim();
            if(!email) return mostrarErroAuth('Digite seu e-mail no campo acima para receber o link de recuperação.');

            auth.sendPasswordResetEmail(email)
                .then(() => mostrarToast('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success', 6000))
                .catch(err => mostrarErroAuth('Erro ao enviar e-mail de recuperação: ' + err.message));
        }
