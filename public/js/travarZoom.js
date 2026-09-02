// Trava o zoom de pinça e de duplo-toque no celular. O viewport meta (user-scalable=no,
// maximum-scale=1) sozinho não é mais suficiente — navegadores modernos (Chrome, Firefox, Safari)
// vêm ignorando esse atributo de propósito, por acessibilidade, então o zoom "voltava" mesmo com
// o meta configurado. A forma que continua funcionando de verdade é bloquear o próprio gesto:
// pinça (2+ dedos tocando a tela ao mesmo tempo) e duplo-toque rápido no mesmo lugar.

// Pinça: qualquer touchmove com 2 ou mais dedos na tela é o gesto de pinça — bloqueia o padrão do
// navegador (que faria o zoom), sem interferir no toque normal de 1 dedo (rolar a tela, arrastar).
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// Duplo-toque: se dois toques acontecem rápido demais um atrás do outro (< 350ms), é duplo-toque
// pra zoom — bloqueia. Um toque normal (só um, ou dois toques bem espaçados) passa reto.
let _ultimoToqueEm = 0;
document.addEventListener('touchend', (e) => {
    const agora = Date.now();
    if (agora - _ultimoToqueEm <= 350) e.preventDefault();
    _ultimoToqueEm = agora;
}, { passive: false });

// Safari/iOS dispara os eventos "gesture*" à parte pro gesto de pinça, mesmo com o touchmove já
// bloqueado acima em alguns casos — bloqueia direto na fonte.
document.addEventListener('gesturestart', (e) => e.preventDefault());
