-- Remove as FKs de cartao_faturas.cartao_id e fixas.origem_cartao_id para public.cartoes.
--
-- Motivo: o cliente grava o cadastro do cartão (salvar_config) e a fatura / conta fixa
-- vinculada (salvar_mes) em chamadas separadas e sem ordem garantida. Com a FK, um salvar_mes
-- que chegasse antes do salvar_config falhava por violação de FK. O app sempre tolerou
-- referência órfã a cartão (comportamento herdado do Firestore) — deletarCartao já limpa a
-- fatura e a fixa vinculada do mês em JS.
--
-- Os índices que cobriam essas FKs (0003) também saem — não têm mais uso (nenhuma query SQL
-- filtra por essas colunas; a lógica é toda em memória no cliente).

alter table public.cartao_faturas drop constraint if exists cartao_faturas_cartao_id_fkey;
alter table public.fixas          drop constraint if exists fixas_origem_cartao_id_fkey;

drop index if exists public.cartao_faturas_cartao_id_idx;
drop index if exists public.fixas_origem_cartao_id_idx;
