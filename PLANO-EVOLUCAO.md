# Plano de Evolução — Planner Financeiro (finance-pro)

> Documento de continuidade. Gerado ao trocar de ferramenta (Claude Code → Claude Cowork) no meio da execução do plano. Antes deste documento não havia nenhum arquivo de plano versionado no repositório — só existia `index.html`.

## Contexto e decisões já confirmadas com o usuário

O projeto era um único arquivo `index.html` (~1195 linhas, HTML+CSS+JS inline, sem build tooling) usando Firebase Auth/Firestore (SDK compat via CDN) e Chart.js. Depois de uma varredura completa, foi aprovado um plano de evolução com 13 frentes de mudança, executadas em fases sequenciais e verificáveis.

Decisões de escopo já fechadas com o usuário (não reabrir):
- **Sem Cloud Functions / sem plano Blaze por enquanto** — tudo client-side.
- **Notificações:** só push no navegador (Notification API/Service Worker local), **sem e-mail**. Limitação aceita: não dispara com o navegador totalmente fechado (exigiria FCM + Cloud Function).
- **Compartilhamento de orçamento:** entrada via **código/link de convite** (não busca por e-mail).
- **Permissões no compartilhamento:** existe um **"dono"** com controle extra (só ele remove membros ou apaga dados do mês/orçamento inteiro); demais membros editam contas normalmente.
- Item "id: Date.now() pode colidir" foi descartado pelo usuário — fora de escopo.
- Assinaturas continuam **informativas por padrão** (não entram automaticamente no orçamento); em vez de integração automática, cada assinatura ganha um botão para o usuário decidir, caso a caso, se aquela assinatura deve virar uma conta fixa avulsa (Fase 6).
- **Princípio permanente (a partir da rodada "Redesign Extrato/Assinaturas/Acumulado", pedido explícito do usuário):** toda mudança de UI/UX, desta rodada em diante, precisa ser validada também no mobile (telas estreitas, ~320–390px) — não só no desktop. Nunca reabrir isso como "opcional".

---

## ✅ O que já foi feito

### Fase 0 — Regras de segurança do Firestore (modelo pessoal)
- Criado `firestore.rules` na raiz do repo, isolando `users/{uid}/config` e `users/{uid}/meses` por dono (`request.auth.uid == userId`).
- **AÇÃO PENDENTE DO USUÁRIO (não é código):** aplicar esse conteúdo manualmente no Console do Firebase → Firestore Database → Regras → colar → Publicar. Sem isso, a proteção não está de fato ativa no backend. **Ainda não confirmado.**

### Fase 1 — Divisão do arquivo único
`index.html` foi dividido, sem alterar nenhuma lógica (extração por número de linha exato do arquivo original — validado por contagem de linhas, balanceamento de chaves `{}` e checagem cruzada de que as 45 funções originais e todos os `onclick` do HTML continuam presentes). **Checkpoint validado no Claude Code**: app aberto via servidor local + Chrome real, visual idêntico ao original, zero erros no console, CRUD/tema/gráficos/calculadora testados manualmente.

Estrutura final de arquivos (após todas as fases abaixo):
```
index.html               → marcação + <script> tags
css/style.css             → CSS original + estilos novos (toast, modal, calendário)
js/config.js              → firebaseConfig, auth, db, wrappers getConfigDocRef()/getMesesCollectionRef(), estado global
js/toast.js               → mostrarToast() (Fase 2)
js/modal.js               → abrirModalConfirmacao/Prompt/Selecao() (Fase 2 + 5)
js/undo.js                → excluirComUndo()/flushPendingDelete() (Fase 8)
js/theme.js               → tema claro/escuro
js/auth.js                → login, cadastro, logout, recuperarSenha() (Fase 7)
js/config-global.js       → config global no Firestore (categorias, assinaturas, meses)
js/meses.js               → carregar/gravar dados do mês, gestão de meses, modais de copiar/limpar (Fase 8)
js/categorias.js          → CRUD completo de categorias incl. editar/excluir com merge (Fase 5)
js/fixas.js               → CRUD de contas fixas, exclusão com undo (Fase 8)
js/faturamentos.js        → faturamentos/receitas do mês
js/assinaturas.js         → assinaturas + renderizarAssinaturas() + "Adicionar às Contas Fixas" (Fase 6)
js/calendario.js          → calendário de vencimentos
js/calculadora.js         → calculadora inteligente
js/tabelas.js             → ordenação de tabelas
js/charts.js              → gráficos (Chart.js)
js/ui.js                  → navegação entre abas / toggle configurações
js/render.js              → calcularEAtualizarVisual() — função central; totais sempre no array completo, filtro de busca só afeta renderização (Fase 9)
js/exportar.js            → exportação CSV/PDF (Fase 10)
js/app.js                 → ainda só placeholder; vai receber o registro do service worker quando a Fase 3 for retomada
```

**Seam da Fase 12 já criado:** `getConfigDocRef()`/`getMesesCollectionRef()` existem em `js/config.js` e são usados em todas as leituras/gravações (`config-global.js`, `meses.js`, `categorias.js`). Quando a Fase 12 começar, é só fazer essas duas funções checarem `orcamentoAtivoId` e apontar para o caminho novo ou legado — nenhum outro arquivo precisa ser reaberto.

