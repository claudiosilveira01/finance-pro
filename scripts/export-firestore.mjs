// Placeholder — implementado no Passo 4 da migração (ver docs/ESTADO-MIGRACAO.md).
//
// AUTH (senhas preservadas, sem reset):
//   Não é feito por este script. Usar o repo oficial da comunidade Supabase
//   `supabase-community/firebase-to-supabase`, pasta /auth:
//     1. firebase-service.json  = chave do Admin SDK do Firebase
//     2. supabase-service.json  = conexão do Postgres (Session pooler do dashboard)
//     3. Password hash parameters do Firebase (Console → Authentication → Users → ⋮)
//     4. node firestoreusers2json.js users.json   (exporta usuários + hash SCRYPT + salt)
//     5. node import_users.js users.json          (insere em auth.users, senha preservada)
//   Depois: montar o mapa firebase_uid → supabase_uid (por e-mail) pro import dos dados.
//
// DADOS (Firestore → Postgres):
//   Este script vai usar firebase-admin + scripts/serviceAccountKey.json (gitignored) para
//   exportar users/*/config/* e users/*/meses/* para firestore-export.json. O transform
//   (camelCase→snake_case, IDs, categorias, arrays ausentes→[]) e a geração do SQL de import
//   (on conflict do nothing, criado_em derivado das datas reais) são feitos na sequência.
//   NÃO usar o json2supabase.js genérico do repo acima — ele faz dump direto e o nosso
//   schema é relacional reshapeado (10 tabelas, RPCs).
