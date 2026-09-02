# Exploração — Finance Pro (Integração Vórtex AI)

**Data original:** 28/07/2026 | **Última revisão:** 21/08/2026 | **Escopo:** Arquitetura, Features, Estratégia de Branding

> ⚠️ **Nota da revisão (21/08/2026):** a tabela de arquivos e o inventário de features abaixo
> foram atualizados para bater com o código real do repositório nesta data (varredura completa +
> auditoria). A seção 4 (branding Vortex AI) é a proposta original de 28/07 — **nenhuma dessas
> mudanças de branding foi aplicada ainda**: o app continua com o nome "Planner Financeiro" no
> `<title>`, no `manifest.json` e na tela de login. Confirmar com o usuário se essa iniciativa
> Vortex AI ainda está de pé antes de agir sobre a seção 4/6.

---

## 1. Arquitetura Atual

### Stack
- **Frontend:** HTML5 + CSS3 + Vanilla JS (sem framework, sem build)
- **Backend:** Firebase (Auth + Firestore), sem Cloud Functions
- **Hospedagem:** Vercel (deploy automático a cada push na `main`)
- **Automação externa:** Google Apps Script (`automacao-email-nubank/Code.gs`), conta separada
- **Modelo:** Single-user (pessoal, cada usuário vê seus próprios dados)

### Modularização (25 arquivos JS, ~2.484 linhas)

| Arquivo | Linhas | Responsabilidade |
|---------|--------|-----------------|
| **config.js** | 49 | Firebase config, `auth`/`db`, wrappers de referência Firestore, estado global |
| **config-global.js** | 54 | Carrega/salva `config/geral` (categorias, assinaturas, meses, flags) |
| **auth.js** | 55 | Login, cadastro, logout, recuperação de senha |
| **meses.js** | 158 | Carrega/salva dados do mês, navegação entre meses, copiar/limpar fixas |
| **fixas.js** | 203 | CRUD de contas fixas, recorrência mensal, alerta de vencimento |
| **faturamentos.js** | 55 | Receitas/entradas do mês, botão de seletor de data |
| **assinaturas.js** | 144 | Assinaturas informativas + "Adicionar às Contas Fixas" |
| **categorias.js** | 135 | CRUD de categorias com merge/rename/migração |
| **extrato.js** | 463 | **Importação de PDF de extrato bancário** (parsing client-side via pdf.js) |
| **calendario.js** | 122 | Calendário de vencimentos |
| **calculadora.js** | 81 | Calculadora inteligente (+ soma de contas fixas) |
| **filtros.js** | 63 | Filtros em cascata das contas fixas |
| **tabelas.js** | 67 | Ordenação em cascata das tabelas |
| **charts.js** | 35 | Gráficos (Chart.js) |
| **render.js** | 120 | `calcularEAtualizarVisual()` — função central de recálculo/render |
| **exportar.js** | 95 | Exportação CSV (BOM UTF-8) + relatório PDF (jsPDF + autoTable) |
| **modal.js** | 150 | Modais genéricos (confirmação, prompt, seleção, menu de contexto) |
| **undo.js** | 39 | Exclusão otimista com "Desfazer" (5s) |
| **toast.js** | 55 | Notificações toast |
| **ui.js** | 54 | Navegação entre abas, modais de calculadora/configurações, tecla Esc |
| **theme.js** | 25 | Tema claro/escuro |
| **anim.js** | 80 | Animações de entrada (IntersectionObserver) + odômetro numérico |
| **pwa.js** | 94 | Registro do service worker + notificações push (FCM) |
| **verificacaoEmail.js** | 87 | Botão "Verificar e-mail agora" (dispara a importação sob demanda) |
| **app.js** | 1 | Placeholder (registro do service worker migrou para `pwa.js`) |

**Total:** ~2.484 linhas de JS (bem organizado, um arquivo por responsabilidade), mais
`index.html` (marcação) e `css/style.css`.

---

## 2. Features Implementadas

### Core (MVP)
- ✅ Autenticação Firebase (email + senha)
- ✅ Contas Fixas (cadastro, edição, exclusão, recorrência mensal)
- ✅ Receitas (entrada manual)
- ✅ Extrato Bancário (importação de PDF, parsing automático)
- ✅ Assinaturas (controle informativo + integração em contas fixas)
- ✅ Calendário de Vencimentos
- ✅ Calculadora Inteligente (+ soma contas selecionadas)