### Fase 2 — Toast + modal genérico + tratamento de erro ✅ validado
`js/toast.js` (`mostrarToast`) e `js/modal.js` (`abrirModalConfirmacao`/`abrirModalPrompt`). `salvarDadosDoMesAtual()`/`salvarConfigGlobal()` propagam erro via `.catch` com toast + "Tentar de novo". Testado ao vivo: toasts success/error com ação, modais de confirmação/prompt.

### Fase 4 — SRI nos CDNs ✅ validado
Chart.js pinado em `4.5.1`, Firebase compat SDK (`10.12.2`) e jsPDF/jspdf-autotable (Fase 10) — todos com `integrity`/`crossorigin="anonymous"`, hashes sha384 calculados baixando os arquivos exatos dos CDNs. Google Fonts documentado como não aplicável. Testado: `typeof Chart`/`typeof firebase`/`typeof window.jspdf` confirmam carregamento correto (hash errado bloquearia o script).

### Fase 5 — Editar/excluir categorias ✅ validado
`editarCategoriaGlobal(antigo, novo)` propaga renomeação/merge para `categoriasAtuais` e para as fixas de **todos os meses** (via `getMesesCollectionRef()`). `excluirCategoriaGlobal(nome)` bloqueia e oferece migração via `abrirModalSelecao` quando a categoria está em uso no mês atual; exclusão direta quando não está. Testado ao vivo: rename simples, merge com migração, bloqueio quando não há categoria substituta.

### Fase 6 — Assinatura → "Adicionar às Contas Fixas" ✅ validado
`renderizarAssinaturas()` único alimenta `#listaAssinaturasCard` e a nova `#listaAssinaturasConfig`. Botão "Adicionar às Contas Fixas" abre modal pré-preenchido (nome/valor/vencimento/categoria) e cria conta fixa avulsa no mês atual. Testado ao vivo.

### Fase 7 — Recuperação de senha ✅ validado
`recuperarSenha()` em `js/auth.js` via `auth.sendPasswordResetEmail`. Link "Esqueci minha senha" na tela de login. Caminho de validação (e-mail vazio) testado ao vivo; envio real não foi disparado em teste para não gerar e-mail real no Firebase de produção.

### Fase 8 — Confirmação/undo consistentes ✅ validado
`copiarContasFixas`/`limparFixasDoMesAtual` usam `abrirModalConfirmacao` em vez de `confirm()`. Exclusões de fixas/faturamentos/assinaturas/categorias (quando não estão em uso) passam por `excluirComUndo()`: removem da UI na hora, toast "Item excluído" + "Desfazer" por 5s, só persistem se o tempo passar sem desfazer. `flushPendingDelete()` força a persistência pendente ao trocar de mês (`mudarMesOuro`) ou fechar a aba (`beforeunload`). Testado ao vivo: undo restaura sem persistir, timeout persiste exatamente uma vez, troca de mês força flush imediato.

### Fase 9 — Busca/filtro nas tabelas ✅ validado
Campo de busca acima das tabelas de Contas Fixas (`#buscaFixas`, por nome ou categoria) e Faturamentos (`#buscaFaturamentos`, por origem). `calcularEAtualizarVisual()` sempre soma o array completo para os totais/gráficos; o filtro só corta as linhas renderizadas. Testado ao vivo com múltiplos itens.

### Fase 10 — Exportação CSV/PDF ✅ validado
CSV manual (`js/exportar.js`) com BOM UTF-8, delimitador `;` (padrão Excel-BR) e escapamento de aspas/`;`/quebras de linha. PDF via jsPDF + jspdf-autotable (relatório com faturamentos, fixas e resumo). Nova seção "Exportar Dados" em Configurações. Testado ao vivo: conteúdo do CSV inspecionado byte a byte (BOM + escaping corretos), PDF gerado conferido via leitura do arquivo (acentuação, tabelas e cores corretas).

⚠️ **Nota:** durante o teste desta fase um PDF de teste (`relatorio-2026-07.pdf`, dados fictícios) foi baixado sem querer para a pasta Downloads do usuário — o mecanismo interno do jsPDF não passa pelo mesmo caminho de interceptação usado para bloquear os downloads de CSV de teste. O usuário foi avisado e optou por deixar o arquivo como está.

---

## ⏳ O que falta fazer

### Fase 3 — PWA instalável ✅ concluída (retomada a pedido do usuário)
Estava em stand-by; retomada porque virou pré-requisito da Fase 11 (usuário instalou o app na
tela inicial do iPhone e pediu notificação de vencimento — no iOS, push só funciona assim).

- `manifest.json` na raiz (nome, ícones, `display: standalone`, cor tema roxa).
- Ícones gerados via PowerShell/`System.Drawing` (192, 512, e 180 pra `apple-touch-icon`) —
  fundo em gradiente roxo igual ao `--gradient-btn` do app + glifo de linha ascendente branco,
  sem depender de nenhum arquivo de logo pré-existente (não havia nenhum no repositório).
