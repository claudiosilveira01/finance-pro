-- Remove as funcionalidades de Cartões de Crédito e Notificações de Vencimento (Web Push) por
-- decisão do usuário (11/09/2026). Dados reais existentes (1 cartão Nubank, 40 transações, 4
-- inscrições push) foram exportados antes desta migração — ver
-- BRAIN/03_PROJETOS/FINANCE_PRO/backups/2026-09-11-remocao-cartoes-notificacoes/.
--
-- A única conta fixa que era alimentada automaticamente pelo cartão vira uma conta fixa normal,
-- editável manualmente (decisão do usuário) — dropar a coluna origem_cartao_id só tira o vínculo,
-- a linha da conta em si (nome/valor/categoria/vencimento) não é tocada.

-- ============================================================================
-- 1) Notificações de vencimento (Web Push): desliga o cron, apaga RPCs e tabelas
-- ============================================================================
select cron.unschedule('avisos-vencimento-diario')
where exists (select 1 from cron.job where jobname = 'avisos-vencimento-diario');

drop function if exists public.salvar_push_subscription(text, text, text, text);
drop function if exists public.remover_push_subscription(text);

drop table if exists public.push_subscriptions;
drop table if exists public.avisos_enviados;

-- ============================================================================
-- 2) Cartões de Crédito: apaga as tabelas e a coluna de vínculo em fixas
-- ============================================================================
drop table if exists public.cartao_transacoes;
drop table if exists public.cartao_faturas;
drop table if exists public.cartoes;

alter table public.fixas drop column if exists origem_cartao_id;

-- ============================================================================
-- 3) config: troca ocultar_card_cartoes (card que não existe mais) por
--    ocultar_card_extrato (novo toggle pedido pelo usuário)
-- ============================================================================
alter table public.config add column if not exists ocultar_card_extrato boolean not null default false;
alter table public.config drop column if exists ocultar_card_cartoes;

-- ============================================================================
-- 4) RPCs: get_config/salvar_config/get_mes/salvar_mes sem nenhuma referência a
--    cartão (config, fatura, transação) nem a ocultar_card_cartoes
-- ============================================================================
create or replace function public.get_config()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_config jsonb;
  v_assinaturas jsonb;
begin
  select to_jsonb(c) - 'user_id' - 'atualizado_em' into v_config
  from public.config c where c.user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'nome', a.nome, 'valor', a.valor,
    'vencimento', a.vencimento, 'categoria', a.categoria, 'faturadoEm', a.faturado_em
  )), '[]'::jsonb) into v_assinaturas
  from public.assinaturas a where a.user_id = v_uid;

  return jsonb_build_object(
    'categorias', coalesce(v_config->'categorias', '[]'::jsonb),
    'ocultarCardAcumulado', coalesce(v_config->'ocultar_card_acumulado', 'false'::jsonb),
    'ocultarCardExtrato', coalesce(v_config->'ocultar_card_extrato', 'false'::jsonb),
    'assinaturas', v_assinaturas
  );
end;
$$;
revoke all on function public.get_config() from public;
revoke execute on function public.get_config() from anon;
grant execute on function public.get_config() to authenticated;

create or replace function public.salvar_config(p jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  insert into public.config (user_id, categorias, ocultar_card_acumulado, ocultar_card_extrato)
  values (
    v_uid,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'categorias') x), '{}'),
    coalesce((p->>'ocultarCardAcumulado')::boolean, false),
    coalesce((p->>'ocultarCardExtrato')::boolean, false)
  )
  on conflict (user_id) do update set
    categorias = excluded.categorias,
    ocultar_card_acumulado = excluded.ocultar_card_acumulado,
    ocultar_card_extrato = excluded.ocultar_card_extrato;

  delete from public.assinaturas where user_id = v_uid;
  insert into public.assinaturas (id, user_id, nome, valor, vencimento, categoria, faturado_em)
  select (x->>'id')::bigint, v_uid, x->>'nome', (x->>'valor')::numeric,
         (x->>'vencimento')::int, x->>'categoria', x->>'faturadoEm'
  from jsonb_array_elements(coalesce(p->'assinaturas', '[]'::jsonb)) x;
end;
$$;
revoke all on function public.salvar_config(jsonb) from public;
revoke execute on function public.salvar_config(jsonb) from anon;
grant execute on function public.salvar_config(jsonb) to authenticated;

create or replace function public.get_mes(p_ano_mes text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_saldo numeric;
  v_fixas jsonb;
  v_faturamentos jsonb;
  v_extrato jsonb;
  v_registro jsonb;
begin
  select saldo into v_saldo from public.meses m where m.user_id = v_uid and m.ano_mes = p_ano_mes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'valor', f.valor, 'vencimento', f.vencimento,
    'categoria', f.categoria, 'obs', f.obs, 'pago', f.pago
  )), '[]'::jsonb) into v_fixas
  from public.fixas f where f.user_id = v_uid and f.ano_mes = p_ano_mes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ft.id, 'nome', ft.nome, 'valor', ft.valor, 'data', ft.data, 'noCaixa', ft.no_caixa
  )), '[]'::jsonb) into v_faturamentos
  from public.faturamentos ft where ft.user_id = v_uid and ft.ano_mes = p_ano_mes;

  -- origemImportId roundtrip preservado (migração 0007/0008) — é o dedup usado pela RPC
  -- importar_extrato_email, que fica dormente (só service_role) mas não removida agora.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'data', e.data, 'tipo', e.tipo, 'item', e.item, 'valor', e.valor,
    'direcao', e.direcao, 'origemImportId', e.origem_import_id
  )), '[]'::jsonb) into v_extrato
  from public.extrato e where e.user_id = v_uid and e.ano_mes = p_ano_mes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'contaId', r.conta_id, 'nome', r.nome, 'valor', r.valor,
    'marcadoComoPago', r.marcado_como_pago, 'tipo', r.tipo,
    'dataPagamento', r.data_pagamento, 'registradoEm', r.registrado_em
  )), '[]'::jsonb) into v_registro
  from public.registro_pagamentos r where r.user_id = v_uid and r.ano_mes = p_ano_mes;

  if v_saldo is null and v_fixas = '[]'::jsonb and v_faturamentos = '[]'::jsonb
     and v_extrato = '[]'::jsonb and v_registro = '[]'::jsonb then
    return null;
  end if;

  return jsonb_build_object(
    'saldo', coalesce(v_saldo, 0),
    'fixas', v_fixas,
    'faturamentos', v_faturamentos,
    'extrato', v_extrato,
    'registroPagamentos', v_registro
  );
