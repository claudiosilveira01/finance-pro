# Planner Financeiro — Contexto Completo do Projeto

> Documento vivo, mantido pelo Claude a cada atualização relevante do app. Cole isto no início de
> uma conversa nova (fora do Claude Code) pra qualquer IA ter o contexto completo do projeto sem
> precisar acessar o repositório.

## O que é o projeto

App pessoal de controle financeiro do Claudio ("Planner Financeiro" / finance-pro): contas fixas,
receitas, extrato bancário (Nubank), assinaturas, acumulado por categoria, calendário de
vencimentos. 100% client-side (HTML/CSS/JS puro, sem framework, sem build). Repositório GitHub:
`claudiosilveira01/finance-pro`, deploy automático no Vercel a cada push na `main`.

## Arquitetura

- **Sem backend próprio.** Firebase Auth (login) + Firestore (banco de dados) direto do
  navegador, via SDK compat (`firebase-app-compat.js` etc., CDN com SRI). Sem Cloud Functions,
  sem plano Blaze — decisão de escopo fechada com o usuário, não reabrir.
- **Estrutura de dados no Firestore:**
  - `users/{uid}/config/geral` — categorias, assinaturas, lista de meses, `ocultarCardAcumulado`,
    `pushTokens` (mapa `deviceId -> token` do FCM), `notificacoesEnviadas` (dedup de avisos).
  - `users/{uid}/meses/{AAAA-MM}` — fixas, faturamentos, saldo, extrato (do mês).
- **Arquivos principais:** `index.html` (marcação), `css/style.css`, 25 arquivos em `js/*.js`
  (um por responsabilidade — `config.js`, `config-global.js`, `auth.js`, `meses.js`, `fixas.js`,
  `faturamentos.js`, `assinaturas.js`, `categorias.js`, `extrato.js`, `calendario.js`,
  `calculadora.js`, `filtros.js`, `tabelas.js`, `charts.js`, `render.js`, `exportar.js`,
  `modal.js`, `undo.js`, `toast.js`, `ui.js`, `theme.js`, `anim.js`, `pwa.js`,
  `verificacaoEmail.js`, `app.js`), `manifest.json` + `firebase-messaging-sw.js` (PWA),
  `PLANO-EVOLUCAO.md` (changelog técnico detalhado, este arquivo é um resumo dele pra uso fora do
  repo) e `EXPLORACAO_FINANCE_PRO.md` (varredura de arquitetura + auditoria de código).
- **Nome exibido no app ainda é "Planner Financeiro"** (título da aba, tela de login,
  `manifest.json`) — ainda não foi rebatizado para "Finance Pro" no próprio app.
- **Automação externa:** `automacao-email-nubank/Code.gs`, um projeto Google Apps Script separado
  (roda na conta `claudio.silveira.gg@gmail.com`, gatilho de tempo a cada 1h). Lê e-mails
  "Extrato da sua conta do Nubank" (assunto fixo, enviado pelo Nubank só quando alguém pede um
  extrato manualmente no app dele — não é automático do banco), pega o anexo `.csv`, escreve
  direto no Firestore via API REST autenticada com uma conta de serviço do Google Cloud
  (`firebase-adminsdk-fbsvc@finance-pro-v1`, papel "Cloud Datastore User"). No mesmo gatilho,
  também roda o aviso de vencimento por push (ver abaixo).

## Funcionalidades entregues (mais recentes primeiro)

### Relatório Mensal Completo em PDF (2026-08-24)
Botão "Relatório Mensal (PDF)" agora exporta tudo, não só Receitas + Contas Fixas: adicionado
Extrato Bancário (resumo + tabela completa) e Gastos por Categoria (com os gráficos de pizza e
barra como imagem dentro do PDF). Cada seção some do relatório se não tiver dado nenhum naquele
mês. Extrato de cartão de crédito foi cogitado (usuário mandou CSV + PDF de fatura do Nubank pra
eu aprender o formato) mas **cancelado pelo próprio usuário antes de codar** — achou desnecessário
por ora. **Não testado visualmente**: o ambiente onde foi implementado bloqueia os CDNs que o app
usa (Chart.js, jsPDF, Firebase), só deu pra revisar o código — pedir pro usuário conferir o PDF
gerado depois do deploy.