### Avançado
- ✅ Categorização automática (com merge/rename/migração)
- ✅ Filtros em cascata + ordenação em cascata nas tabelas
- ✅ Gráficos (Chart.js)
- ✅ Tema claro/escuro (com preferência do sistema)
- ✅ Notificações push via FCM (3 dias antes + dia do vencimento)
- ✅ Exportação CSV (UTF-8 + BOM) e PDF (jsPDF + autoTable)
- ✅ PWA instalável (tela inicial iPhone/Android)
- ✅ Undo em exclusões (janela de 5s)
- ✅ Importação automática de extrato por e-mail (Google Apps Script, a cada 1h)
- ✅ Botão "Verificar e-mail agora" (dispara a importação sob demanda, sem esperar o gatilho)
- ✅ Animações de entrada (IntersectionObserver) + odômetro numérico no Painel de Controle

---

## 3. Design & Branding Atual

### Cores
```css
--gradient-purple: linear-gradient(135deg, #7C3AED, #9D4EDD); /* Violeta */
--text-highlight: #5B3FD6;  /* Roxo Vortex */
--bg-light: #F5F3FF;        /* Lavanda claro */
--bg-dark: #0F0F1A;         /* Quase preto */
--red-danger: #EF4444;      /* Vermelho alert */
--green-success: #10B981;   /* Verde success */
```

**Fonte:** Plus Jakarta Sans (Google Fonts)

**Icons:** Phosphor Icons (CDN, peso Regular)

### Componentes UI
- **Buttons:** `.btn-flat` (padding, shadow, gradient)
- **Modals:** Overlay com animação fade
- **Cards:** Com título + ícone
- **Tabelas:** Sortáveis com header destacado
- **Gráficos:** Chart.js com cores do tema

---

## 4. Integração Visual com Vortex AI

### ✅ JÁ COMPATÍVEL (Sem mudanças)

1. **Paleta de cores:** roxo/lavanda = identidade Vortex
2. **Ícones:** Phosphor Icons (mesmo que Vortex Hub pode usar)
3. **Responsividade:** mobile-first design
4. **Tema claro/escuro:** já implementado (CSS vars)

### 🔄 MUDANÇAS NECESSÁRIAS (Branding)

| Item | Mudança | Impacto |
|------|---------|--------|
| **Header** | Adicionar logo + "Vortex AI" + nav pra outros produtos | Cosmético |
| **Favicon** | Mudar ícone financeiro → Vortex AI logo | Cosmético |
| **Título página** | "Planner Financeiro" → "Finance Pro — Vortex AI" | Cosmético |
| **Footer** | Adicionar links pra `hub.vortex.ai` e `planner.vortex.ai` | Cosmético |
| **Onboarding** | Primeira tela: "Bem-vindo ao Vortex AI" em vez de só "Planner Financeiro" | UX |

**Tempo:** ~1-2 horas (CSS + HTML tweaks, sem quebrar funcionalidade)

---

## 5. Arquitetura de Dados (Firebase)

### Estrutura Firestore
```
users/{uid}/
├── config/
│   ├── categorias: [...]
│   ├── assinaturas: [...]
│   └── perfil: { nome, email, ... }
└── meses/{anoMes}/
    ├── fixas: [ { nome, valor, venc, ... } ]
    ├── faturamentos: [ { origem, valor, data, ... } ]
    └── extrato: [ { data, descricao, tipo, valor, ... } ]
```

**Segurança:** Rules isolam por `request.auth.uid` (single-user model = perfeito pra pessoal).

---

## 6. Roadmap Pós-Consolidação Vortex AI

### Fase 1 — Branding (Agora)
- [ ] Adicionar header com logo Vortex
- [ ] Atualizar favicon
- [ ] Ajustar títulos/descrições
- [ ] Testar em mobile

### Fase 2 — Integração (Depois)
- [ ] Link de navegação pra Hub/Planner no header
- [ ] Single sign-on? (hoje: Firebase auth independente)
- [ ] Sync entre Finance Pro + Hub (futuro pago)

