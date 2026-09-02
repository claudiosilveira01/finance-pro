// Passo 4 da migração — exporta do Firebase (projeto finance-pro-v1):
//   1. Usuários do Auth, COM hash de senha SCRYPT + salt (pra migrar sem reset).
//   2. Dados do Firestore: users/{uid}/config/geral + users/{uid}/meses/{anoMes}.
//
// Saída: firebase-users.json e firestore-export.json na raiz do repo (ambos gitignored).
// Uso: node scripts/export-firebase.mjs
//
// Precisa de firebase-service.json na raiz (chave do Admin SDK).

import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const svc = JSON.parse(readFileSync(new URL('../firebase-service.json', import.meta.url)));
initializeApp({ credential: cert(svc) });

const auth = getAuth();
const db = getFirestore();

// ---------- 1. AUTH ----------
console.log('Exportando usuários do Auth...');
const users = [];
let pageToken;
do {
  const res = await auth.listUsers(1000, pageToken);
  for (const u of res.users) {
    users.push({
      uid: u.uid,
      email: u.email || null,
      emailVerified: !!u.emailVerified,
      disabled: !!u.disabled,
      passwordHash: u.passwordHash || null,   // base64 (SCRYPT)
      passwordSalt: u.passwordSalt || null,   // base64
      creationTime: u.metadata?.creationTime || null,
      lastSignInTime: u.metadata?.lastSignInTime || null,
      providers: (u.providerData || []).map(p => p.providerId),
    });
  }
  pageToken = res.pageToken;
} while (pageToken);

writeFileSync('firebase-users.json', JSON.stringify(users, null, 2));
console.log(`  ${users.length} usuários -> firebase-users.json`);
for (const u of users) {
  console.log(`    ${u.email}  (uid ${u.uid})  senha:${u.passwordHash ? 'sim' : 'NÃO'}  provedores:${u.providers.join(',')}`);
}

// ---------- 2. FIRESTORE ----------
console.log('\nExportando dados do Firestore (users/*)...');
const out = {};
const userDocs = await db.collection('users').listDocuments();
for (const ref of userDocs) {
  const uid = ref.id;
  const entry = { config: null, meses: {} };

  const configSnap = await ref.collection('config').doc('geral').get();
  if (configSnap.exists) entry.config = configSnap.data();

  const mesesSnap = await ref.collection('meses').get();
  mesesSnap.forEach(doc => { entry.meses[doc.id] = doc.data(); });

  out[uid] = entry;
  console.log(`    ${uid}: config ${entry.config ? 'ok' : '—'}, ${Object.keys(entry.meses).length} meses`);
}

writeFileSync('firestore-export.json', JSON.stringify(out, null, 2));
console.log(`\n  ${Object.keys(out).length} usuários -> firestore-export.json`);
console.log('\nPronto. firebase-users.json e firestore-export.json gerados.');
