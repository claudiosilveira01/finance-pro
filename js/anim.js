// Animações de entrada: cards sobem suavemente ao logar e conforme aparecem na tela
(function () {
    let observer = null;

    function iniciarAnimacoesDeEntrada() {
        const cards = document.querySelectorAll('#mainApp .card');
        if (!cards.length) return;

        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entradas) => {
            entradas.forEach(entrada => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add('reveal-in');
                    observer.unobserve(entrada.target);
                }
            });
        }, { threshold: 0.15 });

        cards.forEach((card, i) => {
            card.classList.add('reveal-init');
            card.style.animationDelay = `${Math.min(i * 0.06, 0.4)}s`;
            observer.observe(card);
        });
    }

    window.iniciarAnimacoesDeEntrada = iniciarAnimacoesDeEntrada;
})();
