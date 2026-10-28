-- Conta administradora: uma conta (admin) pode ver e editar as contas que foram vinculadas
-- a ela (alvo), sem precisar saber a senha do alvo.
--
-- Como funciona:
--   1) admin_acessos guarda quem administra quem. Só aparece vínculo com aceito_em preenchido
--      (o alvo deu o consentimento). Clientes só leem essa tabela; quem cria o vínculo é o
--      dono do banco (SQL direto), nunca o app.
--   2) _uid_alvo(p_alvo) decide qual conta a RPC deve ler/gravar: a própria (se p_alvo for
--      nulo ou for a própria conta) ou a conta alvo (se houver vínculo aceito). Sem vínculo,
--      dá erro. Toda RPC que lê ou grava dados passa por essa função.
--   3) As RPCs ganham o parâmetro opcional p_alvo. Quem não manda p_alvo continua usando a
--      própria conta, então o app atual (em produção) não quebra.
--
-- As tabelas continuam com RLS "own": o acesso do admin só existe via essas RPCs.

-- ============================================================================
-- 1) Tabela de vínculos administrativos
-- ============================================================================
create table public.admin_acessos (
    admin_user_id uuid not null references auth.users(id) on delete cascade,
    alvo_user_id uuid not null references auth.users(id) on delete cascade,
    apelido text,  -- nome mostrado no seletor do app (ex.: 'Carla')
    criado_em timestamptz not null default now(),
    aceito_em timestamptz,
    primary key (admin_user_id, alvo_user_id),
    constraint admin_acessos_nao_si_mesmo check (admin_user_id <> alvo_user_id)
);

alter table public.admin_acessos enable row level security;

create policy "veja_seus_vinculos" on public.admin_acessos for select
    using (admin_user_id = (select auth.uid()) or alvo_user_id = (select auth.uid()));

-- Nenhum cliente escreve nessa tabela, nem por RLS nem por grant.
revoke insert, update, delete, truncate on public.admin_acessos from anon, authenticated;

-- ============================================================================
-- 2) Decide a conta que a RPC deve usar
-- ============================================================================
create or replace function public._uid_alvo(p_alvo uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_alvo is null or p_alvo = auth.uid() then
    return auth.uid();
  end if;

  if exists (
    select 1 from public.admin_acessos a
    where a.admin_user_id = auth.uid()
      and a.alvo_user_id = p_alvo
      and a.aceito_em is not null
  ) then
    return p_alvo;
  end if;

  raise exception 'sem acesso a esta conta' using errcode = '42501';
end;
$function$;
revoke all on function public._uid_alvo(uuid) from public, anon, authenticated;

-- ============================================================================
-- 3) RPCs passam a aceitar p_alvo (a versão antiga sem parâmetro é removida antes)
-- ============================================================================
drop function if exists public.get_config();
drop function if exists public.salvar_config(jsonb);
drop function if exists public.get_mes(text);
drop function if exists public.salvar_mes(text, jsonb);
drop function if exists public.get_meses_disponiveis();
drop function if exists public.renomear_categoria(text, text);
drop function if exists public.repetir_fixa(jsonb, text, text);

create function public.get_config(p_alvo uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
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
$function$;

create function public.salvar_config(p jsonb, p_alvo uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
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
$function$;

create function public.get_meses_disponiveis(p_alvo uuid default null)
returns text[]
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return coalesce((
    select array_agg(m.ano_mes order by m.ano_mes)
    from public.meses m where m.user_id = public._uid_alvo(p_alvo)
  ), '{}');
end;
$function$;

create function public.renomear_categoria(p_antigo text, p_novo text, p_alvo uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
begin
  update public.fixas set categoria = p_novo
   where user_id = v_uid and categoria = p_antigo;
end;
$function$;

create function public.get_mes(p_ano_mes text, p_alvo uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
  v_saldo numeric;
  v_fixas jsonb;
  v_faturamentos jsonb;
  v_extrato jsonb;
  v_registro jsonb;
begin
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

create function public.salvar_mes(p_ano_mes text, p_dados jsonb, p_alvo uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
begin
  insert into public.meses (user_id, ano_mes, saldo)
  values (v_uid, p_ano_mes, coalesce((p_dados->>'saldo')::numeric, 0))
  on conflict (user_id, ano_mes) do update set saldo = excluded.saldo;

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

create function public.repetir_fixa(p_base jsonb, p_de text, p_ate text, p_alvo uuid default null)
returns text[]
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
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

-- ============================================================================
-- 4) Permissões (o drop acima apagou as antigas, então refazemos)
-- ============================================================================
revoke all on function public.get_config(uuid) from public;
revoke execute on function public.get_config(uuid) from anon;
grant execute on function public.get_config(uuid) to authenticated;

revoke all on function public.salvar_config(jsonb, uuid) from public;
revoke execute on function public.salvar_config(jsonb, uuid) from anon;
grant execute on function public.salvar_config(jsonb, uuid) to authenticated;

revoke all on function public.get_meses_disponiveis(uuid) from public;
revoke execute on function public.get_meses_disponiveis(uuid) from anon;
grant execute on function public.get_meses_disponiveis(uuid) to authenticated;

revoke all on function public.renomear_categoria(text, text, uuid) from public;
revoke execute on function public.renomear_categoria(text, text, uuid) from anon;
grant execute on function public.renomear_categoria(text, text, uuid) to authenticated;

revoke all on function public.get_mes(text, uuid) from public;
revoke execute on function public.get_mes(text, uuid) from anon;
grant execute on function public.get_mes(text, uuid) to authenticated;

revoke all on function public.salvar_mes(text, jsonb, uuid) from public;
revoke execute on function public.salvar_mes(text, jsonb, uuid) from anon;
grant execute on function public.salvar_mes(text, jsonb, uuid) to authenticated;

revoke all on function public.repetir_fixa(jsonb, text, text, uuid) from public;
revoke execute on function public.repetir_fixa(jsonb, text, text, uuid) from anon;
grant execute on function public.repetir_fixa(jsonb, text, text, uuid) to authenticated;
