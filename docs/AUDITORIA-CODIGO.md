# Auditoria de código — Finance PRO (pós-migração)

Varredura completa do front (`public/`) + back (`supabase/migrations/`) em 02/09/2026, depois
da migração Firebase → Supabase. App: PWA vanilla JS, sem build, ~4000 linhas de JS + 678 de
HTML + 498 de CSS, backend Supabase (10 tabelas, 7 RPCs).

**Legenda de "aplicar":** 🟢 seguro (aplico direto) · 🟡 precisa sua aprovação (mexe em cálculo
de valor / fluxo de dados / comportamento visível).

---

## 🔴 Severidade ALTA

### A1 — Exclusão com "Desfazer" é perdida ao fechar a aba 🟡
`public/js/undo.js:39` — `window.addEventListener('beforeunload', flushPendingDelete)`.
`flushPendingDelete` chama `persistir()` → `salvarDadosDoMesAtual()`, que **agora é uma RPC
assíncrona** (`sb.rpc`). O `beforeunload` não espera `fetch` assíncrono → a gravação da
exclusão **não completa**. Antes da migração o SDK do Firestore enfileirava a escrita offline
e sincronizava depois; agora não há nada disso.

**Cenário:** você exclui uma conta fixa / receita / compra de cartão e fecha a aba dentro da
janela de 5s do "Desfazer" → no próximo login o item **volta**.

**Opções de correção:** (a) `navigator.sendBeacon` no `beforeunload` batendo direto na REST do
Supabase; (b) matar o "otimista": grava a exclusão na hora e o "Desfazer" faz re-inserção;
(c) reduzir a janela pra ~2s (mitiga, não resolve).

### A2 — PK global das tabelas → colisão de `id` faz a gravação falhar em silêncio 🟡
Todas as tabelas usam `id bigint primary key` **global** (não escopado por usuário/mês):
`fixas`, `faturamentos`, `extrato`, `registro_pagamentos`, `cartao_transacoes`, `assinaturas`,
`cartoes`. Os `id` são **gerados no cliente**: `Date.now()` (maioria), `Date.now() + random`
(alguns), hash do conteúdo (`extrato.js` `_extratoStrHash`).

`salvar_mes` / `salvar_config` fazem `delete ... where user_id [and ano_mes]` e **re-inserem
com o `id` que veio do cliente**. Se dois usuários (ou, nas tabelas-filhas, dois meses do mesmo
usuário) tiverem o mesmo `id` → o `INSERT` estoura violação de PK → a RPC falha → o app mostra
"Erro ao salvar, tentar de novo" e **o dado só existe em memória**.

Probabilidade real hoje: baixa (4 usuários, `Date.now()` em ms; a migração regerou os `id` de
extrato que já colidiam). Mas é uma bomba-relógio e a causa-raiz de bugs difíceis de reproduzir.

**Correção recomendada:** PK composta — `(user_id, ano_mes, id)` nas tabelas-filhas,
`(user_id, id)` em `assinaturas`/`cartoes`. As RPCs **não mudam** (já filtram por
`(user_id, ano_mes)`). Verificar `0 duplicata` da nova PK antes de aplicar (o PK antigo era
mais restritivo, então não pode haver). Migração `0006_pk_por_escopo.sql`.

---

## 🟠 Severidade MÉDIA

### M1 — Injeção de HTML sistêmica (nomes de categoria/conta/assinatura) 🟡
Toda renderização de lista interpola strings do usuário em `innerHTML` **sem escapar**:
- `render.js` — `${c.nome}`, `${c.categoria}`, `${c.obs}`, `${f.nome}` nas tabelas de fixas/receitas
- `cartaoFatura.js:137,140` — `${t.descricao}`, `${t.categoria}`; `:209` — `value="${t.descricao}"`
- `calendario.js:104,117` — `${f.nome}`, `${s.nome}`, `${f.obs}`
- `assinaturas.js`, `categorias.js`, `cartoes.js` — nomes em `innerHTML`
- `toast.js:27` — `<span class="toast-msg">${msg}</span>` (vários callers interpolam nome do usuário)
- `modal.js` — `abrirModalSelecao` (`<option>${o}</option>` com nome de categoria), `mensagem`

Uma categoria chamada `<img src=x onerror=...>` executa script ao renderizar. Risco prático
**baixo** (app quase-privado, o usuário só se ataca), mas é XSS real e trivial de fechar.
**Correção:** um helper `_esc(s)` (troca `& < > " '`) aplicado em toda interpolação de string
livre do usuário. Toca ~12 funções de render.

