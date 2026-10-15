-- Parcelamento de contas fixas ("Empréstimo 3/10") mesclado com a repetição mensal,
-- e contas "vinculadas" (valor sincroniza sozinho com o Restante de outra conta,
-- usado pelo recurso de administrador que cobre o orçamento de outra pessoa da família).

alter table public.fixas
    add column parcela_atual int,
    add column parcela_total int,
    add column vinculo_user_id uuid references auth.users(id) on delete set null,
    add column vinculo_tipo text,
    add constraint fixas_parcela_check check (
        parcela_total is null or (parcela_atual is not null and parcela_atual >= 1 and parcela_total >= parcela_atual)
    ),
    add constraint fixas_vinculo_tipo_check check (
        vinculo_tipo is null or vinculo_tipo = 'restante_orcamento'
    );

-- Definição do vínculo recorrente em si (ex.: "a conta do Claudio tem uma linha fixa
-- que cobre o Restante do orçamento da Carla"). A linha em `fixas` de cada mês é
-- recriada a partir daqui sempre que o mês é aberto e ainda não tem essa linha —
-- igual ao mês em si, que só existe de verdade quando alguma coisa é salva nele.
create table public.vinculos_fixos (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    vinculo_user_id uuid not null references auth.users(id) on delete cascade,
    vinculo_tipo text not null default 'restante_orcamento' check (vinculo_tipo = 'restante_orcamento'),
    nome text not null,
    categoria text not null,
    vencimento int not null,
    obs text not null default '',
    criado_em timestamptz not null default now(),
    unique (user_id, vinculo_user_id, vinculo_tipo)
);
alter table public.vinculos_fixos enable row level security;
create policy own on public.vinculos_fixos for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- Calcula o valor "ao vivo" de um vínculo. Hoje só existe um tipo (Restante do
-- orçamento: soma das contas fixas não pagas daquele mês de quem foi vinculado).
create or replace function public._valor_vinculado(p_tipo text, p_alvo uuid, p_ano_mes text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
    select case when p_tipo = 'restante_orcamento' then
        coalesce((
            select sum(f.valor) from public.fixas f
            where f.user_id = p_alvo and f.ano_mes = p_ano_mes and f.pago = false
        ), 0)
    else 0 end
$$;
revoke all on function public._valor_vinculado(text, uuid, text) from public;

-- get_mes: materializa vínculos fixos que ainda não têm linha neste mês, e sempre
-- devolve o valor das linhas vinculadas recém-calculado (nunca o que foi salvo da
-- última vez — a Carla pode ter mudado o orçamento dela sem o Claudio salvar nada).
create or replace function public.get_mes(p_ano_mes text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_saldo numeric;
  v_fixas jsonb;
  v_faturamentos jsonb;
  v_extrato jsonb;
  v_registro jsonb;
begin
  -- materializa vínculos fixos que ainda não existem neste mês (cria a linha de
  -- `meses` primeiro — fixas tem FK composta pra lá).
  if exists (select 1 from public.vinculos_fixos vf where vf.user_id = v_uid) then
    insert into public.meses (user_id, ano_mes, saldo)
    values (v_uid, p_ano_mes, 0)
    on conflict (user_id, ano_mes) do nothing;

    insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, vinculo_user_id, vinculo_tipo)
    select 9100000000000 + vf.id, v_uid, p_ano_mes, vf.nome,
           public._valor_vinculado(vf.vinculo_tipo, vf.vinculo_user_id, p_ano_mes),
           vf.vencimento, vf.categoria, vf.obs, false, vf.vinculo_user_id, vf.vinculo_tipo
    from public.vinculos_fixos vf
    where vf.user_id = v_uid
    on conflict (user_id, ano_mes, id) do nothing;
  end if;

  select saldo into v_saldo from public.meses m where m.user_id = v_uid and m.ano_mes = p_ano_mes;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome,
    'valor', case when f.vinculo_user_id is not null
                  then public._valor_vinculado(f.vinculo_tipo, f.vinculo_user_id, p_ano_mes)
                  else f.valor end,
    'vencimento', f.vencimento, 'categoria', f.categoria, 'obs', f.obs, 'pago', f.pago,
    'parcelaAtual', f.parcela_atual, 'parcelaTotal', f.parcela_total,
    'vinculoTipo', f.vinculo_tipo
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
$function$;

-- salvar_mes: contas fixas vinculadas nunca são apagadas pelo ciclo de salvar (o
-- cliente manda a lista inteira de volta a cada save) e o valor delas nunca vem do
-- cliente — só vencimento/categoria/obs/pago/nome são editáveis.
create or replace function public.salvar_mes(p_ano_mes text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  insert into public.meses (user_id, ano_mes, saldo)
  values (v_uid, p_ano_mes, coalesce((p_dados->>'saldo')::numeric, 0))
  on conflict (user_id, ano_mes) do update set saldo = excluded.saldo;

  -- só as fixas NÃO vinculadas entram no ciclo de apagar-e-regravar do cliente.
  delete from public.fixas where user_id = v_uid and ano_mes = p_ano_mes and vinculo_user_id is null;
  insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, parcela_atual, parcela_total)
  select (x->>'id')::bigint, v_uid, p_ano_mes, x->>'nome', (x->>'valor')::numeric,
         (x->>'vencimento')::int, x->>'categoria', coalesce(x->>'obs', ''),
         coalesce((x->>'pago')::boolean, false),
         (x->>'parcelaAtual')::int, (x->>'parcelaTotal')::int
  from jsonb_array_elements(coalesce(p_dados->'fixas', '[]'::jsonb)) x
  where not exists (
    select 1 from public.fixas f2
    where f2.user_id = v_uid and f2.ano_mes = p_ano_mes and f2.id = (x->>'id')::bigint and f2.vinculo_user_id is not null
  );

  -- fixas vinculadas: aplica só os campos editáveis que o cliente mandou (se mandou
  -- esse id de volta); o valor é sempre recalculado aqui, nunca confia no cliente.
  update public.fixas f set
    nome = coalesce(e.nome, f.nome),
    vencimento = coalesce(e.vencimento, f.vencimento),
    categoria = coalesce(e.categoria, f.categoria),
    obs = coalesce(e.obs, f.obs),
    pago = coalesce(e.pago, f.pago)
  from (
    select (x->>'id')::bigint as id, x->>'nome' as nome, (x->>'vencimento')::int as vencimento,
           x->>'categoria' as categoria, x->>'obs' as obs, (x->>'pago')::boolean as pago
    from jsonb_array_elements(coalesce(p_dados->'fixas', '[]'::jsonb)) x
  ) e
  where f.user_id = v_uid and f.ano_mes = p_ano_mes and f.vinculo_user_id is not null and f.id = e.id;

  update public.fixas f
  set valor = public._valor_vinculado(f.vinculo_tipo, f.vinculo_user_id, p_ano_mes)
  where f.user_id = v_uid and f.ano_mes = p_ano_mes and f.vinculo_user_id is not null;

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
$function$;

-- repetir_fixa: parcela_atual soma +1 a cada mês futuro gerado (a última cópia já
-- nasce com parcela_atual = parcela_total, e o front calcula p_ate pra parar exatamente aí).
create or replace function public.repetir_fixa(p_base jsonb, p_de text, p_ate text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_mes text;
  v_offset int := 0;
  v_parcela_atual int := (p_base->>'parcelaAtual')::int;
  v_parcela_total int := (p_base->>'parcelaTotal')::int;
begin
  for v_mes in
    select to_char(d, 'YYYY-MM')
    from generate_series(
      (p_de  || '-01')::date + interval '1 month',
      (p_ate || '-01')::date,
      interval '1 month'
    ) d
  loop
    v_offset := v_offset + 1;

    insert into public.meses (user_id, ano_mes, saldo)
    values (v_uid, v_mes, 0)
    on conflict (user_id, ano_mes) do nothing;

    insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, parcela_atual, parcela_total)
    values (
      (extract(epoch from clock_timestamp()) * 1000)::bigint + (random() * 100000)::int,
      v_uid, v_mes,
      p_base->>'nome',
      coalesce((p_base->>'valor')::numeric, 0),
      (p_base->>'vencimento')::int,
      p_base->>'categoria',
      coalesce(p_base->>'obs', ''),
      false,
      case when v_parcela_atual is not null then least(v_parcela_atual + v_offset, coalesce(v_parcela_total, v_parcela_atual + v_offset)) else null end,
      v_parcela_total
    );
  end loop;

  return coalesce((
    select array_agg(m.ano_mes order by m.ano_mes)
    from public.meses m where m.user_id = v_uid
  ), '{}');
end;
$function$;