- `firebase-messaging-sw.js` na raiz faz o papel de service worker: registra o app como instalável
  (handler de `fetch` simples, sem cache agressivo — os dados vêm ao vivo do Firestore, cachear
  HTML/JS desatualizado geraria mais problema que benefício) **e** recebe as notificações push em
  segundo plano (ver Fase 11). Registrado em `js/pwa.js`, carregado no fim do `index.html`.
- Meta tags de iOS (`apple-mobile-web-app-capable` etc.) no `<head>` do `index.html`.

### Fase 11 — Notificações push de vencimento ✅ concluída e em produção
Pedido do usuário: avisar no celular quando uma assinatura ou conta fixa está vencendo — 3 dias
antes e no dia. Cogitou-se WhatsApp via Evolution API (Docker), mas foi descartado porque o
container só roda quando o PC do usuário está ligado, e não daria pra expor isso pra internet
com segurança. Solução adotada, sem Cloud Function nem plano Blaze:

- **Cliente** (`js/pwa.js`): botão "Ativar notificações de vencimento" nas Configurações pede a
  permissão do navegador, registra o dispositivo no Firebase Cloud Messaging (FCM) e salva o
  token gerado em `config/geral.pushTokens` — um **mapa `deviceId -> token`**, não uma lista solta,
  pra reativar no mesmo aparelho substituir a entrada dele em vez de empilhar um token novo ao
  lado do antigo (era isso que causava notificação em dobro depois de reinstalar o app).
  `deviceId` é gerado uma vez e guardado no `localStorage`. Chave pública VAPID gerada no Firebase
  Console (Configurações do projeto → Cloud Messaging → Certificados push da Web) e embutida no
  código (é uma chave pública, sem problema de segurança em deixá-la no cliente).
  **Limitação descoberta na prática:** no iPhone, remover o PWA da tela de início e adicionar de
  novo (precisou ser feito pra atualizar o ícone) **apaga o `localStorage` da instância antiga**,
  então o `deviceId` se perde mesmo assim e um novo é gerado — o mapa `deviceId -> token` volta a
  acumular entradas órfãs nesse cenário específico (reinstalar), só não mais no caso mais comum
  (reabrir o app depois de dias). Corrigido na hora limpando `pushTokens` direto no Firestore; pra
  não depender de mim numa próxima vez, foi adicionado o botão "Notificação duplicada ou com
  problema? Resetar" nas Configurações — apaga todos os dispositivos cadastrados de uma vez
  (`resetarNotificacoesVencimento()`), bastando reativar de novo em cada aparelho depois.
- **Apps Script** (`automacao-email-nubank/Code.gs`, mesmo projeto da automação do Nubank):
  nova função `verificarVencimentosEEnviarPush()`, chamada no fim de `processarExtratosNubank()`
  — reaproveita o mesmo gatilho de tempo (a cada 1h), sem precisar configurar um segundo gatilho.
  Verifica assinaturas (`config/geral.assinaturas`, pulando as já `faturadoEm` do mês) e contas
  fixas do mês atual (`meses/{mesAtual}.fixas`, pulando as já `pago`); quando o vencimento cai em
  3 dias ou no dia (`DIAS_DE_AVISO = [3, 0]`), chama a API do FCM (`fcm.googleapis.com/v1/.../
  messages:send`) pra cada token salvo, autenticado com a mesma conta de serviço já usada pro
  Firestore — só precisou ampliar o escopo do JWT assinado (`obterTokenFirestore_`) pra incluir
  também `firebase.messaging`, sem precisar de nenhum papel IAM novo (o service account padrão
  do Firebase Admin SDK já cobre isso). Quando o FCM responde que um token não existe mais (404),
  o `deviceId` correspondente é removido sozinho do mapa (`removerDispositivosInvalidos_`).
- **Dedup**: `config/geral.notificacoesEnviadas` guarda uma chave por aviso já enviado
  (`tipo-id-mês-diasRestantes`), podada automaticamente pra manter só os últimos 2 meses — evita
  reenviar o mesmo aviso a cada execução horária do gatilho.
- **Limitação aceita**: o aviso "3 dias antes" só é confiável se o gatilho do Apps Script rodar
  nesse dia (roda de hora em hora, então na prática sempre roda) — diferente da tentativa anterior
  via WhatsApp, aqui não depende de nenhum computador/servidor do usuário estar ligado, porque
  quem envia é o Google (Apps Script + FCM), não uma máquina local.

### Fase 12 — Compartilhamento de orçamento multi-usuário — **CANCELADA pelo usuário**
Decisão do usuário: não implementar. Seção mantida abaixo só como registro histórico do que havia sido desenhado, caso o usuário reconsidere no futuro.

Migração **opt-in** (não automática), para não colocar em risco os dados já existentes do usuário atual.

Novo modelo de dados:
```
orcamentos/{orcamentoId}                     → nome, donoId, membros: {uid: {role, entrouEm}},
                                                categorias, assinaturas, meses[]
orcamentos/{orcamentoId}/mesesDados/{anoMes} → fixas, faturamentos, saldo
convites/{codigo}                             → orcamentoId, criadoPor, expiraEm, usosMax, usosAtuais
users/{uid}.orcamentoAtivoId                  → aponta pro orçamento em uso; null = modelo legado
```

