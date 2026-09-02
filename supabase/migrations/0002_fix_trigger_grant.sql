-- Correção de segurança: a função de trigger public.set_atualizado_em() foi criada como
-- SECURITY DEFINER e continuava executável via /rest/v1/rpc/ por anon e authenticated,
-- porque o grant default de EXECUTE vem por PUBLIC (revogar só de anon/authenticated no
-- 0001_init.sql não teve efeito). Trigger function não precisa de DEFINER — roda no
-- contexto do statement que disparou a trigger de qualquer forma.
--
-- O 0001_init.sql já foi corrigido para nascer certo num db push limpo; esta migration
-- aplica a mesma correção no banco que já tinha o 0001_init.sql antigo.

alter function public.set_atualizado_em() security invoker;
revoke execute on function public.set_atualizado_em() from public;
