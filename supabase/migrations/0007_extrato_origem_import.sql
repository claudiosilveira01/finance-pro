-- Fase 2a: coluna de id-de-origem no extrato, pra dedup de reimportação por e-mail.
-- O parser do CSV do Nubank tem o "Identificador" (UUID único por transação); o parser do PDF
-- (client-side) não tem acesso a ele, então grava origem_import_id NULL — a dedup do PDF
-- continua sendo por conteúdo (_extratoChave no cliente). `cartao_transacoes` já tinha isso.

alter table public.extrato add column if not exists origem_import_id text;

-- get_mes: devolve origemImportId no array de extrato (espelha o que cartao_transacoes já faz).
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
  v_cartoes_faturas jsonb;
begin
  select saldo into v_saldo from public.meses m where m.user_id = v_uid and m.ano_mes = p_ano_mes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'valor', f.valor, 'vencimento', f.vencimento,
    'categoria', f.categoria, 'obs', f.obs, 'pago', f.pago, 'origemCartaoId', f.origem_cartao_id
  )), '[]'::jsonb) into v_fixas
  from public.fixas f where f.user_id = v_uid and f.ano_mes = p_ano_mes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ft.id, 'nome', ft.nome, 'valor', ft.valor, 'data', ft.data, 'noCaixa', ft.no_caixa
  )), '[]'::jsonb) into v_faturamentos
  from public.faturamentos ft where ft.user_id = v_uid and ft.ano_mes = p_ano_mes;

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

  select coalesce(jsonb_object_agg(cf.cartao_id::text, jsonb_build_object(
    'valorConfirmado', cf.valor_confirmado,
    'valorEstimado', cf.valor_estimado,
    '_creditosImportados', to_jsonb(cf.creditos_importados),
    'transacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'descricao', t.descricao, 'valor', t.valor,
        'data', t.data, 'categoria', t.categoria, 'origemImportId', t.origem_import_id
      ))
      from public.cartao_transacoes t
      where t.user_id = cf.user_id and t.ano_mes = cf.ano_mes and t.cartao_id = cf.cartao_id
    ), '[]'::jsonb)
  )), '{}'::jsonb) into v_cartoes_faturas
  from public.cartao_faturas cf where cf.user_id = v_uid and cf.ano_mes = p_ano_mes;

  if v_saldo is null and v_fixas = '[]'::jsonb and v_faturamentos = '[]'::jsonb
     and v_extrato = '[]'::jsonb and v_registro = '[]'::jsonb and v_cartoes_faturas = '{}'::jsonb then
    return null;
  end if;

  return jsonb_build_object(
    'saldo', coalesce(v_saldo, 0),
    'fixas', v_fixas,
    'faturamentos', v_faturamentos,
    'extrato', v_extrato,
    'registroPagamentos', v_registro,
    'cartoesFaturas', v_cartoes_faturas
  );
end;
$$;

-- salvar_mes: grava origem_import_id de volta (o roundtrip precisa preservar o que veio do
-- e-mail, senão o próximo salvar_mes do app — delete+reinsert do extrato inteiro — apagava).
create or replace function public.salvar_mes(p_ano_mes text, p_dados jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cartao_id bigint;
begin
  insert into public.meses (user_id, ano_mes, saldo)
  values (v_uid, p_ano_mes, coalesce((p_dados->>'saldo')::numeric, 0))
  on conflict (user_id, ano_mes) do update set saldo = excluded.saldo;

  delete from public.fixas where user_id = v_uid and ano_mes = p_ano_mes;
  insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, origem_cartao_id)
  select (x->>'id')::bigint, v_uid, p_ano_mes, x->>'nome', (x->>'valor')::numeric,
         (x->>'vencimento')::int, x->>'categoria', coalesce(x->>'obs', ''),
         coalesce((x->>'pago')::boolean, false), (x->>'origemCartaoId')::bigint
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

  delete from public.cartao_faturas where user_id = v_uid and ano_mes = p_ano_mes;
  for v_cartao_id in
    select (key)::bigint from jsonb_each(coalesce(p_dados->'cartoesFaturas', '{}'::jsonb))
  loop
    insert into public.cartao_faturas (user_id, ano_mes, cartao_id, valor_confirmado, valor_estimado, creditos_importados)
    select v_uid, p_ano_mes, v_cartao_id,
           (fat->>'valorConfirmado')::numeric, (fat->>'valorEstimado')::numeric,
           coalesce((select array_agg(x) from jsonb_array_elements_text(fat->'_creditosImportados') x), '{}')
    from (select (p_dados->'cartoesFaturas')->(v_cartao_id::text) as fat) s;

    insert into public.cartao_transacoes (id, user_id, ano_mes, cartao_id, descricao, valor, data, categoria, origem_import_id)
    select (x->>'id')::bigint, v_uid, p_ano_mes, v_cartao_id, x->>'descricao', (x->>'valor')::numeric,
           (x->>'data')::date, x->>'categoria', x->>'origemImportId'
    from jsonb_array_elements(coalesce((p_dados->'cartoesFaturas')->(v_cartao_id::text)->'transacoes', '[]'::jsonb)) x;
  end loop;
end;
$$;
