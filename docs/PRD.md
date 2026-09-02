# PRD — Migração Finance PRO: Firebase + Vercel → Supabase + Cloudflare

Ver plano completo aprovado em `docs/ESTADO-MIGRACAO.md` (estado vivo) e `docs/AUDITORIA.md`
(varredura original + status do endurecimento). Este arquivo referencia a decisão de
arquitetura tomada:

- Unificação em GitHub → Cloudflare Workers → Supabase.
- App vanilla JS servido como assets estáticos (`public/`), sem build step.
- Auth real (Supabase Auth) substituindo Firebase Auth. As contas são **migradas com o hash
  de senha preservado** (Firebase usa `SCRYPT`, que o Supabase Auth verifica nativamente) —
  ninguém precisa redefinir a senha. Ferramenta: `supabase-community/firebase-to-supabase`
  (pasta `/auth`). Cadastro público fica desativado.
- Dados por usuário via RLS (`auth.uid()`), acesso por RPCs que espelham o `.set()` de
  documento inteiro do modelo Firestore atual.
- Sem Realtime, sem fila de sync — o app não usa nenhum dos dois hoje.
- Push (FCM) removido nesta rodada.
