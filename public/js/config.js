// Cliente Supabase, helper de RPC e estado global do app
        const SUPABASE_URL = "https://jasrlsyfsbagnkkhifxq.supabase.co";
        // Chave publishable (pública — pode ficar no código do cliente, o RLS é a barreira real).
        const SUPABASE_KEY = "sb_publishable_FYufcM7KqKg1s_OGVopj3w_vO7INmEq";

        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Único ponto de acesso ao banco: toda leitura/escrita passa por uma RPC do Postgres
        // (get_config/salvar_config, get_mes/salvar_mes, get_meses_disponiveis, renomear_categoria,
        // repetir_fixa). Erro vira exceção — os módulos já tratam com toast + "Tentar de novo".
        //
        // Timeout de 20s: projeto Supabase do plano free "pausa" sozinho depois de dias sem uso, e
        // ao acordar pode levar até ~1min pra responder de novo. Sem um limite aqui, sb.rpc() ficava
        // esperando pra sempre — o app travava no "Carregando..." sem nenhum aviso, com quem estava
        // usando sem saber se é falta de internet, banco pausado ou o quê. Com o limite, o erro
        // aparece rápido (com uma mensagem explicando a causa mais provável), e "Tentar de novo"
        // já dá certo assim que o banco termina de acordar.
        function _comLimiteDeTempo(promessa, ms) {
            return new Promise((resolve, reject) => {
                const cronometro = setTimeout(() => reject(Object.assign(new Error(
                    'O servidor demorou demais pra responder. Se ele ficou um tempo sem uso, pode levar '
                    + 'até 1 minuto pra "acordar" — tente de novo em instantes.'
                ), { isTimeout: true })), ms);
                promessa.then(
                    (v) => { clearTimeout(cronometro); resolve(v); },
                    (e) => { clearTimeout(cronometro); reject(e); }
                );
            });
        }

        async function rpc(nome, args, _retry) {
            const { data, error, status } = await _comLimiteDeTempo(sb.rpc(nome, args || {}), 20000);
            if (error) {
                // 401 logo após abrir o PWA no iPhone: o Safari acorda a aba, o supabase-js
                // dispara um refresh de token e, se alguma RPC sai em paralelo nesse instante
                // (ex.: os dois Promise.all de carregarConfigGlobal), pode pegar o token antigo
                // por uma corrida interna do cliente — não é sessão realmente expirada. Espera a
                // sessão assentar e tenta de novo, uma única vez, antes de propagar o erro.
                if (!_retry && status === 401) {
                    const { data: { session } } = await sb.auth.getSession();
                    if (session) return rpc(nome, args, true);
                }
                throw error;
            }
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

        // Estado de UI (filtros, ordenação de tabela, escolha do Sobra/Falta) persistido no
        // localStorage — por aparelho/navegador, não sincronizado entre dispositivos (não passa
        // pelo Supabase). Sobrevive a fechar a aba e trocar de mês, então o usuário não perde uma
        // ordenação/filtro que já tinha montado.
        function _salvarEstadoUI(chave, valor) {
            try { localStorage.setItem('estadoUI:' + chave, JSON.stringify(valor)); } catch (e) {}
        }
        function _lerEstadoUI(chave, padrao) {
            try {
                const bruto = localStorage.getItem('estadoUI:' + chave);
                return bruto != null ? JSON.parse(bruto) : padrao;
            } catch (e) { return padrao; }
        }

        let currentUser = null;
        let categoriasAtuais = ["Alimentação", "Transporte", "Lazer", "Educação", "Assinaturas", "Saúde", "Comunicação", "Tributos", "PIX Terceiros", "Outros"];
        let assinaturasConfig = [];
        let mesesDisponiveis = [];

        let mesAtualKey = "";
        let ordFixas = _lerEstadoUI('ordFixas', { levels: [] });
        let ordFaturamentos = _lerEstadoUI('ordFaturamentos', { levels: [] });
        let ordExtrato = _lerEstadoUI('ordExtrato', { col: 'data', asc: false });
        let meuGraficoPizza;
        let meuGraficoBarra;
        let chartSobraFalta;
        let idEditandoFixa = null;
        let idEditandoFaturamento = null;
        let diaCalendarioSelecionado = null;
        let fixasSelecionadas = new Set();
        let extratoSelecionados = new Set();
        let extratoOrdemTipo = 'alfabetica'; // 'alfabetica' | 'valor' — classificação do resumo por tipo no card Extrato
        let ocultarCardAcumulado = false;
        let ocultarCardExtrato = false;

        // Botão "Selecionar Contas" (ao lado de Filtros, em Contas Fixas): liga/desliga as bolinhas
        // de seleção da tabela e a linha "SOMA SELECIONADA" — por padrão ficam ocultas.
        let mostrarSelecaoFixas = _lerEstadoUI('mostrarSelecaoFixas', false);

        // Card "Sobra / Falta Estimada": qual botão de Orçamento/Receitas está ativo.
        let sobraFaltaOrcamentoEscolha = _lerEstadoUI('sobraFaltaOrcamento', 'fixo');
        let sobraFaltaReceitaEscolha = _lerEstadoUI('sobraFaltaReceita', 'nenhuma');

        // Filtros em cascata para contas fixas
        let filtrosFixas = _lerEstadoUI('filtrosFixas', { valorMin: null, valorMax: null, vencimento: '', pago: '' });

        // Controla quando as animações de entrada (badges, listas, odômetro lento) tocam:
        // só na carga inicial, troca de mês ou troca de aba no mobile — nunca ao selecionar/marcar itens.
        let animarNaCarga = true;

        const coresCategorias = ['#6D4FEA', '#4F6EF7', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#A855F7', '#EF4444', '#3B82F6', '#14B8A6', '#F97316', '#8B5CF6'];
