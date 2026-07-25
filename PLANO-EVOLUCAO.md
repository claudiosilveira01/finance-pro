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

---

## ✅ O que já foi feito

### Fase 0 — Regras de segurança do Firestore (modelo pessoal)
- Criado `firestore.rules` na raiz do repo, isolando `users/{uid}/config` e `users/{uid}/meses` por dono (`request.auth.uid == userId`).
- **AÇÃO PENDENTE DO USUÁRIO (não é código):** aplicar esse conteúdo manualmente no Console do Firebase → Firestore Database → Regras → colar → Publicar. Sem isso, a proteção não está de fato ativa no backend.

### Fase 1 — Divisão do arquivo único
`index.html` foi dividido, sem alterar nenhuma lógica (extração por número de linha exato do arquivo original, não retranscrita à mão — validado por contagem de linhas, balanceamento de chaves `{}` e checagem cruzada de que as 45 funções originais e todos os `onclick` do HTML continuam presentes):

```
index.html            → só marcação (referencia os arquivos abaixo)
css/style.css          → todo o CSS original
js/config.js           → firebaseConfig, auth, db, estado global do app
js/theme.js             → tema claro/escuro
js/auth.js              → login, cadastro, logout, estado do usuário
js/config-global.js     → config global no Firestore (categorias, assinaturas, meses)
js/meses.js             → carregar/gravar dados do mês ativo, gestão de meses
js/categorias.js        → categorias (ícones, lista) — hoje só "adicionar"
js/fixas.js             → CRUD de contas fixas + alerta de vencimento
js/faturamentos.js      → faturamentos/receitas do mês
js/assinaturas.js       → assinaturas informativas
js/calendario.js        → calendário de vencimentos
js/calculadora.js       → calculadora inteligente
js/tabelas.js           → ordenação de tabelas
js/charts.js            → gráficos (Chart.js)
js/ui.js                → navegação entre abas / toggle configurações
js/render.js            → calcularEAtualizarVisual() — função central, redesenha tudo
js/app.js               → hoje só um comentário-placeholder; vai receber o registro do
                           service worker na Fase 3
```

**Seam já preparado para a Fase 12 (compartilhamento):** ainda não foi criado (ver pendências abaixo) — os wrappers `getConfigDocRef()`/`getMesesCollectionRef()` mencionados no plano original **ainda não existem**; hoje `js/config-global.js` e `js/meses.js` continuam chamando `db.collection('users').doc(currentUser.uid)...` diretamente. Isso é a primeira coisa a fazer quando a Fase 12 começar (ou pode ser adiantado antes, para evitar reabrir os mesmos arquivos duas vezes).

**Checkpoint pendente:** o usuário ainda não confirmou visualmente que o app se comporta 100% igual após o split (eu não consegui rodar um teste automatizado em navegador neste ambiente — não havia Node, Python real nem PHP disponíveis para subir um servidor estático local, nem `chromium-cli`). **Isso deve ser a primeira coisa a validar no Claude Cowork**, já que lá há acesso a navegador: abrir `index.html`, confirmar visual idêntico ao original e checar o console (F12) por erros, antes de prosseguir para qualquer fase nova.

---

## ⏳ O que falta fazer (nesta ordem recomendada)

### Fase 2 — Toast + modal genérico + tratamento de erro
- Novo `js/toast.js` (`mostrarToast(msg, tipo, duracao, {acao})`, tipos success/error/warning/info reaproveitando as variáveis CSS de cor já existentes).
- Novo `js/modal.js` (`abrirModalConfirmacao({...})`, `abrirModalPrompt({...})`), generalizando o padrão de modal já usado em `modalFixasCalc` no HTML.
- `salvarDadosDoMesAtual()` e `salvarConfigGlobal()` (em `js/meses.js` e `js/config-global.js`) passam a propagar erro do Firestore via `.catch`, mostrando toast de erro com botão "Tentar de novo". Sem toast de sucesso a cada salvamento (evita fadiga de notificação).

### Fase 3 — PWA instalável
- `manifest.json` + `service-worker.js` (cache-first do app shell; **nunca** interceptar `firestore.googleapis.com`/`identitytoolkit.googleapis.com`, para não conflitar com o SDK do Firebase).
- Ícones PNG (192/512, incluindo variante maskable) precisam ser gerados a partir do ícone/emoji atual — é artefato binário, não gerável só por código.
- `js/app.js` recebe o registro do service worker.
- `CACHE_NAME` versionado manualmente a cada deploy que mude arquivo cacheado.