- `getConfigDocRef()`/`getMesesCollectionRef()` (seam a ser criado, ver nota da Fase 1) passam a checar `orcamentoAtivoId` e apontar para o caminho novo ou legado automaticamente.
- Migração **copia** (não move) os dados existentes; só depois de confirmado sucesso grava `orcamentoAtivoId`. Dados antigos ficam como backup congelado, sem apagar nada automaticamente.
- Convite por código curto (8+ caracteres, expira em 7 dias, `usosMax` baixo) permite entrada direta via regra declarativa que só autoriza o próprio usuário a adicionar seu uid ao mapa `membros`, validando o convite.
- Regras finais do Firestore cobrem os dois modelos (legado + compartilhado); dono pode remover membros/apagar o mês inteiro; membros comuns só editam dados operacionais.
- **Checkpoint obrigatório antes de publicar essas regras:** revisar a lógica de auto-entrada via convite no Rules Playground do Firebase — é a parte mais sensível de todo o plano (permitir que um não-membro escreva em `orcamentos/{id}` só com base em regra declarativa).

---

## Checkpoints ainda pendentes com o usuário
1. ~~Confirmar visualmente que o app funciona 100% igual após o split da Fase 1~~ — **feito** (validado no Claude Code via servidor local).
2. **Confirmar que aplicou o `firestore.rules` da Fase 0 no Console do Firebase** — ainda pendente, precisa ser feito manualmente pelo usuário.
3. Decidir quando retomar a Fase 3 (ícones do PWA) — pausada a pedido do usuário.
4. ~~Antes de publicar as regras finais da Fase 12 (compartilhamento) — revisão conjunta no Rules Playground~~ — **não se aplica mais**, Fase 12 cancelada.

## Estado atual do escopo
- **Feito e validado:** Fases 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 13 (redesign visual), responsividade dinâmica, V2 e V2.5 (ver seção própria abaixo).
- **Em stand-by:** Fase 3 (PWA) — aguardando o usuário retomar o design dos ícones.
- **Bloqueada:** Fase 11 (notificações push) — depende da Fase 3.
- **Cancelada:** Fase 12 (compartilhamento multi-usuário) — decisão do usuário.

---

## Fase 13 — Redesign Visual "Roxo Tech" ✅ concluída e validada

Reforma visual completa do app, inspirada em referências enviadas pelo usuário (dashboards fintech modernos + set de ícones "Regular"). Implementada e testada de uma vez (não fase a fase), a pedido do usuário.

**13.1 — Design system:** paleta "roxo tech" (mesmas variáveis CSS de antes, valores novos — `--purple-main: #6D4FEA`, gradiente `--gradient-primary`), modo escuro repaginado (`#120E22`/`#1C1735`), fonte **Plus Jakarta Sans**, cantos arredondados maiores (`--radius-sm/md/lg`), sombras suaves (`--shadow-sm/md/lg`). Todos os 42 usos de Material Icons (25 no HTML + 17 no JS) trocados por **Phosphor Icons peso Regular** via CDN com SRI (hash calculado a partir do arquivo real, mesmo padrão da Fase 4). `obterIconeCategoria()` remapeado para nomes Phosphor.

**13.2 — Cabeçalho e mês:** header com gradiente, seletor de mês reformulado com setas ◀ ▶ (`navegarMes()` novo em `meses.js`) + dropdown estilizado. Ajuste extra descoberto em teste: no mobile real (≤480px) o header agora quebra em duas linhas (título / navegação+sair) — sem isso o botão de sair ficava cortado fora da tela.

**13.3 — Bottom nav + modais:** nav mobile reduzida para **Contas · Calendário · Mês**. Calculadora e Configurações deixaram de ser abas (`tab-calculadora`/`tab-config` removidas) e viraram modais (`#modalCalculadora`, `#modalConfig`), abertos por botões dentro das abas Contas e Mês respectivamente — isso eliminou também a lógica antiga de `toggleConfigDesktop()`/`desktop-hidden` (não fazia mais sentido com Config em modal).

**13.4 — Componentes:** botões primários com gradiente roxo; **Adicionar Mês**, **Copiar para o Mês Atual** e **Salvar Categoria** voltaram para o roxo padrão do tema (antes um deles era laranja). Hover/active com transições suaves em cards, botões, linhas de tabela.

**13.5 — Popup de Nova Conta Fixa:** formulário saiu do topo da aba Contas Fixas e virou modal (`#modalNovaFixa`), acionado por um botão "+" flutuante. `editarContaFixa()` agora abre o mesmo modal pré-preenchido (título e botão mudam para "Editar Conta Fixa" / "Salvar Alteração").

**13.6 — Modal "Somar Contas Fixas":** lista de checkboxes crua virou cards clicáveis com badge de categoria (ícone + nome) e checkbox customizado com feedback visual (borda + fundo roxo + check).

**13.7 — Gráficos/calendário/painel/mobile:** paleta de cores dos gráficos (`coresCategorias` em `config.js`) atualizada para tons roxo/azul/teal/laranja. Calendário e Painel de Controle restilizados. Passada de responsividade mobile (ver 13.2).