### M2 — `_faturaDoCartao` muta o estado dentro do render 🟡
`cartaoFatura.js:14-18` — `_faturaDoCartao(id)` **cria** `activeCartoesFaturas[id] =
{transacoes:[]}` sempre que alguém **lê** uma fatura, inclusive `renderizarCartoesDashboard`
(que o próprio comentário na linha 78 diz ser "renderização pura"). Efeito: qualquer
`salvar_mes` posterior persiste **faturas-fantasma** (linha `cartao_faturas` vazia) para todo
mês que você já abriu desde que cadastrou um cartão. Não quebra nada (`_totalFatura` → 0), mas
suja o banco e é uma impureza que esconde bugs.
**Correção:** `_faturaDoCartao` só materializa quando vai gravar; o render usa leitura pura
(`activeCartoesFaturas[id] || { transacoes: [] }`).

### M3 — Esc fecha o modal pulando o handler de fechamento 🟡
`ui.js:35-41` — Esc seta `overlay.style.display='none'` direto em **todos** os `.modal-overlay`,
sem passar pelo botão "Cancelar" de cada modal. Isso pula:
- `_fecharModalGenerico` — não limpa `.modal-content` nem `window._cartaoRevisaoItens` /
  `_cartaoRevisaoBase`
- `fecharModalEditarFaturamento` — não zera `idEditandoFaturamento`
- `cancelarEdicaoFixa` — não zera `idEditandoFixa` nem reseta o form

Na prática esses estados são re-setados ao reabrir o modal, então se auto-curam — mas é
frágil e pode dar "abri Nova Conta e ele achou que eu tava editando". **Correção:** o Esc
dispara o `#modalBtnCancelar` do modal aberto (ou um `data-on-close`).

### M4 — `registradoEm` com formato misto quebra a ordenação do PDF 🟡
O cliente grava `registradoEm` como `"...Z"` (`new Date().toISOString()`); o Postgres devolve
`"...+00:00"` depois de um roundtrip por `get_mes`. `exportar.js:273` ordena o Registro de
Pagamentos por `a.registradoEm.localeCompare(b.registradoEm)` — **comparação de string**. `Z`
(0x5A) ordena depois de `+` (0x2B) e dos dígitos, então registros nos dois formatos saem fora
de ordem no PDF. Cosmético (só o relatório). **Correção:** ordenar por `Date.parse()` ou
`get_mes` devolver sempre o mesmo formato.

---

## 🟡 Severidade BAIXA / código morto / inconsistência

| # | Onde | O quê | Aplicar |
|---|---|---|---|
| B1 | `js/auth.js:65` | `criarConta()` é código morto — o botão "Criar Conta" foi removido na migração | 🟢 remover |
| B2 | `config.js` `_NOMES_MES`, `calendario.js:14`, `exportar.js:2` | array de nomes de mês repetido 3× | 🟢 consolidar (`calendario`/`exportar` usam `_NOMES_MES`) |
| B3 | `assinaturas.js:92,376`, `cartoes.js:38,81`, `faturamentos.js:22` | `id: Date.now()` puro; outros lugares usam `Date.now()+random`; extrato usa hash — geração inconsistente | 🟡 (resolvido de vez por A2) |
| B4 | `config.js:18`, `pwa.js:2` | 2 comentários ainda falam "Firestore/Firebase" | 🟢 atualizar texto |
| B5 | `faturamentos.js:18,60` | `addFaturamento` / `salvarEdicaoFaturamento` fazem `return` em silêncio se campo vazio — sem toast; `salvarContaFixa` mostra "Preencha nome, valor…" | 🟡 adicionar feedback |
| B6 | `charts.js:3,10` | `initChart` sem `if(!ctx) return` (os outros `initChart*` têm) | 🟢 padronizar |
| B7 | `render.js:20,119,177` | guardas `typeof x === 'function'` / `x && x()` pra funções sempre definidas; `renderizarExtrato`/`renderizarAssinaturas` não têm | 🟢 remover as guardas mortas |
| B8 | `index.html:501` + `meses.js` | `saldoInput` `onblur=salvarSaldoDoMes()` grava de novo logo depois de `ajustarCaixaAtual` já ter gravado — save duplicado (idempotente, só desperdício) | 🟡 |
| B9 | `ui.js:35` | handler de Esc não faz `preventDefault` nem checa `e.repeat` | 🟢 |
| B10 | `manifest.json` | ícones só `purpose:"any"` (Android mostra moldura branca); falta `maskable`; `start_url:"/index.html"` poderia ser `/`; sem `id` | 🟢 se o icon-512 tiver padding seguro; senão 🟡 (precisa novo PNG) |
| B11 | `calculadora.js:14` | `Function('return ('+atual...+')')()` — eval de input, guardado por regex que barra letras/parênteses. Aceitável, mas um mini-parser tiraria o `Function()` | 🟡 opcional |
| B12 | `cartaoFatura.js:182` | `abrirModalEstimativaCartao` usa `parseFloat(str.replace(',','.'))` em vez de `_parseDinheiro`, e o campo do prompt não tem máscara `data-dinheiro` | 🟡 |
| B13 | `render.js:20` | `temFiltrosAtivos &&` — guarda desnecessária (a função sempre existe, `filtros.js` carrega antes) | 🟢 |
| B14 | `ui.js:2` | `switchTab` no desktop faz `return` cedo — clicar no nav-item não dá feedback nenhum (por design) | — (ok) |

