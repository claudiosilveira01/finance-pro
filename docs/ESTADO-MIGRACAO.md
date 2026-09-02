# Estado da Migração — Finance PRO

Atualizar ao fim de cada passo. Este arquivo é a fonte de verdade do progresso.

## IDs de referência

- Repo GitHub: `claudiosilveira01/finance-pro`
- Firebase (origem, não apagar): projeto `finance-pro-v1`, `messagingSenderId 866672231232`
- Vercel (origem, não apagar): projeto `finance-pro` (`prj_JVA0S1wTLbrsuH845K2UVOewD3JC`),
  time `claudio26` (`team_qxrfEAM9eH7M36zIwjJVCYPr`)
- Supabase (destino): projeto `finance-pro`, ref `jasrlsyfsbagnkkhifxq`,
  URL `https://jasrlsyfsbagnkkhifxq.supabase.co`, região `sa-east-1`, custo R$0/mês
- Cloudflare (destino): conta com subdomínio `pcp-estaleiro`; Worker novo `finance-pro`
  (Worker `solda` existente — não mexer)

## Passo atual

**Passo 2 — Supabase** (concluído em 01/09/2026) → seguindo para o **Passo 3**

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
- [x] RPCs criadas: `get_config`/`salvar_config`, `get_mes`/`salvar_mes`, `get_meses_disponiveis`
      (todas `security definer set search_path = ''`).
- [x] Correção de segurança: revogado `EXECUTE` de `anon` em todas as RPCs (Supabase concede
      por padrão na criação). Migration `0001b_lock_down_rpc_grants` (aplicada no banco;
      conteúdo já embutido no `0001_init.sql` versionado — a linha extra no histórico do
      banco é só registro, sem ação de código).
- [x] `0002_fix_trigger_grant.sql`: `set_atualizado_em()` virou `SECURITY INVOKER` +
      `revoke execute ... from public`. O `revoke ... from anon` do `0001_init.sql` não fazia
      efeito — o `EXECUTE` vinha via `PUBLIC`. Advisor `anon_security_definer_function` sumiu.
- [x] `0003_perf_rls_initplan.sql`: policies `own` reescritas com `(select auth.uid())`
      (advisor `auth_rls_initplan`, todas as 10 tabelas) + índices em `cartao_faturas.cartao_id`
      e `fixas.origem_cartao_id` (advisor `unindexed_foreign_keys`).
- [x] `get_advisors` security: sobram só **5 WARN**, um por RPC
      (`authenticated_security_definer_function_executable`) — **esperado e intencional**
      (usuário logado precisa chamar as RPCs). `get_advisors` performance: só INFO
      `unused_index` (banco vazio, sem queries ainda).
- [x] Teste fim a fim via `execute_sql` com 2 usuários de teste (criados/removidos direto em
      `auth.users`):
  - RPC round-trip `salvar_config`/`get_config`/`salvar_mes`/`get_mes`/`get_meses_disponiveis`
    com mapeamento camelCase↔snake_case OK (incl. `cartoesFaturas` aninhado e `registroPagamentos`);
  - trigger `atualizado_em` avança no `update`;
  - cascade `delete meses` → zera as 6 tabelas-filhas daquele mês;
  - cascade `delete cartoes` → `cartao_faturas`/`cartao_transacoes` somem e
    `fixas.origem_cartao_id` vira NULL;
  - RLS: usuário B não enxerga nenhuma linha do usuário A (nem via `select` direto filtrando
    pelo `user_id` do A).
  - Dados de teste limpos — banco vazio confirmado.

## Próximo passo

**Passo 3 — reescrever a camada de dados** (Firebase → Supabase). Ver plano em
`~/.claude/plans/migra-o-finance-pro-quiet-whistle.md`. Próxima migration a criar:
`0004_rpcs_multimes.sql` (`renomear_categoria`, `excluir_categoria`, `repetir_fixa`).

## Pendências do usuário

- Confirmar contagem de docs/coleções no console do Firebase (opcional, não bloqueia).
- Passo 3: nenhuma — a `anon key` do Supabase é pública e já vai no código.
- Passo 3 (opcional, recomendado): no painel Supabase → Authentication, desligar
  *Allow new users to sign up* e configurar as *Redirect URLs* pro reset de senha.
- Passo 4: gerar a chave de conta de serviço do Firebase (Console → Contas de serviço) e
  rodar o export.
- Passo 4: recriar as contas de usuário no painel do Supabase Auth.
- Passo 5: criar API Token no Cloudflare (Edit Cloudflare Workers) e cadastrar como secret
  `CLOUDFLARE_API_TOKEN` no GitHub.
- Passo 5b: adquirir o domínio próprio quando decidir.
