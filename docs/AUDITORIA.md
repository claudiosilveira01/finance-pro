# Auditoria — Varredura Finance PRO (pré-migração)

## Estado real (varredura inicial)

| Plataforma | Estado real |
|---|---|
| GitHub | `claudiosilveira01/finance-pro`, público, branch `main`, app na raiz (sem monorepo) |
| Código | Vanilla JS, sem build step. `index.html` + `js/` (25 módulos) + `css/` + `icons/` + `manifest.json` + `firebase-messaging-sw.js` + `firestore.rules` |
| Camada de dados | Ponto único: `js/config.js` (`getConfigDocRef`, `getMesesCollectionRef`), Firestore compat SDK v10.12.2 |
| Modelo Firestore | `users/{uid}/config/geral` (categorias, assinaturasConfig, mesesDisponiveis, pushTokens) + `users/{uid}/meses/{anoMes}` (fixas, faturamentos, extrato, saldo) |
| IDs | Client-side `Date.now()` (+ `Math.random()` em cópias), sem lock |
| Realtime/Offline | Nenhum — sem `onSnapshot`, sem `enablePersistence` |
| Auth | Firebase Auth e-mail/senha: login, cadastro, reset, logout |
| Push | Firebase Cloud Messaging, tokens em `config/geral.pushTokens` |
| Firebase | Projeto `finance-pro-v1`. Firestore + Auth + Messaging ativos. Regras: só o próprio usuário |
| Vercel | Projeto `finance-pro` (`prj_JVA0S1wTLbrsuH845K2UVOewD3JC`), time `claudio26`, plano hobby |
| Supabase | Nenhum projeto Finance PRO — criado no Passo 2 |
| Cloudflare | Subdomínio da conta `pcp-estaleiro` (Worker `solda` existente, intocável) |
| Google Drive | `dev-projects` sob sync do Drive Desktop — cuidado com credenciais no disco |

### Automação Nubank
`automacao-email-nubank/Code.gs` (Apps Script) escrevia direto no Firestore via service
account. Usuário confirmou que não usa mais — arquivado em `docs/arquivo/`, não migrado.

### Correção à varredura original — funcionalidades não previstas no PRD

A leitura completa de `js/` durante o Passo 2 encontrou duas áreas de dados reais que a
varredura inicial não tinha mapeado (o PRD original as ignorava). O schema final passou a
cobrir as duas:

1. **Cartões de crédito** (`js/cartoes.js`, `js/cartaoFatura.js`, `js/cartaoImportar.js`,
   `cartoesConfig` em `config-global.js`). Config por usuário: `cartoesConfig` (lista de
   `{id, nome, diaFechamento, diaVencimento}`). Por mês: `cartoesFaturas` — objeto
   `{[cartaoId]: {transacoes: [{id, descricao, valor, data, categoria, origemImportId?}],
   valorConfirmado?, valorEstimado?, _creditosImportados?}}`. Uma fatura de cartão sincroniza
   automaticamente uma conta fixa vinculada (`fixas.origemCartaoId`).
2. **Registro de pagamentos** (`window.activeRegistroPagamentos`, gravado em `js/fixas.js` e
   `js/assinaturas.js`, lido em `js/exportar.js`) — log por mês de toggles de "pago":
   `{id, contaId, nome, valor, marcadoComoPago, tipo ('fixa'|'assinatura'), dataPagamento,
   registradoEm}`.

Também confirmado nesta leitura: **nenhum campo `ordem` existe de fato** nos itens de
`fixas`/`faturamentos`/`extrato` (a ordenação na tela usa os campos `ordFixas`/`ordExtrato`
em memória, não persistidos) — as colunas `ordem int` do desenho inicial do schema foram
removidas por não terem uso. `mesesDisponiveis` (`{key, label}`) também foi confirmado como
totalmente derivável (`label` é gerado a partir do `key` "YYYY-MM" com uma tabela de nomes de
mês fixa) — schema final não guarda essa lista, só os `ano_mes` distintos de `meses`.

## Advisors do Supabase — estado após o Passo 2 (01/09/2026)

- **Security:** 5 WARN, um por RPC (`get_config`, `salvar_config`, `get_mes`, `salvar_mes`,
  `get_meses_disponiveis`) — `authenticated_security_definer_function_executable`.
  **Aceito e intencional:** as RPCs são `SECURITY DEFINER` de propósito (fazem
  `delete`+`insert` da "linha inteira" do mês/config escopando por `auth.uid()` por dentro) e
  o usuário logado precisa poder chamá-las. `anon` **não** pode (revogado). Nenhum outro WARN.
- **Performance:** só INFO `unused_index` (9) — os índices ainda não foram usados porque o
  banco está vazio; deixam de aparecer quando o app começar a consultar. Sem WARN.
- Grants de tabela: `anon`/`authenticated` têm `GRANT ALL` (padrão Supabase); o RLS `own`
  (`user_id = (select auth.uid())`) é a barreira. Tirar `DELETE`/`INSERT`/`UPDATE` diretos do
  cliente (deixar só via RPC) fica no Passo 7.

## Status do endurecimento (Passo 7)

- [ ] Soft delete (`deletado_em`) nas tabelas `fixas`, `faturamentos`, `extrato`.
- [ ] RPCs de exclusão viram `update ... set deletado_em = now()`.
- [ ] Leituras filtram `deletado_em is null`.
- [x] `get_advisors` revisado sem WARN inesperado (só o WARN de SECURITY DEFINER nas RPCs,
      esperado/intencional — ver seção "Advisors do Supabase" acima).
- [ ] Confirmado que o cliente não tem `grant delete` direto nas tabelas (só via RPC).

## Riscos conhecidos

- Colisão histórica de IDs gerados via `Date.now()` na importação — não recuperável
  retroativamente se ocorrer; nenhuma colisão identificada até o momento desta auditoria.
- Janela com dois sistemas vivos (Vercel+Firestore e Workers+Supabase) durante a validação.
- `serviceAccountKey.json` gerado no Passo 4 deve ser apagado do disco assim que o export
  terminar (pasta sob sync do Google Drive Desktop).
