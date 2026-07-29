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
- **Arquivos principais:** `index.html` (tudo), `css/style.css`, `js/*.js` (um arquivo por
  responsabilidade: `config.js`, `auth.js`, `config-global.js`, `fixas.js`, `faturamentos.js`,
  `assinaturas.js`, `extrato.js`, `calendario.js`, `render.js`, `ui.js`, `modal.js`, `pwa.js`
  etc.), `manifest.json` + `firebase-messaging-sw.js` (PWA), `PLANO-EVOLUCAO.md` (changelog
  técnico detalhado, este arquivo é um resumo dele pra uso fora do repo).
- **Automação externa:** `automacao-email-nubank/Code.gs`, um projeto Google Apps Script separado
  (roda na conta `claudio.silveira.gg@gmail.com`, gatilho de tempo a cada 1h). Lê e-mails
  "Extrato da sua conta do Nubank" (assunto fixo, enviado pelo Nubank só quando alguém pede um
  extrato manualmente no app dele — não é automático do banco), pega o anexo `.csv`, escreve
  direto no Firestore via API REST autenticada com uma conta de serviço do Google Cloud
  (`firebase-adminsdk-fbsvc@finance-pro-v1`, papel "Cloud Datastore User"). No mesmo gatilho,
  também roda o aviso de vencimento por push (ver abaixo).

## Funcionalidades entregues (mais recentes primeiro)

### Correção de bug: card Extrato somando valor errado (2026-07)
Usuário reportou que o total do card não batia com o extrato real do banco (CSV anexado).
Causa suspeita: duplicação de transações no Firestore (dois caminhos de importação diferentes —
upload manual de PDF vs. importação automática por e-mail/CSV — usam chaves de deduplicação
diferentes, então a mesma transação real pode entrar duas vezes se os textos do "item" não
baterem exatamente). Adicionadas ao `Code.gs`: `diagnosticarExtratoMes_(mesKey)` (loga duplicatas
e totais reais) e `removerDuplicatasExtrato_(mesKey)` (remove duplicatas exatas — mesma
data+tipo+item+valor+direção+idOrigem — preservando pares legítimos que compartilham o mesmo
Identificador do Nubank, como "Valor adicionado por cartão de crédito" + Pix pareado).
**Status: correção de dados em andamento — ver PLANO-EVOLUCAO.md pra situação atualizada.**

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
- Commitar e enviar ao GitHub automaticamente ao final de cada rodada de mudanças testada, sem
  perguntar antes.

## Onde encontrar mais detalhes

- `PLANO-EVOLUCAO.md` (na raiz do repositório) — changelog técnico completo, fase por fase, com
  detalhes de implementação, bugs encontrados/corrigidos e decisões de design.
- `automacao-email-nubank/SETUP.md` — passo a passo de configuração da automação de e-mail.
