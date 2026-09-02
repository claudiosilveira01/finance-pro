# PRD — Migração Finance PRO: Firebase → Supabase (hospedagem no Vercel)

Ver estado vivo em `docs/ESTADO-MIGRACAO.md` e `docs/AUDITORIA.md`.

## Decisão de arquitetura

- **Alvo: GitHub → Vercel → Supabase.** O app já roda no Vercel (projeto `finance-pro`,
  time `claudio26`); a migração só troca o backend Firebase por Supabase e o Vercel continua
  sendo a hospedagem.
- **Cloudflare Workers foi descartado** (02/09/2026): exigia domínio próprio ou o subdomínio
  `pcp-estaleiro.workers.dev`, que o usuário não quer. Cloudflare fica reservado para outro
  projeto. Artefatos removidos: `wrangler.jsonc`, `.github/workflows/deploy-finance-pro.yml`.
- App vanilla JS servido como estático de `public/` — o Vercel detecta `public/` como raiz
  automaticamente (sem build). `vercel.json` só define `Cache-Control` do `sw.js`/`manifest.json`.
- Auth real (Supabase Auth) substituindo Firebase Auth. Contas **migradas com o hash de senha
  SCRYPT preservado** (GoTrue verifica nativamente via `$fbscrypt$`) — ninguém redefine senha.
  Cadastro público desativado.
- Dados por usuário via RLS (`auth.uid()`), acesso pelas RPCs que espelham o `.set()` de
  documento inteiro do modelo Firestore.
- Sem Realtime, sem fila de sync. Push (FCM) removido.
- Firebase (`finance-pro-v1`) fica **dormente** como rede de segurança por ~2 semanas depois
  do corte; só então apagar projeto + cartão do Google Cloud.
