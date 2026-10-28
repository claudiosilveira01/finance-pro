-- Conta vinculada "falta do orçamento": o administrador cobre, todo mês, a parte que falta no
-- orçamento de outra conta vinculada (ex.: Carla).
--
-- Regra (tipo 'restante_orcamento', já existente em vinculos_fixos):
--   falta = total das contas fixas da conta vinculada no mês
--         - total das receitas da conta vinculada no mês
--   Se a falta for zero ou negativa, a linha NÃO aparece naquele mês.
--
-- Observação: o nome do tipo ('restante_orcamento') é histórico. Antes desta migration ele
-- somava só as contas não pagas. Nenhum vínculo tinha sido criado, então a mudança de regra
-- não afeta dados existentes.

-- 1) Valor da linha vinculada no mês
create or replace function public._valor_vinculado(p_tipo text, p_alvo uuid, p_ano_mes text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
    select case when p_tipo = 'restante_orcamento' then
        greatest(0,
            coalesce((
                select sum(f.valor) from public.fixas f
                where f.user_id = p_alvo and f.ano_mes = p_ano_mes
            ), 0)
            - coalesce((
                select sum(r.valor) from public.faturamentos r
                where r.user_id = p_alvo and r.ano_mes = p_ano_mes
            ), 0)
        )
    else 0 end
$function$;

-- 2) get_mes: esconde a linha vinculada quando a falta do mês é zero
create or replace function public.get_mes(p_ano_mes text, p_alvo uuid default null)
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
  from public.fixas f
  where f.user_id = v_uid and f.ano_mes = p_ano_mes
    and (f.vinculo_user_id is null
         or public._valor_vinculado(f.vinculo_tipo, f.vinculo_user_id, p_ano_mes) > 0);

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
