-- Fase 3: notificações de vencimento via Web Push nativo (VAPID), sem Firebase.
--
-- push_subscriptions: uma linha por (usuário, aparelho). device_id vem do localStorage do
-- cliente (identidade estável do aparelho); re-inscrever no mesmo aparelho faz upsert, não
-- acumula. endpoint/p256dh/auth são o que o navegador devolve em pushManager.subscribe().
--
-- avisos_enviados: dedup — a Edge Function grava a "chave" de cada aviso já mandado
-- (ex.: "fixa-123-2026-09-3") e não reenvia. Ela mesma poda o que passou de ~2 meses.

create table public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table public.avisos_enviados (
  user_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table public.push_subscriptions enable row level security;
alter table public.avisos_enviados enable row level security;

-- Só o próprio usuário mexe nas suas subscriptions pelo cliente. avisos_enviados é escrito
-- só pela Edge Function (service_role, ignora RLS) — sem policy pra authenticated de propósito.
create policy "own" on public.push_subscriptions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- RPCs pro cliente ----

-- upsert da subscription deste aparelho
create function public.salvar_push_subscription(p_device_id text, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.push_subscriptions (user_id, device_id, endpoint, p256dh, auth)
  values (auth.uid(), p_device_id, p_endpoint, p_p256dh, p_auth)
  on conflict (user_id, device_id) do update set
    endpoint = excluded.endpoint,
    p256dh   = excluded.p256dh,
    auth     = excluded.auth,
    criado_em = now();
end;
$$;
revoke all on function public.salvar_push_subscription(text, text, text, text) from public;
revoke execute on function public.salvar_push_subscription(text, text, text, text) from anon;
grant execute on function public.salvar_push_subscription(text, text, text, text) to authenticated;

-- remove a subscription deste aparelho (usuário desligou as notificações aqui)
create function public.remover_push_subscription(p_device_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from public.push_subscriptions where user_id = auth.uid() and device_id = p_device_id;
end;
$$;
revoke all on function public.remover_push_subscription(text) from public;
revoke execute on function public.remover_push_subscription(text) from anon;
grant execute on function public.remover_push_subscription(text) to authenticated;
