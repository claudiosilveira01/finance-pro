-- Performance advisors (get_advisors performance):
--
-- 1) auth_rls_initplan: as policies "own" chamavam auth.uid() direto, que o Postgres
--    reavalia por linha. Trocar por (select auth.uid()) faz o planner avaliar uma vez só.
-- 2) unindexed_foreign_keys: cartao_faturas.cartao_id e fixas.origem_cartao_id não tinham
--    índice de cobertura.
--
-- Os INFO "unused_index" restantes são esperados: os índices ainda não foram usados porque
-- o banco está vazio; passam a ser usados quando o app começar a consultar.

-- ---- 1) RLS init plan ----
do $$
declare
  t text;
begin
  foreach t in array array[
    'config','assinaturas','cartoes','meses','fixas','faturamentos',
    'extrato','registro_pagamentos','cartao_faturas','cartao_transacoes'
  ]
  loop
    execute format('drop policy if exists "own" on public.%I', t);
    execute format(
      'create policy "own" on public.%I for all
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---- 2) índices de FK ----
create index if not exists cartao_faturas_cartao_id_idx on public.cartao_faturas (cartao_id);
create index if not exists fixas_origem_cartao_id_idx on public.fixas (origem_cartao_id);
