-- Limpeza do banco (varredura geral de 28/10/2026). Idempotente: pode ser rodada mais de uma vez.
--
-- 1) Índice que faltava para a chave estrangeira de admin_acessos.alvo_user_id (alerta de desempenho).
create index if not exists admin_acessos_alvo_user_id_idx on public.admin_acessos (alvo_user_id);

-- 2) Função antiga de importação de extrato por e-mail. A automação foi removida (PR #55); a função
--    só era chamável com service_role e não tinha mais uso.
drop function if exists public.importar_extrato_email(uuid, jsonb);

-- 3) Segredo das notificações de vencimento, que foram removidas (migration 0011). Nada mais o lê.
delete from vault.secrets where name = 'cron_secret_avisos';
