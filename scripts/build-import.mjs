// Passo 4 — gera o SQL de importação para o Supabase a partir dos exports do Firebase.
//
// Entrada:  firebase-users.json, firestore-export.json, firebase-hash-config.json
// Saída:    out/auth.sql, out/data-<email>.sql (um por usuário), firebase-users-map.json,
//           diarios-backup.json (feature legada, não importada)
//
// A camada de dados é importada chamando as MESMAS RPCs que o app usa (salvar_config /
// salvar_mes), impersonando cada usuário via request.jwt.claims — assim o transform
// camelCase→snake_case e todos os casos de borda já testados são reaproveitados.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const users = JSON.parse(readFileSync(new URL('../firebase-users.json', import.meta.url)));
const fireData = JSON.parse(readFileSync(new URL('../firestore-export.json', import.meta.url)));
const hash = JSON.parse(readFileSync(new URL('../firebase-hash-config.json', import.meta.url)));

mkdirSync(new URL('../out/', import.meta.url), { recursive: true });

// uuid v5-ish determinístico a partir do firebase uid (re-executável)
function uidToUuid(fbuid) {
  const h = createHash('sha256').update('finance-pro:' + fbuid).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante
  const hex = b.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// base64url (Firebase) -> base64 padrão (GoTrue)
const b64 = s => (s || '').replace(/-/g, '+').replace(/_/g, '/');
const sqlStr = s => "'" + String(s).replace(/'/g, "''") + "'";
const jsonbLit = o => sqlStr(JSON.stringify(o)) + '::jsonb';

const authByUid = Object.fromEntries(users.map(u => [u.uid, u]));
const map = {};
let extratoIdSeq = 9_000_000_000_000; // ids novos p/ extrato (nada referencia extrato.id)
const diariosBackup = {};

// ---------- AUTH ----------
let authSql = '-- Passo 4: usuários (senha SCRYPT preservada via formato $fbscrypt$ do GoTrue)\n\n';
for (const u of users) {
  if (!u.email) { console.warn('pulado (sem email):', u.uid); continue; }
  const id = uidToUuid(u.uid);
  map[u.uid] = { supabase_uuid: id, email: u.email };

  const fb = `$fbscrypt$v=1,n=${hash.mem_cost},r=${hash.rounds},p=1,ss=${hash.base64_salt_separator},sk=${hash.base64_signer_key}$${b64(u.passwordSalt)}$${b64(u.passwordHash)}`;
  const created = u.creationTime ? new Date(u.creationTime).toISOString() : new Date().toISOString();

  authSql += `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${sqlStr(id)}, 'authenticated', 'authenticated', ${sqlStr(u.email)}, ${sqlStr(fb)}, ${sqlStr(created)}, ${sqlStr(created)}, now(), ${u.lastSignInTime ? sqlStr(new Date(u.lastSignInTime).toISOString()) : 'null'}, '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (${sqlStr(id)}, ${sqlStr(id)}, ${jsonbLit({ sub: id, email: u.email, email_verified: u.emailVerified, phone_verified: false })}, 'email', now(), ${sqlStr(created)}, now())
on conflict (provider, provider_id) do nothing;\n\n`;
}
writeFileSync(new URL('../out/auth.sql', import.meta.url), authSql);
writeFileSync(new URL('../firebase-users-map.json', import.meta.url), JSON.stringify(map, null, 2));

// ---------- DADOS ----------
const _num = v => (v === null || v === undefined || v === '' ? 0 : Number(v));

function buildConfig(cfg) {
  cfg = cfg || {};
  return {
    categorias: Array.isArray(cfg.categorias) ? cfg.categorias : [],
    ocultarCardAcumulado: !!cfg.ocultarCardAcumulado,
    ocultarCardCartoes: !!cfg.ocultarCardCartoes,
    assinaturas: (cfg.assinaturas || []).map(a => ({
      id: a.id, nome: a.nome, valor: _num(a.valor), vencimento: a.vencimento,
      categoria: a.categoria ?? 'Outros', faturadoEm: a.faturadoEm ?? null,
    })),
    cartoesConfig: (cfg.cartoesConfig || []).map(c => ({
      id: c.id, nome: c.nome, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento,
    })),
  };
}

function buildMes(m) {
  m = m || {};
  return {
    saldo: _num(m.saldo),
    fixas: (m.fixas || []).map(f => ({
      id: f.id, nome: f.nome, valor: _num(f.valor), vencimento: f.vencimento,
      categoria: f.categoria ?? 'Outros', obs: f.obs ?? '', pago: !!f.pago,
      origemCartaoId: f.origemCartaoId ?? null,
    })),
    faturamentos: (m.faturamentos || []).map(x => ({
      id: x.id, nome: x.nome, valor: _num(x.valor), data: x.data, noCaixa: !!x.noCaixa,
    })),
    extrato: (m.extrato || []).map(x => ({
      id: ++extratoIdSeq, data: x.data, tipo: x.tipo ?? '', item: x.item ?? '',
      valor: _num(x.valor), direcao: x.direcao === 'entrada' ? 'entrada' : 'saida',
    })),
    registroPagamentos: (m.registroPagamentos || []).map(r => ({
      id: r.id, contaId: r.contaId, nome: r.nome, valor: _num(r.valor),
      marcadoComoPago: !!r.marcadoComoPago, tipo: r.tipo === 'assinatura' ? 'assinatura' : 'fixa',
      dataPagamento: r.dataPagamento ?? null, registradoEm: r.registradoEm ?? null,
    })),
    cartoesFaturas: Object.fromEntries(Object.entries(m.cartoesFaturas || {}).map(([cid, f]) => [cid, {
      valorConfirmado: f.valorConfirmado ?? null,
      valorEstimado: f.valorEstimado ?? null,
      _creditosImportados: f._creditosImportados ?? [],
      transacoes: (f.transacoes || []).map(t => ({
        id: t.id, descricao: t.descricao, valor: _num(t.valor), data: t.data,
        categoria: t.categoria ?? 'Outros', origemImportId: t.origemImportId ?? null,
      })),
    }])),
  };
}

let totals = { meses: 0, fixas: 0, faturamentos: 0, extrato: 0, registro: 0, cartaoFat: 0, cartaoTrans: 0, assin: 0 };

for (const [fbuid, entry] of Object.entries(fireData)) {
  const u = authByUid[fbuid];
  if (!u || !u.email) { console.warn('Firestore sem conta Auth — PULADO:', fbuid); continue; }
  const id = map[fbuid].supabase_uuid;

  // diarios (feature legada) -> backup, fora do import
  for (const [mk, m] of Object.entries(entry.meses)) {
    if (m.diarios && m.diarios.length) {
      diariosBackup[u.email] = diariosBackup[u.email] || {};
      diariosBackup[u.email][mk] = m.diarios;
    }
  }

  const cfg = buildConfig(entry.config);
  totals.assin += cfg.assinaturas.length;

  const claims = JSON.stringify({ sub: id, role: 'authenticated', email: u.email });
  let sql = `-- ${u.email}  (firebase ${fbuid} -> ${id})\nbegin;\nset local role authenticated;\nset local request.jwt.claims to ${sqlStr(claims)};\n\n`;
  sql += `select public.salvar_config(${jsonbLit(cfg)});\n\n`;

  const monthKeys = [...new Set([
    ...(entry.config?.meses || []).map(x => x.key).filter(Boolean),
    ...Object.keys(entry.meses),
  ])].sort();

  for (const mk of monthKeys) {
    const mes = buildMes(entry.meses[mk]);
    totals.meses++;
    totals.fixas += mes.fixas.length;
    totals.faturamentos += mes.faturamentos.length;
    totals.extrato += mes.extrato.length;
    totals.registro += mes.registroPagamentos.length;
    for (const f of Object.values(mes.cartoesFaturas)) { totals.cartaoFat++; totals.cartaoTrans += f.transacoes.length; }
    sql += `select public.salvar_mes(${sqlStr(mk)}, ${jsonbLit(mes)});\n`;
  }

  sql += `\ncommit;\n`;
  const safe = u.email.replace(/[^a-z0-9]+/gi, '_');
  writeFileSync(new URL(`../out/data-${safe}.sql`, import.meta.url), sql);
  console.log(`  ${u.email}: ${monthKeys.length} meses -> out/data-${safe}.sql`);
}

// criado_em derivado do ano_mes
const uuids = Object.values(map).map(m => `'${m.supabase_uuid}'`).join(', ');
writeFileSync(new URL('../out/finalize.sql', import.meta.url),
  `-- criado_em das linhas de meses derivado do proprio ano_mes\nupdate public.meses set criado_em = (ano_mes || '-01')::timestamptz\n where user_id in (${uuids});\n`);

writeFileSync(new URL('../diarios-backup.json', import.meta.url), JSON.stringify(diariosBackup, null, 2));

console.log('\nTOTAIS esperados no Supabase apos import:', JSON.stringify(totals, null, 1));
console.log('Arquivos: out/auth.sql, out/data-*.sql, out/finalize.sql, firebase-users-map.json, diarios-backup.json');
