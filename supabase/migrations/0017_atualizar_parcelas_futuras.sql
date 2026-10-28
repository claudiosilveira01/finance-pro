-- Conta parcelada: ao editar a conta num mês, atualiza as parcelas dos meses seguintes.
--
-- Como funciona:
--   - Identifica a série antiga pelo nome e pelo total de parcelas antes da edição, e só mexe
--     em linhas de meses DEPOIS do mês que está aberto (o mês atual é salvo pelo salvar_mes).
--   - Parcelas futuras que ainda cabem no novo total são atualizadas (valor, dia, categoria,
--     observação, nome e número da parcela). Se já estavam pagas, continuam pagas.
--   - Parcelas que passam do novo total são removidas.
--   - Parcelas que faltam para chegar no novo total são criadas.
--   - Contas vinculadas (automáticas) nunca são tocadas.

create or replace function public.atualizar_parcelas_futuras(
    p_ano_mes text,
    p_nome_antigo text,
    p_total_antigo int,
    p_base jsonb,
    p_alvo uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
  v_atual int := (p_base->>'parcelaAtual')::int;
  v_total int := (p_base->>'parcelaTotal')::int;
  v_indice_mes int := substr(p_ano_mes, 1, 4)::int * 12 + substr(p_ano_mes, 6, 2)::int;
  r record;
  v_k int;
  v_mes text;
begin
  if v_atual is null or v_total is null or v_atual < 1 or v_total < v_atual then
    raise exception 'parcelas invalidas';
  end if;

  -- 1) Ajusta ou remove as parcelas futuras da série antiga
  for r in
    select f.id, f.ano_mes
    from public.fixas f
    where f.user_id = v_uid
      and f.nome = p_nome_antigo
      and f.parcela_total = p_total_antigo
      and f.vinculo_user_id is null
      and f.ano_mes > p_ano_mes
  loop
    v_k := (substr(r.ano_mes, 1, 4)::int * 12 + substr(r.ano_mes, 6, 2)::int) - v_indice_mes;
    if v_k <= v_total - v_atual then
      update public.fixas set
        nome = p_base->>'nome',
        valor = coalesce((p_base->>'valor')::numeric, 0),
        vencimento = (p_base->>'vencimento')::int,
        categoria = p_base->>'categoria',
        obs = coalesce(p_base->>'obs', ''),
        parcela_atual = v_atual + v_k,
        parcela_total = v_total
      where user_id = v_uid and ano_mes = r.ano_mes and id = r.id;
    else
      delete from public.fixas
      where user_id = v_uid and ano_mes = r.ano_mes and id = r.id;
    end if;
  end loop;

  -- 2) Cria as parcelas que ainda faltam até o novo total
  for v_k in 1 .. (v_total - v_atual) loop
    v_mes := to_char((p_ano_mes || '-01')::date + make_interval(months => v_k), 'YYYY-MM');

    insert into public.meses (user_id, ano_mes, saldo)
    values (v_uid, v_mes, 0)
    on conflict (user_id, ano_mes) do nothing;

    if not exists (
      select 1 from public.fixas f
      where f.user_id = v_uid and f.ano_mes = v_mes and f.nome = p_base->>'nome'
        and f.parcela_total = v_total and f.parcela_atual = v_atual + v_k
    ) then
      insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, parcela_atual, parcela_total)
      values (
        (extract(epoch from clock_timestamp()) * 1000)::bigint + (random() * 100000)::int,
        v_uid, v_mes, p_base->>'nome',
        coalesce((p_base->>'valor')::numeric, 0),
        (p_base->>'vencimento')::int,
        p_base->>'categoria',
        coalesce(p_base->>'obs', ''),
        false, v_atual + v_k, v_total
      );
    end if;
  end loop;
end;
$function$;

revoke all on function public.atualizar_parcelas_futuras(text, text, int, jsonb, uuid) from public;
revoke execute on function public.atualizar_parcelas_futuras(text, text, int, jsonb, uuid) from anon;
grant execute on function public.atualizar_parcelas_futuras(text, text, int, jsonb, uuid) to authenticated;
