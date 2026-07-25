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
        // Preparado para a Fase 12 (compartilhamento): quando existir orcamentoAtivoId,
        // estas funções passam a apontar para orcamentos/{id} em vez de users/{uid}.
        function getConfigDocRef() {
            return db.collection('users').doc(currentUser.uid).collection('config').doc('geral');
        }
        function getMesesCollectionRef() {
            return db.collection('users').doc(currentUser.uid).collection('meses');
        }

        let currentUser = null;
        let categoriasAtuais = ["Alimentação", "Transporte", "Lazer", "Educação", "Assinaturas", "Saúde", "Comunicação", "Tributos", "PIX Terceiros", "Outros"];
        let assinaturasConfig = [];
        let mesesDisponiveis = [];
        
        let mesAtualKey = "";
        let ordFixas = { col: '', asc: true };
        let ordFaturamentos = { col: '', asc: true };
        let meuGraficoPizza;
        let meuGraficoBarra;
        let idEditandoFixa = null;
        let diaCalendarioSelecionado = null;

        const coresCategorias = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c', '#34495e', '#fd79a8', '#00cec9', '#6c5ce7', '#ff7675'];
