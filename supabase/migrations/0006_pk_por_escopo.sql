-- A2 da auditoria: os `id` das tabelas são gerados no cliente (Date.now() / hash). O PK global
-- de uma coluna só fazia dois usuários (ou dois meses do mesmo usuário) com o mesmo id
-- colidirem no INSERT do salvar_mes/salvar_config → a RPC falhava e a gravação sumia em
-- silêncio. PK composta pelo escopo real de unicidade resolve. Verificado: 0 duplicata da
-- nova PK antes de aplicar. As RPCs não mudam (já filtram por (user_id, ano_mes)).

-- ---- tabelas-filhas: unicidade por (user_id, ano_mes, id) ----
alter table public.fixas               drop constraint fixas_pkey,               add primary key (user_id, ano_mes, id);
alter table public.faturamentos        drop constraint faturamentos_pkey,        add primary key (user_id, ano_mes, id);
alter table public.extrato             drop constraint extrato_pkey,             add primary key (user_id, ano_mes, id);
alter table public.registro_pagamentos drop constraint registro_pagamentos_pkey, add primary key (user_id, ano_mes, id);
alter table public.cartao_transacoes   drop constraint cartao_transacoes_pkey,   add primary key (user_id, ano_mes, id);

-- ---- config: unicidade por (user_id, id) ----
alter table public.assinaturas drop constraint assinaturas_pkey, add primary key (user_id, id);
alter table public.cartoes     drop constraint cartoes_pkey,     add primary key (user_id, id);

-- ---- índices agora redundantes (o prefixo da nova PK cobre) ----
drop index if exists public.fixas_user_mes_idx;
drop index if exists public.faturamentos_user_mes_idx;
drop index if exists public.extrato_user_mes_idx;
drop index if exists public.registro_pagamentos_user_mes_idx;
drop index if exists public.cartao_transacoes_fatura_idx;
drop index if exists public.cartoes_user_id_idx;
drop index if exists public.assinaturas_user_id_idx;
