-- Finance PRO — schema inicial (migração Firebase/Firestore -> Supabase/Postgres)
-- Sem tabela profiles: todo dado referencia auth.users(id) direto, com on delete cascade.
-- Sem Realtime (o app não usa onSnapshot/subscriptions hoje).

-- ============================================================================
-- CONFIG (1 linha por usuário)
-- ============================================================================
create table public.config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  categorias text[] not null default '{}',
  ocultar_card_acumulado boolean not null default false,
  ocultar_card_cartoes boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create table public.assinaturas (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric not null default 0,
  vencimento int not null,
  categoria text not null,
  faturado_em text
);
create index assinaturas_user_id_idx on public.assinaturas (user_id);

create table public.cartoes (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  dia_fechamento int not null,
  dia_vencimento int not null
);
create index cartoes_user_id_idx on public.cartoes (user_id);

-- ============================================================================
-- MESES (PK composta user_id + ano_mes, formato "YYYY-MM")
-- ============================================================================
create table public.meses (
  user_id uuid not null references auth.users(id) on delete cascade,
  ano_mes text not null,
  saldo numeric not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, ano_mes)
);

create table public.fixas (
  id bigint primary key,
  user_id uuid not null,
  ano_mes text not null,
  nome text not null,
  valor numeric not null default 0,
  vencimento int not null,
  categoria text not null,
  obs text not null default '',
  pago boolean not null default false,
  origem_cartao_id bigint references public.cartoes(id) on delete set null,
  foreign key (user_id, ano_mes) references public.meses(user_id, ano_mes) on delete cascade
);
create index fixas_user_mes_idx on public.fixas (user_id, ano_mes);

create table public.faturamentos (
  id bigint primary key,
  user_id uuid not null,
  ano_mes text not null,
  nome text not null,
  valor numeric not null default 0,
  data date not null,
  no_caixa boolean not null default false,
  foreign key (user_id, ano_mes) references public.meses(user_id, ano_mes) on delete cascade
);
create index faturamentos_user_mes_idx on public.faturamentos (user_id, ano_mes);

create table public.extrato (
  id bigint primary key,
  user_id uuid not null,
  ano_mes text not null,
  data date not null,
  tipo text not null,
  item text not null,
  valor numeric not null default 0,
  direcao text not null check (direcao in ('entrada', 'saida')),
  foreign key (user_id, ano_mes) references public.meses(user_id, ano_mes) on delete cascade
);
create index extrato_user_mes_idx on public.extrato (user_id, ano_mes);

create table public.registro_pagamentos (
  id bigint primary key,
  user_id uuid not null,
  ano_mes text not null,
  conta_id bigint not null,
  nome text not null,
  valor numeric not null default 0,
  marcado_como_pago boolean not null,
  tipo text not null check (tipo in ('fixa', 'assinatura')),
  data_pagamento date,
  registrado_em timestamptz not null default now(),
  foreign key (user_id, ano_mes) references public.meses(user_id, ano_mes) on delete cascade
);
create index registro_pagamentos_user_mes_idx on public.registro_pagamentos (user_id, ano_mes);

-- Fatura de cartão do mês: 1 linha por (usuário, mês, cartão).
create table public.cartao_faturas (
  user_id uuid not null,
  ano_mes text not null,
  cartao_id bigint not null references public.cartoes(id) on delete cascade,
  valor_confirmado numeric,
  valor_estimado numeric,
  creditos_importados text[] not null default '{}',
  primary key (user_id, ano_mes, cartao_id),
  foreign key (user_id, ano_mes) references public.meses(user_id, ano_mes) on delete cascade
);

create table public.cartao_transacoes (
  id bigint primary key,
  user_id uuid not null,
  ano_mes text not null,
  cartao_id bigint not null,
  descricao text not null,
  valor numeric not null default 0,
  data date not null,
  categoria text not null,
  origem_import_id text,
  foreign key (user_id, ano_mes, cartao_id) references public.cartao_faturas(user_id, ano_mes, cartao_id) on delete cascade
);
create index cartao_transacoes_fatura_idx on public.cartao_transacoes (user_id, ano_mes, cartao_id);

-- ============================================================================
-- TRIGGER atualizado_em (config e meses)
-- ============================================================================
create function public.set_atualizado_em()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger config_set_atualizado_em
  before update on public.config
  for each row execute function public.set_atualizado_em();

create trigger meses_set_atualizado_em
  before update on public.meses
  for each row execute function public.set_atualizado_em();

-- Só a trigger deve chamar isso — nunca uma role via API.
revoke execute on function public.set_atualizado_em() from anon;
revoke execute on function public.set_atualizado_em() from authenticated;

-- ============================================================================
-- RLS — todas as tabelas, acesso só do próprio usuário
-- ============================================================================
alter table public.config enable row level security;
alter table public.assinaturas enable row level security;
alter table public.cartoes enable row level security;
alter table public.meses enable row level security;
alter table public.fixas enable row level security;
alter table public.faturamentos enable row level security;
alter table public.extrato enable row level security;
alter table public.registro_pagamentos enable row level security;
alter table public.cartao_faturas enable row level security;
alter table public.cartao_transacoes enable row level security;

