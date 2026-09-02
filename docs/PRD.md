# PRD — Migração Finance PRO: Firebase + Vercel → Supabase + Cloudflare

Ver plano completo aprovado em `docs/ESTADO-MIGRACAO.md` (estado vivo) e `docs/AUDITORIA.md`
(varredura original + status do endurecimento). Este arquivo referencia a decisão de
arquitetura tomada:

- Unificação em GitHub → Cloudflare Workers → Supabase.
- App vanilla JS servido como assets estáticos (`public/`), sem build step.
- Auth real (Supabase Auth, contas recriadas do zero) substituindo Firebase Auth.
- Dados por usuário via RLS (`auth.uid()`), acesso por RPCs que espelham o `.set()` de
  documento inteiro do modelo Firestore atual.
- Sem Realtime, sem fila de sync — o app não usa nenhum dos dois hoje.
- Push (FCM) removido nesta rodada.
