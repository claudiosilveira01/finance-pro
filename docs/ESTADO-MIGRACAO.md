# Estado da Migração — Finance PRO

Atualizar ao fim de cada passo. Este arquivo é a fonte de verdade do progresso.

## Alvo (revisto 02/09/2026): GitHub → **Vercel** → Supabase

Cloudflare Workers foi **descartado** (não quer domínio próprio nem o subdomínio
`pcp-estaleiro`). O app continua no Vercel; a migração só troca Firebase por Supabase.
`wrangler.jsonc` e o workflow de deploy do Cloudflare foram removidos do repo.

## IDs de referência

- Repo GitHub: `claudiosilveira01/finance-pro` (Vercel deploya `main` → produção)
- Firebase (origem, manter dormente ~2 semanas): projeto `finance-pro-v1`
- Vercel (hospedagem): projeto `finance-pro` (`prj_JVA0S1wTLbrsuH845K2UVOewD3JC`),
  time `claudio26` (`team_qxrfEAM9eH7M36zIwjJVCYPr`), produção `finance-pro-cyan.vercel.app`.
  Serve `public/` automaticamente (sem build). Vercel Authentication ligada só em previews.
- Supabase (destino): projeto `finance-pro`, ref `jasrlsyfsbagnkkhifxq`,
  URL `https://jasrlsyfsbagnkkhifxq.supabase.co`, região `sa-east-1`, custo R$0/mês

## Passo atual

**CORTE FEITO (02/09/2026) — produção rodando no Supabase.**
PR #53 mesclada na `main` (merge `ad75aeb`). Vercel publica `main` em `finance-pro-cyan.vercel.app`.

Depois do corte (tudo commitado direto na `main`):
- `78f197b` — hotfix: adiar o pós-login pra fora do callback do `onAuthStateChange` (a 1ª RPC
  saía como anon → 401 + toast de erro no login). Validado em produção.
- Supabase Auth → URL Configuration: Site URL = `https://finance-pro-cyan.vercel.app`,
  redirect URLs `finance-pro-cyan.vercel.app/**` adicionada. "Esqueci minha senha" agora
  volta pra URL certa. (A integração Supabase↔Vercel já tinha posto `finance-pro-claudio26`.)
- Campo obsoleto `diarios` **apagado do Firestore** (`scripts/delete-diarios.mjs`, 374 itens,
  5 docs do claudio). Backup `diarios-backup.json` também apagado. Decisão do usuário.
- **Arquivos sensíveis apagados do disco** (Passo 8 antecipado): `firebase-service.json`,
  `firebase-hash-config.json`, `firebase-users.json`, `firestore-export.json`,
  `firebase-users-map.json`, `diarios-backup.json`, `out/`, `node_modules/`, `.wrangler/`.
  Restam só `scripts/*.mjs` (sem segredos, só referenciam nomes de campo) e `package.json`.
- `6788d6f` — UX: overlay "Sincronizando" full-screen virou um chip pequeno no topo.

Firebase (`finance-pro-v1`) intacto como rede de segurança (só o campo `diarios` foi removido).

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

### Passo 4 — Auth + histórico do Firestore (02/09/2026) — QUASE CONCLUÍDO

**Auth (senhas preservadas, sem reset):** a ferramenta oficial `firebase-to-supabase` só faz
password via middleware WIP — NÃO serve. Mas o GoTrue (Supabase Auth) **verifica hash
Firebase SCRYPT nativamente** (`internal/crypto/password.go`, prefixo `$fbscrypt$`). Formato:
`$fbscrypt$v=1,n=<mem_cost>,r=<rounds>,p=1,ss=<salt_sep_b64>,sk=<signer_key_b64>$<salt_b64>$<hash_b64>`
— salt/hash do Firebase vêm em base64url, convertidos pra base64 padrão. Validado com o vetor
de teste oficial do GoTrue (login OK). Scripts próprios (não a ferramenta): `scripts/export-firebase.mjs`,
`scripts/build-import.mjs`, `scripts/run-import.mjs`.

- **4 contas** migradas pro Supabase Auth com senha preservada + `auth.identities` (provider
  email): `carlaalinny36@gmail.com`, `familia@email.com`, `patricia@email.com`,
  `claudio@financas.com`. UID Supabase = uuid v4 determinístico do firebase uid (mapa em
  `firebase-users-map.json`).
