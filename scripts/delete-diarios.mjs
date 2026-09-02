// One-off: remove o campo obsoleto `diarios` dos docs users/*/meses/* no Firestore.
// A feature `diarios` (lançamentos avulsos de PIX, jan–mai/2026) foi abandonada pelo app;
// nunca foi importada pro Supabase. O usuário decidiu descartá-la.
// Uso: node scripts/delete-diarios.mjs

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const svc = JSON.parse(readFileSync(new URL('../firebase-service.json', import.meta.url)));
initializeApp({ credential: cert(svc) });
const db = getFirestore();

let removidos = 0;
const userDocs = await db.collection('users').listDocuments();
for (const ref of userDocs) {
  const meses = await ref.collection('meses').get();
  for (const doc of meses.docs) {
    if (doc.get('diarios') !== undefined) {
      const n = (doc.get('diarios') || []).length;
      await doc.ref.update({ diarios: FieldValue.delete() });
      console.log(`  ${ref.id}/meses/${doc.id}: removido diarios (${n} itens)`);
      removidos++;
    }
  }
}
console.log(`\nPronto — campo diarios removido de ${removidos} doc(s).`);
