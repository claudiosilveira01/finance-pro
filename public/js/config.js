// Cliente Supabase, helper de RPC e estado global do app
        const SUPABASE_URL = "https://jasrlsyfsbagnkkhifxq.supabase.co";
        // Chave publishable (pública — pode ficar no código do cliente, o RLS é a barreira real).
        const SUPABASE_KEY = "sb_publishable_FYufcM7KqKg1s_OGVopj3w_vO7INmEq";

        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Único ponto de acesso ao banco: toda leitura/escrita passa por uma RPC do Postgres
        // (get_config/salvar_config, get_mes/salvar_mes, get_meses_disponiveis, renomear_categoria,
        // repetir_fixa). Erro vira exceção — os módulos já tratam com toast + "Tentar de novo".
        async function rpc(nome, args) {
            const { data, error } = await sb.rpc(nome, args || {});
            if (error) throw error;
            return data;
        }

        // "YYYY-MM" -> "Setembro / 2026". A lista de meses não é persistida: o banco guarda só os
        // ano_mes distintos (get_meses_disponiveis) e o label é derivado aqui, no cliente.
        const _NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        function _labelMes(key) {
            const [ano, mes] = key.split('-');
            return `${_NOMES_MES[parseInt(mes, 10) - 1]} / ${ano}`;
        }
        // Monta mesesDisponiveis ([{key,label}]) a partir do array de strings do get_meses_disponiveis.
        function _montarMesesDisponiveis(anoMesArray) {
            return (anoMesArray || []).map(key => ({ key, label: _labelMes(key) }));
        }

        let currentUser = null;
        let categoriasAtuais = ["Alimentação", "Transporte", "Lazer", "Educação", "Assinaturas", "Saúde", "Comunicação", "Tributos", "PIX Terceiros", "Outros"];
        let assinaturasConfig = [];
        let cartoesConfig = [];
        let mesesDisponiveis = [];

        let mesAtualKey = "";
        let ordFixas = { levels: [] };
        let ordFaturamentos = { levels: [] };
        let ordExtrato = { col: 'data', asc: false };
        let meuGraficoPizza;
        let meuGraficoBarra;
        let chartSobraFalta;
        let chartCartaoCategoria;
        let idEditandoFixa = null;
        let idEditandoFaturamento = null;
        let diaCalendarioSelecionado = null;
        let fixasSelecionadas = new Set();
        let extratoSelecionados = new Set();
        let extratoOrdemTipo = 'alfabetica'; // 'alfabetica' | 'valor' — classificação do resumo por tipo no card Extrato
        let ocultarCardAcumulado = false;
        let ocultarCardCartoes = false;
        let cartaoSelecionadoId = null;

        // Filtros em cascata para contas fixas
        let filtrosFixas = { valorMin: null, valorMax: null, vencimento: '', pago: '' };

        // Controla quando as animações de entrada (badges, listas, odômetro lento) tocam:
        // só na carga inicial, troca de mês ou troca de aba no mobile — nunca ao selecionar/marcar itens.
        let animarNaCarga = true;

        const coresCategorias = ['#6D4FEA', '#4F6EF7', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#A855F7', '#EF4444', '#3B82F6', '#14B8A6', '#F97316', '#8B5CF6'];