- **Dados importados** via as RPCs `salvar_config`/`salvar_mes` (impersonando cada usuário) —
  reaproveita todo o transform testado. Conferência **campo a campo bateu 100%**:
  | usuário | meses | fixas | fat | extrato | reg | Σ extrato | Σ fixas |
  |---|--:|--:|--:|--:|--:|--:|--:|
  | carlaalinny36 | 5 | 30 | 6 | 0 | 8 | 0 | 5192,21 |
  | familia | 2 | 7 | 5 | 0 | 0 | 0 | 7388,95 |
  | patricia | 1 | 1 | 0 | 0 | 0 | 0 | 1808,11 |
  | claudio | 18 | 52 | 4 | 1156 | 40 | 115270,43 | 14899,98 |
  Somas conferem ao centavo com o `firestore-export.json`. `get_meses_disponiveis` e `get_mes`
  devolvem tudo certo (spot-check em 2026-08/09/11 do claudio).
- **`criado_em`** das linhas de `meses` = 1º dia do `ano_mes` (`finalize.sql`).
- **8 colisões de `id` em extrato** (mesmo id em transações idênticas) → ids de extrato
  regerados no import (`9_000_000_000_000+`; nada referencia `extrato.id`).
- **`diarios`** (feature legada, 374 lançamentos, só claudio, jan–mai) → `diarios-backup.json`,
  **não importado**. Aguardando decisão do usuário.
- **`extrato.idOrigem`** (chave de dedupe da importação de extrato por e-mail) → descartado
  (não está no schema; já era perdido no roundtrip do `salvar_mes` na arquitetura nova).
- Usuário órfão no Firestore `oXZZiFvPFKNE8Q5ApvIMLfiqt8B3` (config, 0 meses, sem conta Auth)
  → ignorado.
- `get_advisors` security: os 7 WARN esperados + `auth_leaked_password_protection`
  (feature Pro, projeto é free — aceito).

**Falta no Passo 4:** confirmar que um usuário real consegue logar com a senha dele (formato
validado com vetor de teste; falta o teste com senha real). Firestore/Firebase **não** é
apagado — rede de segurança até o corte.

## Corte para produção (Vercel) — CONCLUÍDO

1. ✅ Limpar dados de teste do Supabase (só os 4 usuários reais: 26 meses, 90 fixas, 1156 extrato).
2. ✅ Remover Cloudflare (`wrangler.jsonc`, workflow), adicionar `vercel.json` + `.vercelignore`.
3. ✅ Mesclar a PR #53 na `main` (merge `ad75aeb`). Vercel publicou.
4. ✅ Hotfix do 401 no login (`78f197b`) — validado em produção, 0 erro.
5. ⏳ Firebase (`finance-pro-v1`) fica **dormente** (Spark/grátis) ~2 semanas. Depois: apagar
   projeto Firebase + faturamento/cartão no Google Cloud.

### Integração Supabase↔Vercel (o usuário instalou em 02/09)

Adicionou 12 env vars no projeto Vercel (`POSTGRES_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_*` etc.). **O app não usa nenhuma** — é estático, sem build; a URL e a
publishable key estão hardcoded em `public/js/config.js` (padrão correto pra SPA). As env vars
ficam dormentes. Único ponto de atenção: `SUPABASE_SECRET_KEY` fica guardada no Vercel sem uso
— sem exposição (nenhum código lê), mas é superfície extra. Manter ou desinstalar, tanto faz.

## Auditoria de código (02/09/2026) — CONCLUÍDA

Varredura completa em `docs/AUDITORIA-CODIGO.md`. Aplicadas **todas** as correções (bug,
código morto, XSS, inconsistência, schema, acessibilidade) **exceto o zoom de pinça** (`travarZoom.js`
fica como está, por decisão do usuário). Destaques:

- **A2 (schema):** migração `0006_pk_por_escopo.sql` — PK composta por escopo, fim da colisão
  silenciosa de `id`.
- **A1 (dado perdido ao fechar aba):** gravação keepalive direta nas RPCs no `pagehide`.
- **M1 (XSS):** helper `_esc()` em toda renderização de string do usuário.
- **M2/M3/M4, B3–B13, U6–U9:** ver tabela de status no relatório.
- **U4** (fila offline completa) e **U9 iOS splash** ficam fora de escopo — anotados.

## Fases 1–3 (02/09/2026)

### Fase 1 — import de cartão (.ofx/.csv): VERIFICADA ✅
Pipeline funciona contra o Supabase (dados reais: 29 transações importadas via CSV com
`origem_import_id`). Parsers OFX/CSV, dedup por chave e roundtrip `get_mes`/`salvar_mes`
testados. Achados corrigidos:
- Fatura-fantasma de 2026-09 (resíduo do bug M2) — removida do banco.
- `cartaoImportar.js`: `valorConfirmado <= 0` vira `null` (gravar 0 zerava a fatura).
- `_totalFatura`: só usa `valorConfirmado` se `> 0` — o agosto do claudio tinha
  `valorConfirmado = 0` com R$ 469,41 em compras, mostrando R$ 0. **Ao reabrir agosto no app,
  a conta fixa vinculada vai sincronizar pra R$ 469,41** (o Caixa/orçamento daquele mês muda).