### Correção: Saldo Estimado somando receita em dobro (2026-08-21)
Usuário reportou que "Falta/Sobra" no Painel de Controle mostrava R$ 2.000,44 quando o esperado
era ~R$ 33. Causa: o cálculo somava **todas** as receitas do mês, inclusive uma já recebida dias
antes — que já estava embutida no campo "Caixa Atual", entrando em dobro. Corrigido em
`js/render.js`: só entram no Saldo Estimado as receitas com data **futura** à data de hoje.
Validado com os números reais do usuário (bateu exato). Ver PR #6.

### Card Receitas: layout mobile + botão de data (2026-08-21)
Origem ganhou linha própria no mobile (mais espaço); Valor/Data/Adicionar foram pra uma segunda
linha. Nos dois tamanhos de tela, o campo de data virou um botão compacto com ícone de calendário.
Primeira versão usava `showPicker()` num input escondido — falhava em silêncio no Safari/iPhone.
Corrigido colocando o input de data real (invisível) por cima do botão, do mesmo tamanho — o
toque abre o calendário nativo direto. Ver PRs #6 e #7.

### Correção: deduplicação do extrato podia descartar transações reais (2026-08-21)
Achado da auditoria de código do mesmo dia. `_extratoChave()`/`_extratoMesclar()`
(`js/extrato.js`) tratavam duas transações reais e distintas com data+tipo+item+valor+direção
idênticos (ex.: dois Pix de R$ 20 pro mesmo favorecido, no mesmo dia) como se fossem a mesma
duplicada — a segunda era descartada mesmo na primeira importação do PDF, e as duas ficavam com
o mesmo `id` (excluir uma pela lixeira sempre removia a primeira). Corrigido contando por
ordinal: só é duplicata de reimportação se já existir uma quantidade igual ou maior da mesma
chave no mês. Reimportar o mesmo PDF continua sem duplicar nada. Validado com 3 cenários
automatizados.

### Auditoria de código (2026-08-21)
Varredura completa do front-end e do `Code.gs`. Corrigido: `alert()`/`confirm()` nativos
remanescentes em `js/meses.js` (função de copiar contas fixas entre meses), substituídos por
`mostrarToast()` pra bater com o padrão usado no resto do app. Nenhuma função morta, `id`
duplicado ou `console.log` esquecido encontrados. As `diagnosticarExtratoMes_`/
`removerDuplicatasExtrato_` (citadas abaixo como adicionadas ao `Code.gs`, mas ausentes do
arquivo do repositório) foram confirmadas pelo usuário como resolvidas — eram ferramentas
pontuais usadas direto no editor do Apps Script, não uma feature permanente do sistema.

### Correção de bug: card Extrato somando valor errado (2026-07) ✅ resolvido
Usuário reportou que o total do card não batia com o extrato real do banco (CSV anexado).
Causa suspeita: duplicação de transações no Firestore (dois caminhos de importação diferentes —
upload manual de PDF vs. importação automática por e-mail/CSV — usam chaves de deduplicação
diferentes, então a mesma transação real pode entrar duas vezes se os textos do "item" não
baterem exatamente). Corrigido usando `diagnosticarExtratoMes_(mesKey)`/
`removerDuplicatasExtrato_(mesKey)` direto no editor do Apps Script (nunca commitadas neste
`Code.gs` — eram ferramentas pontuais de diagnóstico/limpeza, não uma feature permanente).
**Status: confirmado pelo usuário em 21/08/2026 que o bug foi resolvido.**

### Card Extrato Bancário — UX (2026-07)
- Rótulos curtos + ícone por tipo de transação (ex.: "Recebido Pix").
- Resumo por tipo sempre agrupado Entradas/Saídas, com botão pra alternar A-Z ↔ maior valor, e
  barra de fundo proporcional ao valor de cada tipo.
- Clicar num tipo do resumo abre um modal só com as transações daquele tipo.
- Modal "Ver detalhes" bem maior (`.modal-xl`), com coluna Data, busca por texto, filtro
  Entrada/Saída e ordenação por coluna.
- Botão pra apagar todo o extrato do mês (com confirmação).

### Assinaturas
- Sempre ordenadas por dia de vencimento.
- Badge "Faturado"/"Faturar" por mês (`faturadoEm` guarda o mês em que foi marcado — reseta
  sozinho, sem rotina de limpeza) ao lado da tag de vencimento (nunca some).
- Campo de categoria (classificação), reaproveitando as categorias globais.
- Menu de ações (⋮) por assinatura: Faturar / Adicionar às Contas Fixas / Classificação / Excluir.

