-- Fase 3: cron diário que dispara a Edge Function avisos-vencimento.
-- 12:00 UTC ≈ 9:00 BRT. O segredo compartilhado com a function fica no Vault (não no repo):
-- criar/rotacionar o valor é feito fora da migração (SQL / painel), e o MESMO valor precisa
-- estar no secret CRON_SECRET da Edge Function.
--
--   select vault.create_secret('<segredo>', 'cron_secret_avisos');   -- primeira vez
--   -- rotacionar: update vault.secrets set secret = '<novo>' where name = 'cron_secret_avisos';

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('avisos-vencimento-diario')
where exists (select 1 from cron.job where jobname = 'avisos-vencimento-diario');

select cron.schedule(
  'avisos-vencimento-diario',
  '0 12 * * *',
  $cron$
  select net.http_post(
    url := 'https://jasrlsyfsbagnkkhifxq.supabase.co/functions/v1/avisos-vencimento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_avisos')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