### Fase 2 — import de extrato por e-mail: RECONSTRUÍDA ✅ (falta o usuário reimplantar)
- Migração `0007`: coluna `extrato.origem_import_id` + `get_mes`/`salvar_mes` fazem o roundtrip
  de `origemImportId` (testado).
- Migração `0008`: RPC `importar_extrato_email(p_user_id, p_transacoes)` — só `service_role`,
  merge incremental por `origem_import_id`, sem delete. Testada (dedup ok).
- `scripts/apps-script/Code.gs` + `SETUP.md` reescritos: Gmail/parse iguais, escrita Firestore →
  `POST /rest/v1/rpc/importar_extrato_email`. Push saiu daqui (virou Edge Function).
- `verificacaoEmail.js`: no sucesso, atualiza `mesesDisponiveis`.
- **Pendência do usuário:** reimplantar o Apps Script (ver `scripts/apps-script/SETUP.md`,
  seção "Migração da versão antiga"): trocar as Script Properties `FIRESTORE_*` pelas 3
  `SUPABASE_*`, colar o `Code.gs` novo, Deploy → Nova versão. A URL do Web App continua a mesma.

### Fase 3 — notificações de vencimento (Web Push nativo): CONSTRUÍDA ✅ (falta o usuário setar 4 secrets)
- Migração `0009`: tabelas `push_subscriptions` / `avisos_enviados` + RPCs
  `salvar_push_subscription` / `remover_push_subscription`.
- Migração `0010`: `pg_cron` + `pg_net` + agendamento `avisos-vencimento-diario` (`0 12 * * *`),
  lê o segredo do Vault (`cron_secret_avisos`, já criado).
- Edge Function `avisos-vencimento` (deployada, v2, `verify_jwt=false`, auth por `x-cron-secret`):
  porta a lógica do antigo `verificarVencimentosEEnviarPush` (3 dias antes / no dia),
  `npm:web-push`, remove subscription morta (404/410), poda `avisos_enviados` > 60 dias.
- Front: `pwa.js` reescrito (Web Push subscribe/unsubscribe + RPCs + deviceId), `sw.js` com
  listeners `push`/`notificationclick`, seção "Notificações de Vencimento" de volta no
  `index.html`, `config-global.js` chama `verificarNotificacoesAtivas()` no login.
- Par VAPID gerado. **Pública** já no `pwa.js`:
  `BEfBKjRCJuagF6uQjzE5UnK1Cha30uenNJrz0jWlq292VOLIILYWfBEa1hrUAJWOdB7Gmmzz_WJOpumN6wOXp0Q`.
- **Pendência do usuário:** setar 4 secrets na Edge Function (Supabase → Edge Functions →
  avisos-vencimento → Secrets, ou `supabase secrets set`):
  - `VAPID_PUBLIC_KEY` = a pública acima
  - `VAPID_PRIVATE_KEY` = a privada (Claude passou no chat; pode rotacionar com
    `npx web-push generate-vapid-keys` + atualizar os 2 lados)
  - `VAPID_SUBJECT` = `mailto:<seu-email>`
  - `CRON_SECRET` = o mesmo valor do Vault `cron_secret_avisos` (Claude passou no chat)
- **iPhone:** só funciona com o app instalado na tela inicial (mesma limitação do Firebase).

## Pendências / decisões do usuário

- **Testar login com a senha real** (ex.: claudio). O formato `$fbscrypt$` foi validado com o
  vetor de teste oficial do GoTrue; falta só um usuário real confirmar. Se falhar, reconferir
  a `signer_key`.
- **Autorizar o merge da PR #53 na `main`** (é o corte — produção passa a usar Supabase).
- (Recomendado) Supabase → Authentication: desligar *Allow new users to sign up* e configurar
  as *Redirect URLs* (`https://finance-pro-cyan.vercel.app` + o domínio de produção que os
  usuários usam) pro link de "Esqueci minha senha".
- (Decisão) Quer os 374 lançamentos antigos de `diarios` de volta? Hoje: `diarios-backup.json`,
  não importados.
- Passo 8: apagar do disco `firebase-service.json`, `firebase-hash-config.json`,
  `firebase-users.json`, `firestore-export.json`, `firebase-users-map.json`, `node_modules/`
  (pasta sob Google Drive).
