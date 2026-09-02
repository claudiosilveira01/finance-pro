// Edge Function: avisos de vencimento por Web Push (VAPID). Substitui o
// verificarVencimentosEEnviarPush do antigo Apps Script (Firebase Cloud Messaging).
//
// Roda 1x/dia via pg_cron (ver 0010_cron_avisos.sql): para cada usuário com push
// subscription, olha assinaturas (config) + contas fixas do mês atual e, pra cada uma
// vencendo HOJE ou em 3 DIAS que ainda não foi avisada, manda uma notificação.
//
// Autenticação: header x-cron-secret == env CRON_SECRET. Sem isso, 401.
//
// Secrets necessários (supabase secrets set / painel):
//   VAPID_PUBLIC_KEY   — a mesma chave pública que está no public/js/pwa.js
//   VAPID_PRIVATE_KEY  — o par privado (NUNCA no repositório / cliente)
//   VAPID_SUBJECT      — "mailto:voce@exemplo.com"
//   CRON_SECRET        — segredo compartilhado com o cron

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DIAS_DE_AVISO = [3, 0];
const TZ = "America/Sao_Paulo";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:financeiro@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let vapidPronto = false;
function garantirVapid() {
  if (vapidPronto) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidPronto = true;
}

// dia/mês/ano de "hoje" no fuso de Brasília
function hojeBRT() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { ano: get("year"), mes: get("month"), dia: get("day") };
}

const ymKey = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

// dias até o "dia diaVenc" — testa a ocorrência deste mês e a do mês que vem
// (pra pegar "vence dia 2, hoje é 30"). Retorna o menor não-negativo, ou null.
function diasAteVencimento(hoje: { ano: number; mes: number; dia: number }, diaVenc: number): number | null {
  if (!diaVenc || diaVenc < 1 || diaVenc > 31) return null;
  const base = Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia);
  const candidatos = [
    Date.UTC(hoje.ano, hoje.mes - 1, diaVenc),
    Date.UTC(hoje.ano, hoje.mes, diaVenc),
  ];
  let melhor: number | null = null;
  for (const c of candidatos) {
    const d = Math.round((c - base) / 86400000);
    if (d >= 0 && (melhor === null || d < melhor)) melhor = d;
  }
  return melhor;
}

const brl = (n: number) => `R$ ${Number(n || 0).toFixed(2)}`;

async function enviarPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) {
  return await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  );
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "secrets não configurados (VAPID_*/SERVICE_ROLE)" }), { status: 500 });
  }
  garantirVapid();

  const hoje = hojeBRT();
  const mesAtual = ymKey(hoje.ano, hoje.mes);

  const { data: subs, error: subErr } = await sb
    .from("push_subscriptions")
    .select("user_id, device_id, endpoint, p256dh, auth");
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });

  // agrupa subscriptions por usuário
  const porUsuario = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    if (!porUsuario.has(s.user_id)) porUsuario.set(s.user_id, []);
    porUsuario.get(s.user_id)!.push(s);
  }

  let enviados = 0;
  let subsRemovidas = 0;
  const resumo: Record<string, number> = {};

  for (const [userId, userSubs] of porUsuario) {
    // já avisados deste usuário
    const { data: jaAvisados } = await sb
      .from("avisos_enviados").select("chave").eq("user_id", userId);
    const jaSet = new Set((jaAvisados ?? []).map((r) => r.chave));

    // fixas do mês atual + assinaturas (globais)
    const [{ data: fixas }, { data: assinaturas }] = await Promise.all([
      sb.from("fixas").select("id, nome, valor, vencimento, pago")
        .eq("user_id", userId).eq("ano_mes", mesAtual),
      sb.from("assinaturas").select("id, nome, valor, vencimento, faturado_em")
        .eq("user_id", userId),
    ]);

    const avisos: { chave: string; titulo: string; corpo: string }[] = [];

    for (const sub of assinaturas ?? []) {
      if (sub.faturado_em === mesAtual) continue;
      const d = diasAteVencimento(hoje, sub.vencimento);
      if (d === null || !DIAS_DE_AVISO.includes(d)) continue;
      const chave = `assinatura-${sub.id}-${mesAtual}-${d}`;
      if (jaSet.has(chave)) continue;
      avisos.push({
        chave,
        titulo: d === 0 ? `Vence hoje: ${sub.nome}` : `Vence em ${d} dias: ${sub.nome}`,
        corpo: sub.valor ? `Assinatura — ${brl(sub.valor)}` : "Assinatura",
      });
    }

    for (const fixa of fixas ?? []) {
      if (fixa.pago) continue;
      const d = diasAteVencimento(hoje, fixa.vencimento);
      if (d === null || !DIAS_DE_AVISO.includes(d)) continue;
      const chave = `fixa-${fixa.id}-${mesAtual}-${d}`;
      if (jaSet.has(chave)) continue;
      avisos.push({
        chave,
        titulo: d === 0 ? `Vence hoje: ${fixa.nome}` : `Vence em ${d} dias: ${fixa.nome}`,
        corpo: `Conta fixa — ${brl(fixa.valor)}`,
      });
    }

    if (avisos.length === 0) continue;

    // marca como enviado ANTES de disparar (janela de corrida menor)
    await sb.from("avisos_enviados").upsert(
      avisos.map((a) => ({ user_id: userId, chave: a.chave })),
      { onConflict: "user_id,chave", ignoreDuplicates: true },
    );

    for (const aviso of avisos) {
      const payload = {
        title: aviso.titulo,
        body: aviso.corpo,
        url: "/",
      };
      for (const sub of userSubs!) {
        try {
          await enviarPush(sub, payload);
          enviados++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await sb.from("push_subscriptions").delete()
              .eq("user_id", userId).eq("device_id", sub.device_id);
            subsRemovidas++;
          } else {
            console.error("push falhou", code, (err as Error).message);
          }
        }
      }
    }
    resumo[userId] = avisos.length;
  }

  // poda avisos_enviados com mais de 60 dias
  const corte = new Date(Date.now() - 60 * 86400000).toISOString();
  await sb.from("avisos_enviados").delete().lt("enviado_em", corte);

  return new Response(
    JSON.stringify({ ok: true, mesAtual, usuarios: porUsuario.size, avisos: resumo, enviados, subsRemovidas }),
    { headers: { "Content-Type": "application/json" } },
  );
});
