-- Fase 2b: RPC dedicada pra importação de extrato por e-mail (Apps Script -> Supabase).
--
-- Chamada SÓ pelo service_role (do Google Apps Script), nunca por anon/authenticated — por isso
-- recebe p_user_id explícito em vez de auth.uid() (não há sessão de usuário). O service_role
-- ignora RLS.
--
-- Merge INCREMENTAL: agrupa por mês, cria a linha `meses` que faltar e insere só as transações
-- cujo origem_import_id ainda não existe naquele mês. NÃO faz delete+reinsert (senão apagaria o
-- que veio do PDF ou de lançamento manual). Depois, quando o app abrir o mês e salvar, o
-- salvar_mes (delete+reinsert a partir de window.activeExtrato) preserva essas linhas porque o
-- get_mes agora devolve origemImportId (migração 0007).

create or replace function public.importar_extrato_email(p_user_id uuid, p_transacoes jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_mes text;
  v_novas int := 0;
  v_inseridas_no_mes int;
  v_meses text[] := '{}';
begin
  if p_user_id is null or p_transacoes is null or jsonb_typeof(p_transacoes) <> 'array' then
    raise exception 'p_user_id e p_transacoes (array) são obrigatórios';
  end if;

  for v_mes in
    select distinct substr(x->>'data', 1, 7)
    from jsonb_array_elements(p_transacoes) x
    where x->>'data' is not null
    order by 1
  loop
    insert into public.meses (user_id, ano_mes, saldo)
    values (p_user_id, v_mes, 0)
    on conflict (user_id, ano_mes) do nothing;

    with candidatas as (
      select distinct on (x->>'origemImportId')
        (x->>'id')::bigint      as id,
        (x->>'data')::date      as data,
        x->>'tipo'              as tipo,
        x->>'item'              as item,
        (x->>'valor')::numeric  as valor,
        x->>'direcao'           as direcao,
        x->>'origemImportId'    as origem_import_id
      from jsonb_array_elements(p_transacoes) x
      where substr(x->>'data', 1, 7) = v_mes
        and x->>'origemImportId' is not null
    ),
    ins as (
      insert into public.extrato (id, user_id, ano_mes, data, tipo, item, valor, direcao, origem_import_id)
      select c.id, p_user_id, v_mes, c.data, c.tipo, c.item, c.valor, c.direcao, c.origem_import_id
      from candidatas c
      where not exists (
        select 1 from public.extrato e
        where e.user_id = p_user_id and e.ano_mes = v_mes
          and e.origem_import_id = c.origem_import_id
      )
      on conflict (user_id, ano_mes, id) do nothing
      returning 1
    )
    select count(*) into v_inseridas_no_mes from ins;

    v_novas := v_novas + coalesce(v_inseridas_no_mes, 0);
    v_meses := array_append(v_meses, v_mes);
  end loop;

  return jsonb_build_object('novasTransacoes', v_novas, 'meses', to_jsonb(v_meses));
end;
$$;

revoke all on function public.importar_extrato_email(uuid, jsonb) from public;
revoke execute on function public.importar_extrato_email(uuid, jsonb) from anon, authenticated;
grant execute on function public.importar_extrato_email(uuid, jsonb) to service_role;
