// Passo 4 — aplica os SQLs de importação no Supabase via conexão Postgres direta.
// Uso: node scripts/run-import.mjs "<DB_PASSWORD>"
// (a senha vem como argumento pra não ficar em arquivo)

import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';

const password = process.argv[2];
if (!password) { console.error('Falta a senha do banco como argumento.'); process.exit(1); }

const hosts = [
  { host: 'db.jasrlsyfsbagnkkhifxq.supabase.co', port: 5432, user: 'postgres' },
  { host: 'aws-1-sa-east-1.pooler.supabase.com', port: 5432, user: 'postgres.jasrlsyfsbagnkkhifxq' },
  { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432, user: 'postgres.jasrlsyfsbagnkkhifxq' },
];

let client;
for (const h of hosts) {
  const c = new pg.Client({ ...h, database: 'postgres', password, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try { await c.connect(); client = c; console.log('conectado via', h.host); break; }
  catch (e) { console.log('falhou', h.host, '-', e.message); }
}
if (!client) { console.error('Não conectou em nenhum host.'); process.exit(1); }

const dir = new URL('../out/', import.meta.url);
const files = readdirSync(dir).filter(f => /^claudio-\d+\.sql$/.test(f)).sort();
files.push('finalize.sql');

for (const f of files) {
  const sql = readFileSync(new URL(f, dir), 'utf8');
  process.stdout.write(`aplicando ${f} ... `);
  try { await client.query(sql); console.log('ok'); }
  catch (e) { console.log('ERRO:', e.message); await client.end(); process.exit(1); }
}

// ---------- validação ----------
const { rows } = await client.query(`
  select u.email,
    (select count(*) from public.meses m where m.user_id=u.id) meses,
    (select count(*) from public.fixas x where x.user_id=u.id) fixas,
    (select count(*) from public.faturamentos x where x.user_id=u.id) faturamentos,
    (select count(*) from public.extrato x where x.user_id=u.id) extrato,
    (select count(*) from public.registro_pagamentos x where x.user_id=u.id) registro,
    (select count(*) from public.assinaturas x where x.user_id=u.id) assinaturas,
    (select count(*) from public.cartoes x where x.user_id=u.id) cartoes,
    (select coalesce(sum(valor),0) from public.extrato x where x.user_id=u.id) soma_extrato,
    (select coalesce(sum(valor),0) from public.fixas x where x.user_id=u.id) soma_fixas
  from auth.users u
  where u.email in ('carlaalinny36@gmail.com','familia@email.com','patricia@email.com','claudio@financas.com')
  order by u.email`);
console.table(rows);

const tot = await client.query(`select
  (select count(*) from public.meses) meses,
  (select count(*) from public.fixas) fixas,
  (select count(*) from public.faturamentos) faturamentos,
  (select count(*) from public.extrato) extrato,
  (select count(*) from public.registro_pagamentos) registro,
  (select count(*) from public.assinaturas) assinaturas`);
console.log('TOTAIS no banco:', tot.rows[0]);

await client.end();
console.log('feito.');