**Validação:** testado extensivamente no Chrome real com dados reais do usuário (servidor HTTP local via PowerShell) — todos os modais, navegação de mês, dark mode, edição/exclusão, gráficos, chips de categoria, e o bottom nav mobile (simulado via override de `window.innerWidth` + CSS, já que o `resize_window` da automação não afeta o viewport real do Chrome). Zero erros de console em toda a sessão de testes.

**Correção feita durante o teste:** os indicadores de ordenação das tabelas usavam o emoji "↕️", que renderizava como um glifo quebrado nesse ambiente — trocado por ícone Phosphor (`ph-caret-up-down`), mais consistente com o resto do redesign de qualquer forma.

## Pós-Fase 13 — Responsividade dinâmica, V2 e V2.5 ✅ concluídas

Depois do redesign da Fase 13, o usuário reportou bugs reais de responsividade (scroll horizontal, layout cortado no celular) e pediu redesign incremental em duas rodadas ("V2" e "V2.5"), sem passar por `PLANO-EVOLUCAO.md` fase a fase — registrado aqui só para manter a continuidade.

**Responsividade dinâmica:** causa raiz era o clássico bug do CSS Grid com `min-width: auto` — a tabela empurrava a coluna inteira. Corrigido com `min-width: 0` em `.main-container`/`.col-left`/`.col-right` + **Container Queries** (`container-type: inline-size`, `@container`) no lugar de `@media` de viewport, e `repeat(auto-fit, minmax(min(400px,100%), 1fr))` no grid principal — layout recalcula em tempo real conforme a tela muda, sem breakpoints fixos.

**V2:** Contas Fixas voltou a uma tabela enxuta (Item/Venc./Valor/Pago), nome do item virou link que abre popup de edição (com conta recorrente: duplica a conta fixa para os meses seguintes via `_duplicarContaEmMesesFuturos()` em `fixas.js`), botões do Config viraram ícones compactos, gradiente voltou nos botões (mantendo badges/tabelas planos), busca/ordenação removidas de Receitas, header antigo removido (substituído por um card com título/navegação de mês/config/logout acima de Receitas), "Faturamentos" renomeado para "Receitas", "Caixa Inicial (Extra)" virou "Caixa Atual".

**V2.5 (11 itens):**
- Checkbox de seleção em Contas Fixas (`.row-check`, `toggleSelecaoFixa()` em `fixas.js`) somando os marcados numa nova linha **"SOMA DE CONTAS"** no Painel de Controle (`#mSomaSelecionadas`), sem aparecer no card de Contas Fixas.
- Tabela de Contas Fixas deixou de virar cards empilhados no mobile (removida a conversão `@container` antiga) — permanece tabela, só com padding/fonte mais compactos abaixo de 400px de largura do card; o checkbox de soma funciona igual em qualquer largura.
- Bottom nav: `.nav-item.active` agora é uma pílula preenchida em gradiente (`var(--gradient-btn)`, `border-radius: 999px`).
- Scrollbar customizada em `.modal-content` (tema roxo) + listener global de `Escape` em `ui.js` que fecha qualquer `.modal-overlay` visível no app.
- Painel de Controle: nova variável `--matrix-label-text` (branco no claro, roxo bem escuro no escuro) para contraste dos labels; ordem das linhas fixada em Orçamento Fixo → Restante Contas → Soma de Contas → Pago → Saldo Estimado → Falta/Sobra.
- "Repetir todo mês até" virou toggle estilo iOS (`.ios-toggle`), mais perto do texto.
- Busca removida de Contas Fixas; Receitas ganhou botão de editar (lápis, abre `#modalEditarFaturamento`); campo Valor de Receitas sem as setinhas de number input (`.no-spin`); botão Adicionar de Receitas menor (`.btn-flat-sm`).
- Animações de entrada: `js/anim.js` aplica `.reveal-init`/`.reveal-in` com `IntersectionObserver` em todo `.card` — sobem suavemente ao logar e ao rolar a tela; itens de "Acumulado por Categoria" entram com fade escalonado.
- **Importação de extrato bancário em PDF** (`js/extrato.js`) — novo card abaixo de Contas Fixas. Como o app é 100% client-side (sem backend/Cloud Functions, decisão já registrada acima), o parser roda no navegador com **pdf.js** em vez de PHP: extrai o texto do PDF por posição (Y/X), reconstrói linhas e interpreta o padrão Tipo/Descrição/Valor do extrato (testado e validado contra um extrato real do Nubank — 193 transações reconhecidas, somas de entrada/saída batendo exatamente com o total oficial do PDF). Reimportar o mesmo PDF não duplica (chave de deduplicação por data+tipo+item+valor+direção); só adiciona o que for novo. Mesma UI de checkbox-soma de Contas Fixas, dados guardados por mês (`extrato: []` no documento do mês, ao lado de `fixas`/`faturamentos`).

**Achado de teste importante:** ao validar tudo isso no servidor local (XAMPP/Apache), vários arquivos `.js`/`.css` sem parâmetro de versão ficaram em cache do navegador entre uma edição e outra, mascarando temporariamente o código novo. Não afeta a produção (Vercel já manda `cache-control: public, max-age=0, must-revalidate` com ETag, forçando revalidação a cada carregamento) — mas é um bom candidato a explicar relatos de "isso não funciona" logo após um deploy: um navegador com a aba já aberta de antes continua rodando o JS antigo até um recarregamento completo.