---

## UX — o que falta / regressões da migração

| # | Item | Situação |
|---|---|---|
| U1 | **Notificações de vencimento** | Removidas na migração (FCM). Usuário quer de volta → **Fase 3** (Web Push). |
| U2 | **Import de extrato por e-mail** | Quebrado (Apps Script escrevia no Firebase) → **Fase 2**. |
| U3 | **"Esqueci minha senha"** | Fluxo existe (`sb.auth.resetPasswordForEmail`), Site URL já ajustada nesta sessão. **Falta testar ponta a ponta.** SMTP embutido do Supabase é limitado (~2–3 e-mails/hora no free) — se precisar de volume, configurar SMTP próprio. |
| U4 | **Sem fila de escrita offline** | Regressão real. Antes o Firestore tinha `enablePersistence` (via cache + fila). Agora, sem rede, toda escrita mostra "erro, tentar de novo" e o dado fica só em memória até reconectar + repetir **manualmente**. Difícil de resolver bem (fila de mutações); no mínimo, documentar como limitação. |
| U5 | **`travarZoom.js` bloqueia zoom de pinça** | Decisão de produto ("cara de app"), mas é **problema de acessibilidade** (baixa visão não amplia). WCAG desencoraja. Registrado. |
| U6 | **Focus-trap nos modais** | Nenhum modal prende o foco; Tab escapa pra trás do modal. Só `abrirModalPrompt` dá `input.focus()`. |
| U7 | **`prefers-reduced-motion`** | Ignorado — odômetro, reveal de cards, toasts sempre animam. |
| U8 | **`<label>` só via `placeholder`** | Muitos inputs (modais, filtros) usam só `placeholder` como rótulo — some ao digitar; ruim pra acessibilidade e memória curta. |
| U9 | **PWA iOS** | Sem `apple-touch-startup-image` (splash branca ao abrir instalado). Sem `shortcuts` no manifest. |
| U10 | **Sem micro-feedback de "salvo"** | O app grava em background e só avisa se falhar. OK na maioria; ao editar saldo / valores grandes um "salvo" discreto tranquilizaria. Opcional. |
| U11 | **`loadingDiv`** | Já resolvido nesta sessão (virou chip pequeno no topo). |

---

## Schema / RPC — observações

- **Roundtrip `get_mes` ↔ `salvar_mes` está correto** para `fixas`, `faturamentos`,
  `registro_pagamentos`, `cartoesFaturas` (todos os campos voltam). **Exceção conhecida:**
  `extrato` não tem coluna de id-de-origem → `origemImportId` do parser é descartado → dedup de
  reimportação por e-mail não funciona. Corrigido na **Fase 2a**.
- `get_advisors` (security): 7 WARN `authenticated_security_definer_function_executable` nas 7
  RPCs — **esperado e intencional** (usuário logado precisa chamá-las; são DEFINER pra escopar
  por `auth.uid()` internamente). `get_advisors` (performance): só INFO `unused_index`.
- Tabelas `anon`/`authenticated` têm `GRANT ALL`; RLS `own` é a barreira. Endurecer (tirar
  `DELETE`/`INSERT` direto do cliente, deixar só via RPC) — endurecimento futuro, não urgente.
- `salvar_mes` faz `delete + reinsert` do mês inteiro a cada gravação — barato pra os volumes
  atuais (maior mês: ~200 linhas de extrato), mas a Fase 2 (`importar_extrato_email`) precisa
  fazer **merge incremental** e depender de `origem_import_id` no roundtrip pra não ser
  apagado pelo próximo `salvar_mes` do app.

---

## Plano de aplicação

1. **🟢 Correções seguras** (B1, B2, B4, B6, B7, B9, B13 + comentários) → commit
   `auditoria: correções seguras`, sem mudança de comportamento.
2. **🟡 Aguardando sua aprovação, item a item:** A1, A2, M1, M2, M3, M4, B5, B8, B10, B11, B12,
   e as decisões de UX (U4 fila offline, U5 zoom, U6–U9 acessibilidade).
3. Depois: Fases 1 (verificar cartão), 2 (extrato e-mail), 3 (Web Push).

---

## Status das correções (02/09/2026 — "resolver tudo exceto o zoom")