create policy "own" on public.config for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.assinaturas for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.cartoes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.meses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.fixas for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.faturamentos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.extrato for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.registro_pagamentos for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.cartao_faturas for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own" on public.cartao_transacoes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- RPCs — espelham o padrão atual de "1 doc inteiro por get/set" do Firestore
-- ============================================================================

-- ---- get_config / salvar_config ----
create function public.get_config()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_config jsonb;
  v_assinaturas jsonb;
  v_cartoes jsonb;
begin
  select to_jsonb(c) - 'user_id' - 'atualizado_em' into v_config
  from public.config c where c.user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'nome', a.nome, 'valor', a.valor,
    'vencimento', a.vencimento, 'categoria', a.categoria, 'faturadoEm', a.faturado_em
  )), '[]'::jsonb) into v_assinaturas
  from public.assinaturas a where a.user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ct.id, 'nome', ct.nome,
    'diaFechamento', ct.dia_fechamento, 'diaVencimento', ct.dia_vencimento
  )), '[]'::jsonb) into v_cartoes
  from public.cartoes ct where ct.user_id = v_uid;

  return jsonb_build_object(
    'categorias', coalesce(v_config->'categorias', '[]'::jsonb),
    'ocultarCardAcumulado', coalesce(v_config->'ocultar_card_acumulado', 'false'::jsonb),
    'ocultarCardCartoes', coalesce(v_config->'ocultar_card_cartoes', 'false'::jsonb),
    'assinaturas', v_assinaturas,
    'cartoesConfig', v_cartoes
  );
end;
$$;
revoke all on function public.get_config() from public;
revoke execute on function public.get_config() from anon;
grant execute on function public.get_config() to authenticated;

create function public.salvar_config(p jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  insert into public.config (user_id, categorias, ocultar_card_acumulado, ocultar_card_cartoes)
  values (
    v_uid,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'categorias') x), '{}'),
    coalesce((p->>'ocultarCardAcumulado')::boolean, false),
    coalesce((p->>'ocultarCardCartoes')::boolean, false)
  )
  on conflict (user_id) do update set
    categorias = excluded.categorias,
    ocultar_card_acumulado = excluded.ocultar_card_acumulado,
    ocultar_card_cartoes = excluded.ocultar_card_cartoes;

  delete from public.assinaturas where user_id = v_uid;
  insert into public.assinaturas (id, user_id, nome, valor, vencimento, categoria, faturado_em)
  select (x->>'id')::bigint, v_uid, x->>'nome', (x->>'valor')::numeric,
         (x->>'vencimento')::int, x->>'categoria', x->>'faturadoEm'
  from jsonb_array_elements(coalesce(p->'assinaturas', '[]'::jsonb)) x;

  delete from public.cartoes where user_id = v_uid;
  insert into public.cartoes (id, user_id, nome, dia_fechamento, dia_vencimento)
  select (x->>'id')::bigint, v_uid, x->>'nome', (x->>'diaFechamento')::int, (x->>'diaVencimento')::int
  from jsonb_array_elements(coalesce(p->'cartoesConfig', '[]'::jsonb)) x;
end;
$$;
revoke all on function public.salvar_config(jsonb) from public;
revoke execute on function public.salvar_config(jsonb) from anon;
grant execute on function public.salvar_config(jsonb) to authenticated;

-- ---- get_mes / salvar_mes ----
create function public.get_mes(p_ano_mes text)
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
    'id', e.id, 'data', e.data, 'tipo', e.tipo, 'item', e.item, 'valor', e.valor, 'direcao', e.direcao
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
revoke all on function public.get_mes(text) from public;
revoke execute on function public.get_mes(text) from anon;
grant execute on function public.get_mes(text) to authenticated;

create function public.salvar_mes(p_ano_mes text, p_dados jsonb)
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
  insert into public.extrato (id, user_id, ano_mes, data, tipo, item, valor, direcao)
  select (x->>'id')::bigint, v_uid, p_ano_mes, (x->>'data')::date, x->>'tipo', x->>'item',
         (x->>'valor')::numeric, x->>'direcao'
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
revoke all on function public.salvar_mes(text, jsonb) from public;
revoke execute on function public.salvar_mes(text, jsonb) from anon;
grant execute on function public.salvar_mes(text, jsonb) to authenticated;

-- ---- get_meses_disponiveis: substitui o array config.meses (label é derivado no cliente) ----
create function public.get_meses_disponiveis()
returns text[]
language plpgsql
security definer set search_path = ''
as $$
begin
  return coalesce((
    select array_agg(m.ano_mes order by m.ano_mes)
    from public.meses m where m.user_id = auth.uid()
  ), '{}');
end;
$$;
revoke all on function public.get_meses_disponiveis() from public;
revoke execute on function public.get_meses_disponiveis() from anon;
grant execute on function public.get_meses_disponiveis() to authenticated;