## Arquivos-chave do repositório hoje
- `index.html`, `css/style.css`, `js/*.js` — estrutura atual pós-Fases 0, 1, 2, 4–10, 13 (ver seções acima para o mapa completo de arquivos)
- `firestore.rules` — versão pessoal (Fase 0), ainda não publicada no Console do Firebase; não haverá versão "compartilhada" já que a Fase 12 foi cancelada
- `PLANO-EVOLUCAO.md` — este documento
- `automacao-email-nubank/` — script de Google Apps Script + guia de configuração para
  importar o extrato do Nubank automaticamente a partir do e-mail (ver seção própria abaixo)
- A partir da rodada "animações + fonte + mobile", o Claude passou a commitar e enviar ao
  GitHub automaticamente ao final de cada rodada de mudanças testada, a pedido do usuário

## Automação: extrato do Nubank por e-mail ✅ concluída e em produção

O usuário pediu uma forma de o extrato bancário ser importado sozinho, sem precisar abrir o
app e subir o PDF manualmente. Como o e-mail que o Nubank manda ("Extrato da sua conta do
Nubank", de `todomundo@nubank.com.br`) vem com anexo `.csv` estruturado (`Data,Valor,
Identificador,Descrição`) além do `.pdf`, o parser da automação lê o CSV — muito mais simples
e confiável que reconstruir texto de PDF, e essencial porque o ambiente que roda isso sem o
navegador aberto (Google Apps Script) não tem como executar o pdf.js usado no upload manual.

**Importante:** esse e-mail é enviado sob demanda pelo Nubank (quando alguém pede um extrato
no app dele), não numa rotina mensal automática — a automação cobre "e-mail chegou → sistema
atualizado sozinho", mas pedir o extrato no app do Nubank continua sendo manual.

Entregue em `automacao-email-nubank/`: `Code.gs` (parser do CSV + escrita no Firestore via
API REST, autenticado com uma conta de serviço do Google Cloud) e `SETUP.md` (passo a passo:
criar a conta de serviço, pegar o UID do Firebase Auth, configurar o projeto no Apps Script,
testar manualmente, e criar o gatilho de tempo). O parser foi validado rodando no navegador
contra o CSV real de um extrato (01–17/abr/2026, 69 transações): bateu exatamente com os
totais oficiais do período (entradas +1.296,54 / saídas -1.117,47), sem duplicatas.

**Configuração concluída** (Claude + usuário, via Claude in Chrome no navegador real do
usuário): reaproveitada a conta de serviço padrão `firebase-adminsdk-fbsvc@finance-pro-v1`
(já existia, criada automaticamente pelo Firebase) em vez de criar uma nova — só foi
adicionado o papel extra "Usuário do Cloud Datastore" a ela. Chave JSON gerada, usada só
para preencher as Propriedades do Script (o valor da chave privada foi colado manualmente
pelo usuário — a automação do navegador é bloqueada por segurança para digitar segredos
desse tipo) e depois apagada do disco. Projeto do Apps Script criado sob a conta
`claudio.silveira.gg@gmail.com` (a que recebe os e-mails do Nubank de verdade), então **não
foi necessário nenhum encaminhamento de e-mail** entre contas — a conta de serviço já resolve
o acesso ao Firestore independente de qual conta Google é dona do script.

Na primeira execução (autorizada manualmente pelo usuário), a automação encontrou e importou
**todos** os e-mails de extrato que já existiam na caixa de entrada, de dezembro/2024 a
junho/2026, escrevendo corretamente em cada mês do Firestore e sem duplicar quando o mesmo
período apareceu em mais de um e-mail. Gatilho de tempo criado (a cada 1 hora).

## Redesign Extrato/Assinaturas/Acumulado ✅ concluída e validada

Pedido do usuário (com prints dos cards Extrato Bancário e Suas Assinaturas), com liberdade
explícita ("se achar que deve incluir uma função legal vc faz aí eu valido") pra uma melhoria
extra no card Extrato.

**Card Extrato Bancário** (`js/extrato.js`, `index.html`, `css/style.css`):
- Mapa `EXTRATO_TIPO_DISPLAY` traduz cada tipo de transação bruto (usado no parser/merge, não
  alterado) pra um rótulo curto + ícone só de exibição — ex.: "Transferência recebida pelo Pix"
  → "Recebido Pix" + ícone de seta. Cobre os 17 tipos reconhecidos pelo parser; tipo desconhecido
  cai num fallback genérico.
- Resumo por tipo agora sempre agrupado em **Entradas/Saídas**; dentro de cada grupo, ordena por
  nome (A-Z, padrão) ou por valor (maior primeiro) — botão de classificação (`.mini-toggle-btn`)
  alterna entre os dois modos e persiste só na sessão (não precisa ser salvo no Firestore).
- Função extra (a critério do Claude, a validar): cada linha do resumo por tipo ganhou uma barra
  de fundo proporcional ao valor daquele tipo em relação ao maior valor do card
  (`.tipo-item-bar`), dando uma leitura visual rápida de qual tipo pesa mais.

**Card Suas Assinaturas** (`js/assinaturas.js`, `css/style.css`):
- Nova ordenação: sempre por dia de vencimento (crescente), tanto no card do Dashboard quanto em
  Configurações.
- Campo novo `faturadoEm` (string `"AAAA-MM"`) em cada assinatura — em vez de um booleano fixo,
  guarda o `mesAtualKey` em que foi marcada como faturada. O badge "Faturado"/"Faturar" compara
  `faturadoEm === mesAtualKey`, então o status reresseta sozinho a cada mês (sem precisar de
  nenhuma rotina de limpeza) e continua correto ao navegar entre meses no app. A tag de
  vencimento continua **sempre visível** ao lado do badge, nunca é substituída por ele.
- Campo novo `categoria` (opcional) — reaproveita a lista global `categoriasAtuais`; usada só
  pra "classificação" da assinatura (ícone da categoria substitui o sino padrão na linha).
- Os dois botões soltos de ação (adicionar às fixas / excluir) viraram um único botão "⋮" que
  abre um menu de contexto compacto (`abrirMenuContexto()`, novo utilitário em `js/modal.js`,
  reaproveitável) com as 4 opções pedidas: Faturar, Adicionar às Contas Fixas (reaproveita
  `abrirModalAssinaturaParaFixa()` já existente), Classificação (usa `abrirModalSelecao()` já
  existente) e Excluir. O menu se posiciona perto do botão clicado, sempre dentro da viewport, e
  fecha ao clicar fora ou apertar Esc (mesmo listener global de Esc que já fechava modais).

**Card Acumulado por Categoria** (`index.html`, `js/config.js`, `js/config-global.js`, `js/ui.js`):
- Novo toggle em Configurações → "Exibição de Cards" (`.ios-toggle`, mesmo padrão visual já usado
  em "Repetir todo mês"), controlado por `ocultarCardAcumulado` (novo campo em `config/geral` no
  Firestore, salvo por `salvarConfigGlobal()` igual aos demais). Aplicado via
  `aplicarVisibilidadeAcumulado()`, chamada ao carregar a config e a cada toggle.

**Validação mobile:** testado programaticamente em 375px e no limite de 320px (menor tela comum)
usando um servidor estático local (`HttpListener` do PowerShell, já que não há Node/Python
instalados nesta máquina) e o navegador headless, injetando dados de teste diretamente no estado
do app (sem tocar o Firestore de produção) pra exercitar os cards sem precisar de login real.
Achado e corrigido nessa validação: linhas do resumo por tipo do Extrato com valores de 4+
dígitos estouravam ~6-9px a largura do card em telas de 320px — causa clássica de flexbox
(`min-width: auto` padrão em item flex impede encolher abaixo do conteúdo); corrigido com
`min-width: 0` no rótulo e `flex-shrink: 0` no valor. Confirmado sem overflow horizontal em
nenhum dos cards novos/alterados depois do ajuste. O badge "Faturado" (`.status-badge.wide`)
herda o encolhimento de fonte do `@container` já existente pra `.status-badge` (por
especificidade: 2 classes vencem 1), então fica compacto no mobile sem precisar duplicar regras.

## Extrato Bancário: correção de soma errada + mais detalhes (2026-07-28)

Usuário reportou que o total do card Extrato não batia com o CSV real do banco (comparação feita
com um extrato de 01–27/jul/2026: total real Entradas +R$8.708,50 / Saídas -R$8.714,81, contra o
que o app mostrava). Hipótese mais provável: os dois caminhos de importação (upload manual de PDF,
que dedupa por `data+tipo+item+valor+direção`, e a automação por e-mail/CSV, que dedupa por
`idOrigem`) podem deixar a mesma transação real entrar duas vezes se o texto do "item" não bater
exatamente entre PDF e CSV. Foram usadas (coladas direto no editor do Apps Script como ferramenta
pontual, não commitadas neste arquivo) `diagnosticarExtratoMes_`/`removerDuplicatasExtrato_`
(chave de duplicata = todos os campos + idOrigem, preservando pares legítimos que compartilham
Identificador do Nubank, como "Valor adicionado por cartão de crédito" + Pix pareado) e atalhos
`diagnosticarExtratoJulho`/`limparDuplicatasExtratoJulho` pro mês em questão.
**Status: ✅ bug resolvido e confirmado pelo usuário (21/08/2026).** As funções de
diagnóstico/limpeza citadas acima nunca chegaram a ser commitadas neste `Code.gs` (foram usadas
direto no editor do Apps Script), o que é esperado — eram ferramentas pontuais de uma correção de
dados já feita, não uma feature permanente do sistema.

Junto, entregue o resto do pedido (card Extrato):
- Modal "Ver detalhes" (`#modalExtratoDetalhes`) ampliado pra `.modal-xl` (980px), com coluna
  Data, busca por texto (item/tipo), filtro Entrada/Saída e ordenação por coluna (reaproveita
  `ordenarTabela`/`aplicarOrdenacao` já usados em Fixas/Faturamentos, novo estado `ordExtrato`).
- Clicar num tipo no resumo (`.tipo-item`) abre `#modalExtratoPorTipo`, só com as transações
  daquele tipo, ordenadas por data desc, com total.
- Botão de apagar todo o extrato do mês (`confirmarLimparExtratoDoMes`/`limparExtratoDoMes`),
  com confirmação, no cabeçalho do card.

**Novo processo, a pedido do usuário:** a partir de 2026-07-27, respostas em chat passam a ser só
um relatório final objetivo por tarefa (sem comentário a cada passo), pra economizar tokens.
Também foi criado um documento espelho no Google Drive ("Planner Financeiro - Contexto Completo.md",
id `1TnlCpBoVQtEs1sZ5DVE5p7oycRb0hsNK`) pra ele ter contexto completo do projeto fora do Claude
Code — deve ser atualizado junto com este arquivo a cada mudança relevante.

## Correções no Painel de Controle e card Receitas (2026-08-21)

**Novo processo, a pedido do usuário:** a partir desta data, toda alteração pedida é commitada,
enviada ao GitHub (branch `claude/finance-pro-context-0a55bg`) **e mesclada direto na `main`**
sem esperar confirmação — o deploy do Vercel reflete a mudança em produção em 1-2 minutos.

### Bug: Saldo Estimado somando receita em dobro ✅ corrigido (PR #6)
Usuário reportou que "Falta/Sobra" mostrava R$ 2.000,44 quando esperava algo próximo de R$ 33,00.
Causa: `calcularEAtualizarVisual()` (`js/render.js`) somava **todas** as receitas do mês no Saldo
Estimado, inclusive uma já recebida dias antes (ex.: salário do dia 07, com o mês em curso até o
dia 21) — esse valor já estava embutido no campo "Caixa Atual", então entrava duas vezes na conta.
Corrigido: só entram no Saldo Estimado as receitas com `data` **futura** à data de hoje (`f.data >
hojeStr`); receitas já passadas são tratadas como já refletidas em "Caixa Atual". Variável nova
`totalFaturamentosFuturos`, separada de `totalFaturamentos` (que continua somando tudo, sem uso
direto fora desse cálculo agora). Validado com os números reais do usuário: resultado bateu
exatamente com a expectativa manual (R$ 33,44).

### Card Receitas: layout mobile + botão de data ✅ corrigido (PR #6 e #7)
- Layout: no mobile, "Origem" ganhou linha própria (mais espaço pra digitar); Valor/Data/Adicionar
  foram pra uma segunda linha (`.receitas-form`/`.receitas-linha2` novas em `css/style.css`). No
  desktop (`@media min-width:900px`) continua tudo numa linha só, como antes.
- Botão de data: o `<input type="date">` completo virou um botão compacto com ícone de calendário
  (`.btn-data-picker`, mostra "Hoje" ou "dd/mm"). Primeira versão (PR #6) tentava abrir o seletor
  nativo via `input.showPicker()` num input escondido em 1x1px — falhava em silêncio no
  Safari/iOS, que foi onde o usuário testou. Corrigido no PR #7: o `<input type="date">` real
  passou a ficar **invisível por cima do botão** (mesmo tamanho/posição, `opacity:0`), então o
  toque cai direto nele e abre o calendário nativo do navegador/celular sem depender de JS pra
  isso. `js/faturamentos.js` ganhou `atualizarLabelDataFat()` pra manter o texto do botão em
  sincronia com a data escolhida.

### Limpeza: `alert()`/`confirm()` nativos removidos de `js/meses.js` (auditoria de 21/08/2026)
`copiarContasFixas()`/`_executarCopiaContasFixas()` ainda usavam `alert()` puro do navegador em
vez do sistema de toast usado no resto do app desde a Fase 2 — substituídos por `mostrarToast()`.
Sem mudança de comportamento visível além do estilo visual da mensagem.

### Correção: deduplicação do extrato podia descartar transações reais ✅ corrigido
Achado da auditoria de 21/08/2026 (ver seção "Extrato Bancário: correção de soma errada" acima
para o histórico do bug de julho, já resolvido e confirmado pelo usuário). Ponto novo, separado
daquele: `_extratoChave()`/`_extratoMesclar()` (`js/extrato.js`) tratavam duas transações **reais
e distintas** com data+tipo+item+valor+direção idênticos (ex.: dois Pix de R$ 20 pro mesmo
favorecido, no mesmo dia) como se fossem a mesma duplicada — a segunda era silenciosamente
descartada mesmo na primeira importação do PDF. Corrigido contando por **ordinal**: uma nova
transação só é tratada como duplicata de reimportação se já existir uma quantidade igual ou maior
de transações com a mesma chave no mês; a Nª ocorrência de uma chave repetida dentro do mesmo PDF
continua sendo somada normalmente. O ordinal também passou a entrar no hash do `id` de cada
transação — antes, duas transações com a mesma chave ficavam com o mesmo `id`, e excluir uma pela
lixeira sempre removia a primeira (nunca a segunda). Validado com 3 cenários automatizados
(importação com par idêntico, reimportação do mesmo PDF, PDF novo com uma 3ª ocorrência real):
todos bateram o resultado esperado.