end;
$$;
revoke all on function public.get_mes(text) from public;
revoke execute on function public.get_mes(text) from anon;
grant execute on function public.get_mes(text) to authenticated;

create or replace function public.salvar_mes(p_ano_mes text, p_dados jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  insert into public.meses (user_id, ano_mes, saldo)
  values (v_uid, p_ano_mes, coalesce((p_dados->>'saldo')::numeric, 0))
  on conflict (user_id, ano_mes) do update set saldo = excluded.saldo;

  delete from public.fixas where user_id = v_uid and ano_mes = p_ano_mes;
  insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago)
  select (x->>'id')::bigint, v_uid, p_ano_mes, x->>'nome', (x->>'valor')::numeric,
         (x->>'vencimento')::int, x->>'categoria', coalesce(x->>'obs', ''),
         coalesce((x->>'pago')::boolean, false)
  from jsonb_array_elements(coalesce(p_dados->'fixas', '[]'::jsonb)) x;

  delete from public.faturamentos where user_id = v_uid and ano_mes = p_ano_mes;
  insert into public.faturamentos (id, user_id, ano_mes, nome, valor, data, no_caixa)
  select (x->>'id')::bigint, v_uid, p_ano_mes, x->>'nome', (x->>'valor')::numeric,
         (x->>'data')::date, coalesce((x->>'noCaixa')::boolean, false)
  from jsonb_array_elements(coalesce(p_dados->'faturamentos', '[]'::jsonb)) x;

  delete from public.extrato where user_id = v_uid and ano_mes = p_ano_mes;
  insert into public.extrato (id, user_id, ano_mes, data, tipo, item, valor, direcao, origem_import_id)
  select (x->>'id')::bigint, v_uid, p_ano_mes, (x->>'data')::date, x->>'tipo', x->>'item',
         (x->>'valor')::numeric, x->>'direcao', x->>'origemImportId'
  from jsonb_array_elements(coalesce(p_dados->'extrato', '[]'::jsonb)) x;

  delete from public.registro_pagamentos where user_id = v_uid and ano_mes = p_ano_mes;
  insert into public.registro_pagamentos (id, user_id, ano_mes, conta_id, nome, valor, marcado_como_pago, tipo, data_pagamento, registrado_em)
  select (x->>'id')::bigint, v_uid, p_ano_mes, (x->>'contaId')::bigint, x->>'nome', (x->>'valor')::numeric,
         (x->>'marcadoComoPago')::boolean, x->>'tipo', (x->>'dataPagamento')::date,
         coalesce((x->>'registradoEm')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_dados->'registroPagamentos', '[]'::jsonb)) x;
end;
$$;
revoke all on function public.salvar_mes(text, jsonb) from public;
revoke execute on function public.salvar_mes(text, jsonb) from anon;
grant execute on function public.salvar_mes(text, jsonb) to authenticated;

-- renomear_categoria (0004) e repetir_fixa (0004) referenciavam cartao_transacoes/
-- origem_cartao_id — sem atualizá-las aqui, elas quebrariam em runtime (relation/column does
-- not exist) assim que alguém renomeasse uma categoria ou repetisse uma conta fixa.
create or replace function public.renomear_categoria(p_antigo text, p_novo text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.fixas set categoria = p_novo
   where user_id = v_uid and categoria = p_antigo;
end;
$$;
revoke all on function public.renomear_categoria(text, text) from public;
revoke execute on function public.renomear_categoria(text, text) from anon;
grant execute on function public.renomear_categoria(text, text) to authenticated;

create or replace function public.repetir_fixa(p_base jsonb, p_de text, p_ate text)
returns text[]
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mes text;
begin
  for v_mes in
    select to_char(d, 'YYYY-MM')
    from generate_series(
      (p_de  || '-01')::date + interval '1 month',
      (p_ate || '-01')::date,
      interval '1 month'
    ) d
  loop
    insert into public.meses (user_id, ano_mes, saldo)
    values (v_uid, v_mes, 0)
    on conflict (user_id, ano_mes) do nothing;

    insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago)
    values (
      (extract(epoch from clock_timestamp()) * 1000)::bigint + (random() * 100000)::int,
      v_uid, v_mes,
      p_base->>'nome',
      coalesce((p_base->>'valor')::numeric, 0),
      (p_base->>'vencimento')::int,
      p_base->>'categoria',
      coalesce(p_base->>'obs', ''),
      false
    );
  end loop;

  return coalesce((
    select array_agg(m.ano_mes order by m.ano_mes)
    from public.meses m where m.user_id = v_uid
  ), '{}');
end;
$$;
revoke all on function public.repetir_fixa(jsonb, text, text) from public;
revoke execute on function public.repetir_fixa(jsonb, text, text) from anon;
grant execute on function public.repetir_fixa(jsonb, text, text) to authenticated;
