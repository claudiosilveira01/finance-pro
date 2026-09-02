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

**Passo 2 — Supabase** (pausado a pedido do usuário, ~90% concluído)

## Concluído

### Passo 1 — Reestruturar o repositório (concluído)
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
- [x] Checkpoint de hash confirmado, commit + push feitos.
- [x] PR aberta: https://github.com/claudiosilveira01/finance-pro/pull/53 (draft, `mergeable_state: clean`, subscrita para acompanhamento automático de CI/comentários).

### Passo 2 — Supabase (em andamento)
- [x] Projeto criado: `finance-pro` (ref `jasrlsyfsbagnkkhifxq`), região `sa-east-1`, custo R$0/mês.
- [x] Leitura completa de `js/cartoes.js`, `js/cartaoFatura.js`, `js/cartaoImportar.js`,
      `js/meses.js`, `js/config-global.js`, `js/assinaturas.js`, `js/fixas.js`,
      `js/faturamentos.js`, `js/extrato.js` — confirmado o shape real de todos os dados
      (documentado em `docs/AUDITORIA.md`, seção "Correção à varredura original").
  Achado importante: duas áreas de dados reais fora do PRD original — Cartões de Crédito
  (cadastro + fatura + importação OFX/CSV) e Registro de Pagamentos (log de toggles "pago").
- [x] Schema completo escrito e aplicado (`supabase/migrations/0001_init.sql`): 10 tabelas
      (`config`, `assinaturas`, `cartoes`, `meses`, `fixas`, `faturamentos`, `extrato`,
      `registro_pagamentos`, `cartao_faturas`, `cartao_transacoes`), todas com RLS.
- [x] RPCs criadas: `get_config`/`salvar_config`, `get_mes`/`salvar_mes`, `get_meses_disponiveis`.
- [x] Correção de segurança: revogado `EXECUTE` de `anon` em todas as RPCs (Supabase concede
      por padrão na criação) e travada a função de trigger `set_atualizado_em` pra não ser
      chamável via API por ninguém. Aplicada ao vivo no banco e refletida no arquivo.

## Pendente (Passo 2, antes de fechar)

- [ ] Rodar `get_advisors` (security) de novo pra confirmar 0 WARN restante (só o WARN
      esperado de SECURITY DEFINER nas RPCs, que é intencional).
- [ ] Teste de CRUD/cascade/trigger com 1 usuário de teste, depois limpar.
- [ ] Commit + push do schema final e da auditoria atualizada.

## Próximo comando exato (quando retomar)

Rodar `get_advisors` no projeto `jasrlsyfsbagnkkhifxq`, criar um usuário de teste via
Supabase Auth, testar `salvar_config`/`get_config`/`salvar_mes`/`get_mes` fim a fim, checar
cascade no delete, depois `execute_sql` pra limpar os dados de teste — só então commitar e
seguir para o Passo 3 (reescrever `js/config.js` e os módulos que usam Firebase).

## Pendências do usuário

- Confirmar contagem de docs/coleções no console do Firebase (opcional, não bloqueia).
- Passo 4: gerar a chave de conta de serviço do Firebase (Console → Contas de serviço) e
  rodar o export.
- Passo 4: recriar as contas de usuário no painel do Supabase Auth.
- Passo 5: criar API Token no Cloudflare (Edit Cloudflare Workers) e cadastrar como secret
  `CLOUDFLARE_API_TOKEN` no GitHub.
- Passo 5b: adquirir o domínio próprio quando decidir.
