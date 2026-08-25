// Configuração do Firebase, referências globais (auth, db) e estado global do app
        const firebaseConfig = {
            apiKey: "AIzaSyBJa2FQ7LGJNTIne8iiyRXCr0Og8V1NtVs",
            authDomain: "finance-pro-v1.firebaseapp.com",
            projectId: "finance-pro-v1",
            storageBucket: "finance-pro-v1.firebasestorage.app",
            messagingSenderId: "866672231232",
            appId: "1:866672231232:web:1b4401c3123bb42c26b0a5"
        };
        
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Único ponto de acesso aos documentos do usuário no Firestore.
        function getConfigDocRef() {
            return db.collection('users').doc(currentUser.uid).collection('config').doc('geral');
        }
        function getMesesCollectionRef() {
            return db.collection('users').doc(currentUser.uid).collection('meses');
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