### Fase 3 — Escalabilidade (Produção)
- [ ] Multi-user sharing (se virar feature paga)
- [ ] API backend (migração de Firebase para VPS, quando escalar)
- [ ] Integração bancária real (futuro: Open Banking API)

---

## 7. Checklist de Aceitação (Pré-Beta)

- [ ] Todas as features testadas em Firefox + Chrome + Safari
- [ ] Mobile testado em iPhone + Android (width < 390px)
- [ ] Branding Vortex AI 100% visível (logo, cores, links)
- [ ] Notificações push funcionando em 2+ dispositivos
- [ ] PDF export testado (acentuação, tabelas, layout)
- [ ] Extrato bancário testado com 3+ tipos de PDF (Nubank, Itaú, Bradesco)
- [ ] Undo e toast notifications testados
- [ ] Performance: load < 3s em 4G (Lighthouse score > 80)

---

## 8. Conclusão

**Finance Pro é 80% pronto pra integração Vortex AI.** Mudanças de branding são cosméticas (1-2h). Funcionalidade = excelente. Pronto pra produção pessoal agora; escalação (multi-user) fica pra depois se virar feature paga do Vortex.

**Recomendação:** Priorize correções no Hub (log rotation, refactor sala.php) antes de mexer no Finance Pro. Finance Pro está estável e não bloqueia desenvolvimento.

---

## 9. Auditoria de código (21/08/2026)

Varredura completa do front-end (`index.html`, `css/style.css`, todos os `js/*.js`) e do backend
externo (`automacao-email-nubank/Code.gs`), em busca de bugs, inconsistências e código morto.

### Corrigidos nesta rodada
- **`alert()`/`confirm()` nativos em `js/meses.js`** (6 ocorrências, em `copiarContasFixas()` e
  `_executarCopiaContasFixas()`) — quebravam a consistência visual do resto do app, que usa
  `mostrarToast()`/`abrirModalConfirmacao()` em todo o restante do código desde a Fase 2/8.
  Substituídos por toasts.
- Bug do **Saldo Estimado somando receita em dobro** (já recebida + prevista) — ver
  `Planner Financeiro - Contexto Completo.md` para o detalhe.
- Botão de seletor de data do card Receitas que não abria o calendário no Safari/iOS
  (`showPicker()` num input de tamanho zero) — ver mesmo documento.
- **Deduplicação do extrato podia descartar transações reais**: `_extratoChave()`/
  `_extratoMesclar()` (`js/extrato.js`) tratavam duas transações reais e distintas com
  data+tipo+item+valor+direção idênticos (ex.: dois Pix de R$ 20 pro mesmo favorecido, no mesmo
  dia) como duplicata, descartando a segunda mesmo na primeira importação do PDF — e ainda dava
  o mesmo `id` pras duas, então excluir uma pela lixeira sempre removia a primeira. Corrigido
  contando por ordinal (a Nª ocorrência de uma chave repetida só é "duplicata" se já existir uma
  quantidade igual ou maior dela no mês) — reimportar o mesmo PDF continua sem duplicar nada.

### Verificado e OK (sem ação necessária)
- Nenhum `id` HTML duplicado em `index.html`.
- Nenhuma função JS declarada e nunca referenciada (checado cruzando todo `function nome(` contra
  usos em `js/*.js` + `index.html`).
- Nenhum `console.log`/`TODO`/`FIXME` esquecido no código.
- `automacao-email-nubank/Code.gs`: lógica de deduplicação (`idOrigem`), autenticação JWT e envio
  de push revisadas — sem problemas encontrados.
- `diagnosticarExtratoMes_`/`removerDuplicatasExtrato_` (citadas no changelog de julho como
  adicionadas ao `Code.gs`, mas ausentes do arquivo do repositório) — **confirmado pelo usuário
  em 21/08/2026 que o bug daquela correção já foi resolvido**; eram ferramentas pontuais usadas
  direto no editor do Apps Script, não uma feature permanente, então não precisam existir aqui.

### Ainda em aberto (decisão do usuário necessária)
- **Nome do app**: `index.html` (`<title>`, tela de login), `manifest.json` (`name`/`short_name`)
  e `firebase-messaging-sw.js` (título de notificação) ainda usam "Planner Financeiro"/"Planner",
  não "Finance Pro". Bate com a seção 4/6 deste documento (branding Vortex AI ainda não aplicado).
