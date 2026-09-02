-- RPCs para operações que varrem vários meses do usuário — antes o cliente Firebase fazia
-- isso com um laço de leituras+escritas mês a mês. Agora é uma chamada só, atômica.

-- ---- renomear_categoria: propaga o novo nome pra fixas e transações de cartão de TODOS os
--      meses. O array config.categorias e o mês atual continuam indo pelo caminho normal
--      (salvarConfigGlobal / salvarDadosDoMesAtual) no cliente. ----
create function public.renomear_categoria(p_antigo text, p_novo text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.fixas set categoria = p_novo
   where user_id = v_uid and categoria = p_antigo;

  update public.cartao_transacoes set categoria = p_novo
   where user_id = v_uid and categoria = p_antigo;
end;
$$;
revoke all on function public.renomear_categoria(text, text) from public;
revoke execute on function public.renomear_categoria(text, text) from anon;
grant execute on function public.renomear_categoria(text, text) to authenticated;

-- ---- repetir_fixa: cria a mesma conta fixa em cada mês de (p_de + 1 mês) até p_ate,
--      inclusive, criando a linha em `meses` quando faltar. Devolve a lista atualizada de
--      meses do usuário pro cliente recarregar o seletor. ----
create function public.repetir_fixa(p_base jsonb, p_de text, p_ate text)
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

    insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, origem_cartao_id)
    values (
      (extract(epoch from clock_timestamp()) * 1000)::bigint + (random() * 100000)::int,
      v_uid, v_mes,
      p_base->>'nome',
      coalesce((p_base->>'valor')::numeric, 0),
      (p_base->>'vencimento')::int,
      p_base->>'categoria',
      coalesce(p_base->>'obs', ''),
      false, null
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
