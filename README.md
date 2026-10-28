# Finance Pro

Controle financeiro pessoal e de casal. Site em HTML, CSS e JavaScript puro, sem build e sem
dependências para instalar. Os dados ficam no Supabase.

## Estrutura

- `public/index.html`: a tela inteira do app (marcação e pop-ups).
- `public/css/style.css`: visual (tema claro e escuro, layout para celular).
- `public/js/`: um arquivo por responsabilidade. Ex.: `config.js` (conexão com o banco),
  `fixas.js` (contas fixas e parcelas), `render.js` (recálculo e desenho da tela),
  `contaAdmin.js` (conta administradora).
- `public/sw.js`: service worker (instalação no celular e abertura offline).
- `supabase/migrations/`: histórico das alterações do banco, em ordem numérica. Não edite
  migrations antigas: crie uma nova com o próximo número.

## Como rodar localmente

Na pasta do projeto, rode um servidor simples e abra o endereço no navegador:

    python3 -m http.server 8000 -d public

Depois acesse http://localhost:8000.

## Como publicar

A Vercel publica a branch `main` sozinha. A pasta `public/` é a raiz do site, então não há etapa
de build. Cada alteração entra por um Pull Request.

## Banco de dados

Projeto Supabase `jasrlsyfsbagnkkhifxq`. A URL e a chave pública (que pode ficar no código, pois a
segurança vem das regras de acesso) estão em `public/js/config.js`.
