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