| Item | Feito | Como |
|---|---|---|
| **A1** exclusão perdida ao fechar aba | ✅ | `pagehide`/`beforeunload` disparam uma gravação **keepalive** direta nas RPCs (`_flushKeepAlive` em `undo.js`) quando há exclusão pendente ou save em voo — o fetch keepalive sobrevive ao fechamento. Token guardado em `window._sbToken` (`auth.js`). Sem mexer na matemática do Caixa Atual. |
| **A2** PK global → colisão silenciosa | ✅ | Migração `0006_pk_por_escopo.sql` (PK composta por escopo). `get_advisors` sem WARN novo. |
| **M1** injeção de HTML | ✅ | Helper `_esc()` em `mascaraDinheiro.js`, aplicado em `render.js`, `cartaoFatura.js`, `cartaoImportar.js`, `calendario.js`, `assinaturas.js`, `categorias.js`, `cartoes.js`, `calculadora.js`, `extrato.js`. `toast.js` e `modal.js` escapam central (msg/título/opções). Categorias no `onclick` → migradas pra `data-cat` + `dataset`. Testado com payloads `<img onerror>` / `<script>` — não executam. |
| **M2** `_faturaDoCartao` muta no render | ✅ | Novo `_faturaDoCartaoLeitura()` (leitura pura) usado no render e nas consultas; `_faturaDoCartao()` (materializa) só em caminho de escrita. Testado: abrir/cancelar não cria fatura-fantasma. |
| **M3** Esc pula o handler de fechamento | ✅ | Esc dispara o `#modalBtnCancelar` / `.modal-close-x` do modal aberto (roda o `fechar…()` certo). `fecharModalNovaFixa` agora zera `idEditandoFixa`. |
| **M4** ordenação do PDF com formato misto | ✅ | `exportar.js` ordena o Registro de Pagamentos por `Date.parse()`. |
| **B3** `id: Date.now()` inconsistente | ✅ | Todos os `push` novos usam `Date.now() + random`. (A colisão em si já resolvida pela A2.) |
| **B4** comentários "Firestore" | ✅ (parcial) | `config.js` ajustado. `pwa.js` fica pra Fase 3 (arquivo será reescrito). |
| **B5** receita sem feedback em campo vazio | ✅ | `addFaturamento` / `salvarEdicaoFaturamento` mostram toast. |
| **B6** `initChart` sem guarda `!ctx` | ✅ | Guarda adicionada. |
| **B7 / B13** guardas mortas em `render.js` | ✅ | Removidas. |
| **B8** save duplicado do Caixa Atual | ✅ | `salvarSaldoDoMes(el)` só regrava se o valor mudou desde o foco (`data-saldo-ao-focar`). |
| **B9** Esc sem `preventDefault`/`e.repeat` | ✅ | Ambos no novo handler. |
| **B10** manifest (maskable, `start_url`, `id`) | ✅ | `id`/`start_url` = `/`, `shortcuts`, e **novos PNGs maskable** (`icon-maskable-192/512.png`, fundo full-bleed) gerados e referenciados. |
| **B11** `Function()` na calculadora | ✅ | Substituído por `_calcAvaliar()` — parser próprio (+ − × ÷ %), sem `eval`. Testado: precedência, div/0, entrada inválida. |
| **B12** estimativa de cartão sem máscara | ✅ | `abrirModalPrompt({ dinheiro: true })` — aplica `data-dinheiro` e devolve número. |
| **U6** focus-trap | ✅ | Handler global de Tab em `ui.js` prende o foco no modal aberto; `_renderModalGenerico` foca o 1º campo. |
| **U7** `prefers-reduced-motion` | ✅ | Bloco CSS ampliado (modais, toasts, chip, "girando"); odômetro (`anim.js`) checa a media query e vai direto pro valor final. |
| **U8** `<label>` só via placeholder | ✅ (a11y) | `_rotularInputsSemLabel()` copia o placeholder pra `aria-label` nos campos sem rótulo (login, filtros, todos os modais). Sem mudança visual. |
| **U9** PWA (atalho, ícone maskable) | ✅ (parcial) | `shortcuts` no manifest + wiring `?atalho=` em `ui.js`; ícones maskable. `apple-touch-startup-image` (splash iOS) fica de fora — exige um jogo de PNGs por resolução de tela. |
| **U4** fila de escrita offline | ⚠️ parcial | O `_flushKeepAlive` no fechamento + o toast "Tentar de novo" por ação cobrem os casos comuns. Uma fila de mutações completa (retry automático ao reconectar) continua fora de escopo — é um projeto à parte. |
| **U5** zoom de pinça | ⛔ mantido | Decisão do usuário: `travarZoom.js` fica como está. |

Verificação: cada caminho alterado testado no navegador com estado mockado (render de fixas/
receitas/extrato/assinaturas/cartão, abertura de modais, Esc, focus-trap, calculadora, toasts,
odômetro com reduced-motion, categorias com aspas/HTML). Sem erro de console novo; XSS não
executa em nenhum campo.
