# Estado da Migração — Finance PRO

Atualizar ao fim de cada passo. Este arquivo é a fonte de verdade do progresso.

## IDs de referência

- Repo GitHub: `claudiosilveira01/finance-pro`
- Firebase (origem, não apagar): projeto `finance-pro-v1`, `messagingSenderId 866672231232`
- Vercel (origem, não apagar): projeto `finance-pro` (`prj_JVA0S1wTLbrsuH845K2UVOewD3JC`),
  time `claudio26` (`team_qxrfEAM9eH7M36zIwjJVCYPr`)
- Supabase (destino): a preencher no Passo 2 (project ref, URL)
- Cloudflare (destino): conta com subdomínio `pcp-estaleiro`; Worker novo `finance-pro`
  (Worker `solda` existente — não mexer)

## Passo atual

**Passo 1 — Reestruturar o repositório** (em andamento)

## Concluído

- [x] Branch `claude/finance-pro-migration-plan-9ov2gb` confirmada como branch de trabalho.
- [x] Confirmado que os arquivos locais batem 100% com `origin/main` antes de mover.
- [x] Movidos para `public/`: `index.html`, `manifest.json`, `firebase-messaging-sw.js`,
      `css/`, `js/`, `icons/` (via `git mv`, histórico preservado).
- [x] `automacao-email-nubank/` movida para `docs/arquivo/` (não será migrada).
- [x] `firestore.rules` removido (substituído por RLS no Supabase).
- [x] Docs de contexto (`EXPLORACAO_FINANCE_PRO.md`, `PLANO-EVOLUCAO.md`,
      `Planner Financeiro - Contexto Completo.md`) movidos para `docs/`.
- [x] Criados: `wrangler.jsonc`, `.github/workflows/deploy-finance-pro.yml`, `.gitignore`,
      `.gitattributes`, `docs/PRD.md`, `docs/ESTADO-MIGRACAO.md` (este arquivo),
      `docs/AUDITORIA.md`.

## Pendente (Passo 1)

- [ ] `supabase/migrations/0001_init.sql` (será escrito no Passo 2, junto com o schema).
- [ ] `scripts/export-firestore.mjs` (placeholder criado; script real no Passo 4).
- [ ] Checkpoint: `git hash-object` de cada arquivo em `public/` == SHA do blob no GitHub
      (arquivos não foram editados, só movidos — a esperar que bata).
- [ ] Commit + push da branch.

## Próximo comando exato

Após commit/push do Passo 1: iniciar Passo 2 (criar projeto Supabase — confirmar custo com
o usuário antes de `create_project`).

## Pendências do usuário

- Confirmar contagem de docs/coleções no console do Firebase (opcional, não bloqueia).
- Passo 4: gerar a chave de conta de serviço do Firebase (Console → Contas de serviço) e
  rodar o export.
- Passo 4: recriar as contas de usuário no painel do Supabase Auth.
- Passo 5: criar API Token no Cloudflare (Edit Cloudflare Workers) e cadastrar como secret
  `CLOUDFLARE_API_TOKEN` no GitHub.
- Passo 5b: adquirir o domínio próprio quando decidir.
