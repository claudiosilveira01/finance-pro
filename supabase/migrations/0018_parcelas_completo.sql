-- Parcelamento completo: qualquer mudança numa conta (virar parcelada, deixar de ser parcelada,
-- mudar o total ou a parcela, excluir) reflete nos meses seguintes, no banco.
--
-- 1) atualizar_parcelas_futuras passa a cobrir também:
--    - conta comum -> parcelada: as linhas futuras de conta comum recebem os números das
--      parcelas; as que passam do total são removidas e as que faltam são criadas.
--    - parcelada -> conta comum: as linhas futuras continuam existindo (a conta segue nos
--      meses), mas perdem o número da parcela.
--    - parcelada -> parcelada: como antes (ajusta valor, dia, nome, categoria, número e total).
--    Linhas já pagas continuam pagas. Contas vinculadas (automáticas) nunca são tocadas.
--
-- 2) apagar_parcelas_futuras: ao excluir uma conta parcelada, remove as parcelas dos meses
--    seguintes. As parcelas dos meses já passados ficam como histórico.

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
  if v_total is not null and (v_atual is null or v_atual < 1 or v_total < v_atual) then
    raise exception 'parcelas invalidas';
  end if;

  -- 1) Linhas futuras da série antiga (mesmo nome e mesmo total, ou ambos sem parcela)
  for r in
    select f.id, f.ano_mes
    from public.fixas f
    where f.user_id = v_uid
      and f.nome = p_nome_antigo
      and f.parcela_total is not distinct from p_total_antigo
      and f.vinculo_user_id is null
      and f.ano_mes > p_ano_mes
  loop
    v_k := (substr(r.ano_mes, 1, 4)::int * 12 + substr(r.ano_mes, 6, 2)::int) - v_indice_mes;

    if v_total is null then
      -- Virou conta comum: continua nos meses, sem número de parcela
      update public.fixas set
        nome = p_base->>'nome',
        valor = coalesce((p_base->>'valor')::numeric, 0),
        vencimento = (p_base->>'vencimento')::int,
        categoria = p_base->>'categoria',
        obs = coalesce(p_base->>'obs', ''),
        parcela_atual = null,
        parcela_total = null
      where user_id = v_uid and ano_mes = r.ano_mes and id = r.id;
    elsif v_k <= v_total - v_atual then
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
  if v_total is not null then
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
  end if;
end;
$function$;

create or replace function public.apagar_parcelas_futuras(
    p_ano_mes text,
    p_nome text,
    p_total int,
    p_alvo uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
begin
  delete from public.fixas
  where user_id = v_uid
    and nome = p_nome
    and parcela_total = p_total
    and vinculo_user_id is null
    and ano_mes > p_ano_mes;
end;
$function$;

revoke all on function public.apagar_parcelas_futuras(text, text, int, uuid) from public;
revoke execute on function public.apagar_parcelas_futuras(text, text, int, uuid) from anon;
grant execute on function public.apagar_parcelas_futuras(text, text, int, uuid) to authenticated;
