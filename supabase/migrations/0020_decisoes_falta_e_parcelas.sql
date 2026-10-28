-- Decisões do Cláudio (28/10/2026). Já aplicada no banco.
-- 1) Falta da Carla só existe se houver receita cadastrada no mês.
-- 2) Conta que deixa de ser parcelada é removida dos meses seguintes.
--    (Excluir conta parcelada continua apagando os meses seguintes: apagar_parcelas_futuras, 0018.)

create or replace function public._valor_vinculado(p_tipo text, p_alvo uuid, p_ano_mes text)
returns numeric language sql stable security definer set search_path = ''
as $function$
    select case when p_tipo = 'restante_orcamento'
                 and exists (select 1 from public.faturamentos r where r.user_id = p_alvo and r.ano_mes = p_ano_mes)
    then greatest(0,
            coalesce((select sum(f.valor) from public.fixas f where f.user_id = p_alvo and f.ano_mes = p_ano_mes), 0)
          - coalesce((select sum(r.valor) from public.faturamentos r where r.user_id = p_alvo and r.ano_mes = p_ano_mes), 0))
    else 0 end
$function$;

create or replace function public.atualizar_parcelas_futuras(p_ano_mes text, p_nome_antigo text, p_total_antigo int, p_base jsonb, p_alvo uuid default null)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := public._uid_alvo(p_alvo);
  v_atual int := (p_base->>'parcelaAtual')::int;
  v_total int := (p_base->>'parcelaTotal')::int;
  v_indice_mes int := substr(p_ano_mes, 1, 4)::int * 12 + substr(p_ano_mes, 6, 2)::int;
  r record; v_k int; v_mes text;
begin
  if v_total is not null and (v_atual is null or v_atual < 1 or v_total < v_atual) then raise exception 'parcelas invalidas'; end if;
  for r in select f.id, f.ano_mes from public.fixas f where f.user_id = v_uid and f.nome = p_nome_antigo and f.parcela_total is not distinct from p_total_antigo and f.vinculo_user_id is null and f.ano_mes > p_ano_mes loop
    v_k := (substr(r.ano_mes, 1, 4)::int * 12 + substr(r.ano_mes, 6, 2)::int) - v_indice_mes;
    if v_total is not null and v_k <= v_total - v_atual then
      update public.fixas set nome = p_base->>'nome', valor = coalesce((p_base->>'valor')::numeric, 0), vencimento = (p_base->>'vencimento')::int, categoria = p_base->>'categoria', obs = coalesce(p_base->>'obs', ''), parcela_atual = v_atual + v_k, parcela_total = v_total where user_id = v_uid and ano_mes = r.ano_mes and id = r.id;
    elsif v_total is null and p_total_antigo is null then
      null; -- conta comum que continua comum: nada a fazer nos meses seguintes
    else
      delete from public.fixas where user_id = v_uid and ano_mes = r.ano_mes and id = r.id;
    end if;
  end loop;
  if v_total is not null then
    for v_k in 1 .. (v_total - v_atual) loop
      v_mes := to_char((p_ano_mes || '-01')::date + make_interval(months => v_k), 'YYYY-MM');
      insert into public.meses (user_id, ano_mes, saldo) values (v_uid, v_mes, 0) on conflict (user_id, ano_mes) do nothing;
      if not exists (select 1 from public.fixas f where f.user_id = v_uid and f.ano_mes = v_mes and f.nome = p_base->>'nome' and f.parcela_total = v_total and f.parcela_atual = v_atual + v_k) then
        insert into public.fixas (id, user_id, ano_mes, nome, valor, vencimento, categoria, obs, pago, parcela_atual, parcela_total)
        values ((extract(epoch from clock_timestamp()) * 1000)::bigint + (random() * 100000)::int, v_uid, v_mes, p_base->>'nome', coalesce((p_base->>'valor')::numeric, 0), (p_base->>'vencimento')::int, p_base->>'categoria', coalesce(p_base->>'obs', ''), false, v_atual + v_k, v_total);
      end if;
    end loop;
  end if;
end;
$function$;