### Acumulado por Categoria
Toggle em Configurações pra ocultar/mostrar o card inteiro (usuário não usa muito).

### Notificação push de vencimento (PWA + FCM + Apps Script)
Pedido: avisar no celular quando algo está vencendo, sem precisar abrir o app — 3 dias antes e no
dia. Cogitou-se WhatsApp via Evolution API (Docker), descartado por depender do PC do usuário
ligado e exigir expor o container pra internet. Solução final, sem Cloud Function/Blaze:
- App instalável (PWA): `manifest.json`, ícones (gradiente roxo + seta ascendente, gerados
  localmente, sem depender de nenhum logo pré-existente), `firebase-messaging-sw.js` (service
  worker: instalabilidade + recebe push em segundo plano).
- Botão "Ativar notificações de vencimento" em Configurações → registra o dispositivo no
  Firebase Cloud Messaging, salva o token em `config/geral.pushTokens` (mapa `deviceId -> token`;
  `deviceId` fica no `localStorage`).
- **Limitação real descoberta:** no iPhone, remover o PWA da tela de início e reinstalar apaga o
  `localStorage`, gerando um `deviceId` novo e deixando o antigo órfão no Firestore — causa
  notificação duplicada. Mitigação: botão "Notificação duplicada ou com problema? Resetar" em
  Configurações, que limpa todos os dispositivos cadastrados de uma vez (usuário reativa de novo
  em cada aparelho).
- Apps Script: `verificarVencimentosEEnviarPush()`, chamada no fim de `processarExtratosNubank()`
  (reaproveita o mesmo gatilho horário). Verifica assinaturas (pulando as já faturadas do mês) e
  contas fixas do mês atual (pulando as já pagas); manda push via API do FCM usando a mesma conta
  de serviço do Firestore (JWT com escopo `firebase.messaging` adicionado).
- Chave VAPID pública gerada no Firebase Console, embutida no código (é pública, sem risco).

### Automação de extrato por e-mail (Nubank → Firestore)
Ver seção "Arquitetura" acima. Validado com dados reais, sem duplicar em reimportação (antes do
bug de julho/2026 acima).

### Redesign visual "Roxo Tech" (fases anteriores)
Paleta roxa (`--gradient-btn`: `#7C6FF0` → `#5B3FD6`), animações de entrada, odômetro nos números,
tabelas compactas responsivas via `@container` (não vira cards empilhados no mobile, só aperta
padding/fonte). Ver `PLANO-EVOLUCAO.md` pra histórico completo fase a fase.

## Decisões de escopo fechadas (não reabrir)

- Sem Cloud Functions / sem plano Blaze.
- Compartilhamento de orçamento multi-usuário: **cancelado** pelo usuário.
- Assinaturas continuam informativas por padrão (não entram automaticamente no orçamento fixo).
- **Toda mudança de UI/UX precisa ser validada no mobile também**, não só desktop — princípio
  permanente pedido pelo usuário.

## Preferências de comunicação do usuário (Claudio)

- **Não é programador**, mas entende de informática e está aprendendo aos poucos. Respostas
  devem ser curtas, sem jargão técnico, a menos que ele peça detalhe.
- Sempre informar **quais sites/apps/plataformas** serão acessados e se precisa de **acesso ao
  PC** dele.
- **Regra em vigor desde 2026-07-27 (até ele avisar o contrário):** responder só UMA VEZ, ao
  final de todo o processo — sem comentários a cada passo intermediário. Resposta final objetiva,
  pra economizar tokens.
- **Regra em vigor desde 2026-08-21:** commitar, enviar ao GitHub **e mesclar direto na `main`**
  automaticamente ao final de cada rodada de mudanças testada, sem perguntar antes — o usuário
  quer a mudança valendo em produção (Vercel) o quanto antes.

## Onde encontrar mais detalhes

- `PLANO-EVOLUCAO.md` (na raiz do repositório) — changelog técnico completo, fase por fase, com
  detalhes de implementação, bugs encontrados/corrigidos e decisões de design.
- `EXPLORACAO_FINANCE_PRO.md` (na raiz do repositório) — mapa de arquitetura/arquivos + seção de
  auditoria de código (bugs, código morto, inconsistências encontradas e o que ainda depende de
  confirmação do usuário).
- `automacao-email-nubank/SETUP.md` — passo a passo de configuração da automação de e-mail.