### Fase 4 — SRI (Subresource Integrity) nos CDNs
- Pinar Chart.js numa versão exata (hoje a tag usa URL "latest", incompatível com SRI) e aplicar `integrity` + `crossorigin="anonymous"`.
- Aplicar SRI também no Firebase compat SDK (URLs já versionadas em `10.12.2`).
- Google Fonts: documentar como **não aplicável** (conteúdo varia por user-agent) — não forçar SRI ali.

### Fase 5 — Editar/excluir categorias existentes
- `editarCategoriaGlobal(antigo, novo)`: propaga renomeação para `categoriasAtuais` **e** para as fixas de todos os meses (categoria é rótulo canônico global, não por mês).
- `excluirCategoriaGlobal(nome)`: bloqueia exclusão direta se a categoria estiver em uso; oferece migrar as contas existentes para outra categoria (reaproveita a função de rename como merge).
- UI: botões editar/excluir ao lado de cada categoria em Configurações (`js/categorias.js`).

### Fase 6 — Assinatura → "Adicionar às Contas Fixas"
- Hoje a lista de assinaturas só é renderizada no card do Dashboard (`#listaAssinaturasCard`) — a aba Configurações só tem o formulário de adicionar, sem lista própria. Precisa criar a lista também lá (`#listaAssinaturasConfig`).
- `renderizarAssinaturas()` único alimenta os dois lugares; cada item ganha um botão "Adicionar às Contas Fixas" que abre um modal pré-preenchido (nome/valor/vencimento + seleção de categoria) e cria uma conta fixa avulsa no mês atual ao confirmar.

### Fase 7 — Recuperação de senha
- `recuperarSenha()` em `js/auth.js`, usando `auth.sendPasswordResetEmail`.
- Link "Esqueci minha senha" na tela de login.

### Fase 8 — Confirmação/undo consistentes
- Troca os `confirm()` nativos (`copiarContasFixas`, `limparFixasDoMesAtual`) pelo modal genérico da Fase 2.
- Exclusões (fixas/faturamentos/assinaturas/categorias) passam a ser otimistas na UI: toast "Item excluído" + botão "Desfazer" por 5s antes de persistir a exclusão no Firestore. Helper único `excluirComUndo({item, restaurar, persistir})` para não duplicar a lógica.
- Trocar de mês ou fechar a aba durante a janela de undo deve forçar a persistência imediata pendente (`flushPendingDelete`).

### Fase 9 — Busca/filtro nas tabelas
- Campo de busca acima das tabelas de Contas Fixas e Faturamentos, filtro client-side por nome (+ categoria nas fixas).
- Importante: o filtro só afeta as linhas **renderizadas** — os totais do Painel de Controle e os gráficos continuam somando o array completo, não o filtrado.

### Fase 10 — Exportação CSV/PDF
- CSV gerado manualmente (sem lib, com BOM UTF-8 para acentuação no Excel).
- PDF via `jsPDF` + `jspdf-autotable` (CDN versionado, com SRI seguindo o padrão da Fase 4).
- Nova seção "Exportar Dados" em Configurações: fixas, faturamentos, relatório mensal completo.

### Fase 11 — Notificações push no navegador
- Depende do service worker (Fase 3) para usar `registration.showNotification()`.
- Nova config `notificacoes: {ativado, diasAntecedencia}` em `config/geral`.
- Checagem ao carregar o app + `setInterval` enquanto aberto; dedupe via `localStorage` + `tag` para não repetir no mesmo dia.
- Limitação já aceita: não dispara com o navegador totalmente fechado.

### Fase 12 — Compartilhamento de orçamento multi-usuário (mais arriscada, por último)
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
1. **Confirmar visualmente** que o app funciona 100% igual após o split da Fase 1 (primeira coisa a fazer no Cowork).
2. Confirmar que aplicou o `firestore.rules` da Fase 0 no Console do Firebase.
3. Antes de publicar as regras finais da Fase 12 (compartilhamento) — revisão conjunta no Rules Playground.

## Arquivos-chave do repositório hoje
- `index.html`, `css/style.css`, `js/*.js` — estrutura atual pós-Fase 1
- `firestore.rules` — versão pessoal (Fase 0); versão final compartilhada vem na Fase 12
- `PLANO-EVOLUCAO.md` — este documento
