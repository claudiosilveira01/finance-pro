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

## Status do endurecimento (Passo 7)

- [ ] Soft delete (`deletado_em`) nas tabelas `fixas`, `faturamentos`, `extrato`.
- [ ] RPCs de exclusão viram `update ... set deletado_em = now()`.
- [ ] Leituras filtram `deletado_em is null`.
- [ ] `get_advisors` revisado sem WARN inesperado (WARN de SECURITY DEFINER nas RPCs é
      esperado/intencional).
- [ ] Confirmado que o cliente não tem `grant delete` direto nas tabelas (só via RPC).

## Riscos conhecidos

- Colisão histórica de IDs gerados via `Date.now()` na importação — não recuperável
  retroativamente se ocorrer; nenhuma colisão identificada até o momento desta auditoria.
- Janela com dois sistemas vivos (Vercel+Firestore e Workers+Supabase) durante a validação.
- `serviceAccountKey.json` gerado no Passo 4 deve ser apagado do disco assim que o export
  terminar (pasta sob sync do Google Drive Desktop).
