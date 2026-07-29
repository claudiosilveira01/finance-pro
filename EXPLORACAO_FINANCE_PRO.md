# Exploração — Finance Pro (Integração Vórtex AI)

**Data:** 28/07/2026 | **Escopo:** Arquitetura, Features, Estratégia de Branding

---

## 1. Arquitetura Atual

### Stack
- **Frontend:** HTML5 + CSS3 + Vanilla JS (sem framework)
- **Backend:** Firebase (Auth + Firestore)
- **Hospedagem:** Vercel (serverless)
- **Modelo:** Single-user (pessoal, cada usuário vê seus próprios dados)

### Modularização (16 arquivos JS)

| Arquivo | Linhas | Responsabilidade |
|---------|--------|-----------------|
| **index.html** | ~300 | Marcação (modais, layout, form inputs) |
| **config.js** | ~80 | Firebase config, auth/db wrappers |
| **auth.js** | ~100 | Login, signup, logout, password reset |
| **theme.js** | ~50 | Tema claro/escuro (CSS vars) |
| **fixas.js** | ~300 | CRUD contas fixas + UI |
| **faturamentos.js** | ~80 | Receitas/entradas |
| **assinaturas.js** | ~250 | Assinaturas + botão "Adicionar às Fixas" |
| **categorias.js** | ~200 | CRUD categorias com merge/rename |
| **extrato.js** | ~550 | **Importação PDF de extrato bancário** (OCR client-side) |
| **calendario.js** | ~200 | Calendário de vencimentos |
| **calculadora.js** | ~100 | Calculadora inteligente |
| **charts.js** | ~50 | Gráficos (Chart.js) |
| **render.js** | TBD | Rendering central |
| **exportar.js** | ~150 | CSV + PDF export (jsPDF) |
| **pwa.js** | ~100 | Service worker + notificações push |
| **modal.js** | ~250 | Modais genéricos (confirmação, prompt, seleção) |

**Total:** ~2.500 linhas (bem organizado, sem código monolítico).

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
- ✅ Categorização automática
- ✅ Busca/filtro em tabelas
- ✅ Gráficos (Chart.js)
- ✅ Tema claro/escuro (com preferência do sistema)
- ✅ Notificações push (3 dias antes + dia vencimento)
- ✅ Exportação CSV (UTF-8 + BOM)
- ✅ Exportação PDF (jsPDF + tabelas automáticas)
- ✅ PWA instalável (tela inicial iPhone/Android)
- ✅ Undo em deletions (5s window)

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
