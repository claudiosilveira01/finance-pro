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

### Passo 3 — reescrever a camada de dados (Firebase → Supabase) — CÓDIGO PRONTO E TESTADO

- Migrations: `0004_rpcs_multimes.sql` (`renomear_categoria`, `repetir_fixa`),
  `0005_drop_cartao_entity_fks.sql` (tira as FKs de `cartao_faturas.cartao_id` e
  `fixas.origem_cartao_id` pra `cartoes` — o cliente grava cartão e fatura em chamadas
  separadas sem ordem garantida; o app sempre tolerou referência órfã).
- `index.html`: 4 `<script>` do Firebase → 1 do `@supabase/supabase-js@2.112.4` (UMD, com SRI).
  Botão "Criar Conta" e a seção de notificações removidos.
- `js/config.js`: cliente Supabase (`sb`) + helper `rpc()` + `_labelMes()`. `mesesDisponiveis`
  não é mais persistido — derivado de `get_meses_disponiveis()`.
- `js/auth.js`: `sb.auth.*` (signInWithPassword / signOut / resetPasswordForEmail /
  onAuthStateChange). Registrado no `DOMContentLoaded` (o INITIAL_SESSION dispara cedo demais).
  Guarda `_graficosIniciados` pra não reinicializar Chart.js no ciclo logout→login.
- `js/config-global.js` / `meses.js` / `categorias.js` / `fixas.js`: todas as leituras/escritas
  passam pelas RPCs. Laços cross-mês (renomear categoria, repetir conta) viraram 1 RPC.
- `js/pwa.js`: FCM removido; registra `sw.js` mínimo (network-first, offline como plano B).
  `firebase-messaging-sw.js` deletado.
- **Testado em `wrangler dev` contra o Supabase real, 0 erro no console:** login / logout /
  logout→login sem recarregar; criar/editar conta fixa; marcar como paga (registro_pagamentos
  + caixa); cadastrar cartão + lançar compra na fatura + conta fixa vinculada sincronizando;
  repetir conta fixa em vários meses (`repetir_fixa`); renomear categoria em todos os meses
  (`renomear_categoria`); copiar contas fixas de outro mês; trocar de mês; exportar PDF; erro
  de rede → toast "Tentar de novo". **Não exercitado no navegador:** importação de fatura
  OFX/CSV (código não toca Firebase, usa `salvarDadosDoMesAtual` — testar com arquivo real).
- Conta de teste no Supabase Auth: `teste@financepro.local` / `Teste12345` — **apagar antes
  do corte** (Passo 6).

## Decisão revista — Auth (01/09/2026)

Antes: "recriar contas do zero, reset de senha no 1º acesso". **Agora: migrar as senhas.**
O Firebase guarda as senhas com `SCRYPT` e o Supabase Auth verifica esse formato nativamente,
então as 3 pessoas que usam o app **continuam com a mesma senha, sem reset**. Ferramenta:
`supabase-community/firebase-to-supabase` (pasta `/auth`) — `firestoreusers2json.js` exporta
os usuários (com hash + salt), `import_users.js` insere em `auth.users` já no formato certo.
Precisa dos *Password hash parameters* do projeto Firebase (Console → Authentication → Users →
menu ⋮ → Password hash parameters: `base64_signer_key`, `base64_salt_separator`, `rounds`,
`mem_cost`). Sai o risco "reset de senha no 1º acesso".

## Pendências do usuário

- Confirmar contagem de docs/coleções no console do Firebase (opcional, não bloqueia).
- Passo 3: nenhuma — a `publishable key` do Supabase é pública e já vai no código.
- Passo 3 (recomendado): no painel Supabase → Authentication, desligar *Allow new users to
  sign up* (cadastro já está escondido no app) e configurar as *Redirect URLs* pro link de
  recuperação de senha.
- Passo 4: gerar a chave do Admin SDK do Firebase (Console → Configurações → Contas de
  serviço → Firebase Admin SDK → Gerar nova chave privada).
- Passo 4: copiar os *Password hash parameters* do Firebase Auth (menu ⋮ na lista de usuários).
- Passo 4: rodar `firestoreusers2json.js` + `import_users.js` (migra as senhas) e depois o
  export/import dos dados do Firestore.
- Passo 5: criar API Token no Cloudflare (Edit Cloudflare Workers) e cadastrar como secret
  `CLOUDFLARE_API_TOKEN` no GitHub.
- Passo 5b: adquirir o domínio próprio quando decidir.
