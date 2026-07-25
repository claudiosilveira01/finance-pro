// Tema claro/escuro (persistido em localStorage)
        function checkTheme() {
            if(localStorage.getItem('theme') === 'dark') {
                document.body.classList.add('dark-mode');
            }
        }
        checkTheme();

        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            atualizarBotaoTema();
        }

        function atualizarBotaoTema() {
            const isDark = document.body.classList.contains('dark-mode');
            const icon = document.getElementById('iconTheme');
            const text = document.getElementById('textTheme');
            if(icon && text) {
                icon.innerText = isDark ? 'light_mode' : 'dark_mode';
                text.innerText = isDark ? 'Voltar para Modo Claro' : 'Ativar Modo Escuro';
            }
        }
