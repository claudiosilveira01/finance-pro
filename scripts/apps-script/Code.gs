/**
 * ============================================================================
 * AUTOMAÇÃO: Extrato do Nubank por e-mail -> Supabase (Planner Financeiro)
 * ============================================================================
 * Roda no Google Apps Script (script.google.com), na conta do Gmail do Claudio —
 * NÃO faz parte do site/deploy do finance-pro. Fica aqui só como referência
 * versionada.
 *
 * O que faz: a cada execução (gatilho de tempo, ou o botão "Verificar agora" do
 * app via doGet), procura e-mails do Nubank com o extrato em anexo .csv, converte
 * cada linha numa transação no formato do app e chama a RPC `importar_extrato_email`
 * do Supabase — merge incremental, sem duplicar (dedup pelo "Identificador" do CSV).
 *
 * IMPORTANTE — como o Nubank manda esse e-mail: só quando ALGUÉM pede um extrato
 * dentro do app do Nubank. Esta automação cuida do "e-mail chegou -> app atualizado";
 * pedir o extrato no Nubank continua manual.
 *
 * As notificações de vencimento NÃO são mais responsabilidade deste script — foram
 * pra uma Supabase Edge Function (`avisos-vencimento`) com cron diário. Ver
 * supabase/functions/avisos-vencimento/.
 *
 * Configuração: ver SETUP.md nesta pasta.
 * ============================================================================
 */

const CONFIG = {
  GMAIL_QUERY: 'from:todomundo@nubank.com.br subject:"Extrato da sua conta do Nubank" has:attachment',
  LABEL_PROCESSADO: 'ExtratoNubank/Processado'
};

// Mesma lista de tipos de transação do parser do app (public/js/extrato.js),
// da mais específica pra mais genérica.
const TIPOS_TRANSACAO = [
  'Transferência recebida pelo Pix via Open Banking',
  'Transferência enviada pelo Pix via Open Banking',
  'Transferência recebida pelo Pix',
  'Transferência enviada pelo Pix',
  'Transferência Recebida',
  'Transferência Enviada',
  'Compra no débito',
  'Compra no crédito',
  'Pagamento de boleto efetuado',
  'Pagamento de fatura',
  'Aplicação RDB',
  'Resgate RDB',
  'Crédito em conta',
  'Débito em conta',
  'Depósito',
  'Estorno',
  'Saque'
].sort((a, b) => b.length - a.length);

/**
 * Ponto de entrada do gatilho de tempo. Editor do Apps Script > "Gatilhos" (relógio)
 * > Adicionar gatilho > processarExtratosNubank > a cada 1h (ou o que preferir).
 */
function processarExtratosNubank() {
  return processarExtratosNubankInterno_();
}

/**
 * Núcleo da importação, isolado pra poder ser chamado também pelo doGet() (botão
 * "Verificar agora" do app). Retorna um resumo { novosEmails, novasTransacoes, meses }.
 */
function processarExtratosNubankInterno_() {
  const label = obterOuCriarLabel_(CONFIG.LABEL_PROCESSADO);
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY + ' -label:"' + CONFIG.LABEL_PROCESSADO + '"');

  if (threads.length === 0) {
    Logger.log('Nenhum e-mail novo de extrato do Nubank encontrado.');
    return { novosEmails: 0, novasTransacoes: 0, meses: [] };
  }

  let transacoesTodas = [];
  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const anexoCsv = msg.getAttachments().find(a => a.getName().toLowerCase().endsWith('.csv'));
      if (!anexoCsv) {
        Logger.log('Mensagem sem anexo .csv, pulando: "' + msg.getSubject() + '"');
        return;
      }
      const transacoes = parseCsvNubank_(anexoCsv.getDataAsString('UTF-8'));
      Logger.log('Encontradas ' + transacoes.length + ' transacao(oes) em "' + msg.getSubject() + '".');
      transacoesTodas = transacoesTodas.concat(transacoes);
    });
    thread.addLabel(label);
  });

  if (transacoesTodas.length === 0) {
    Logger.log('E-mails encontrados, mas nenhuma transacao lida dos anexos.');
    return { novosEmails: threads.length, novasTransacoes: 0, meses: [] };
  }

  const resultado = enviarParaSupabase_(transacoesTodas);
  Logger.log('Supabase: ' + resultado.novasTransacoes + ' transacao(oes) nova(s) em ' + JSON.stringify(resultado.meses));
  return {
    novosEmails: threads.length,
    novasTransacoes: resultado.novasTransacoes,
    meses: resultado.meses
  };
}

/**
 * Endpoint HTTP — o botão "Verificar e-mail agora" do app dispara a importação sob
 * demanda. Implante como Web App (SETUP.md) e configure WEBAPP_SECRET_TOKEN nas
 * Propriedades do Script; sem o token certo na query string, a requisição é recusada.
 */
function doGet(e) {
  const tokenEsperado = PropertiesService.getScriptProperties().getProperty('WEBAPP_SECRET_TOKEN');
  const tokenRecebido = e && e.parameter && e.parameter.token;

  const json = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return json({ ok: false, erro: 'Nao autorizado.' });
  }
  try {
    const r = processarExtratosNubankInterno_();
    return json({ ok: true, novosEmails: r.novosEmails, novasTransacoes: r.novasTransacoes, meses: r.meses });
  } catch (erro) {
    Logger.log('ERRO (doGet): ' + erro.message + '\n' + erro.stack);
    return json({ ok: false, erro: erro.message });
  }
}

function obterOuCriarLabel_(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}

/** "01/04/2026" -> "2026-04-01" */
function converterData_(dataBr) {
  const [d, m, a] = dataBr.split('/');
  return a + '-' + m + '-' + d;
}

function encontrarTipo_(descricao) {
  for (const t of TIPOS_TRANSACAO) {
    if (descricao.toLowerCase().indexOf(t.toLowerCase()) === 0) return t;
  }
  return null;
}

function hashString_(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

/**
 * Parse do CSV do Nubank. Colunas: Data,Valor,Identificador,Descrição
 * A descrição já vem como "Tipo - resto" (ex: "Compra no débito - Mercado").
 * O "Identificador" é um UUID único por transação — vira o origemImportId (dedup).
 */
function parseCsvNubank_(csvTexto) {
  const linhas = Utilities.parseCsv(csvTexto);
  const transacoes = [];

  linhas.slice(1).forEach(colunas => {
    if (colunas.length < 4 || !colunas[0]) return;
    const dataBr = colunas[0];
    const valorStr = colunas[1];
    const identificador = colunas[2];
    const descricaoCompleta = colunas[3];
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || !identificador) return;

    const tipo = encontrarTipo_(descricaoCompleta) || descricaoCompleta.split(' - ')[0].trim();
    const resto = descricaoCompleta.slice(tipo.length).replace(/^\s*-\s*/, '').trim();
    let item = (resto.split(' - ')[0] || '').trim();
    if (item.length > 60) item = item.slice(0, 60).trim();
    if (!item) item = tipo;

    transacoes.push({
      id: hashString_(identificador),
      data: converterData_(dataBr),
      tipo: tipo,
      item: item,
      valor: Math.abs(valor),
      direcao: valor >= 0 ? 'entrada' : 'saida',
      origemImportId: identificador
    });
  });

  return transacoes;
}

/**
 * Chama a RPC importar_extrato_email do Supabase com a service_role key (guardada só
 * nas Propriedades do Script). A RPC agrupa por mês, cria a linha `meses` que faltar e
 * insere só as transações cujo origemImportId ainda não existe naquele mês.
 * Retorna { novasTransacoes, meses }.
 */
function enviarParaSupabase_(transacoes) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const serviceKey = props.getProperty('SUPABASE_SERVICE_KEY');
  const userId = props.getProperty('SUPABASE_USER_ID');
  if (!url || !serviceKey || !userId) {
    throw new Error('Propriedades SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_USER_ID nao configuradas. Ver SETUP.md.');
  }

  const resposta = UrlFetchApp.fetch(url.replace(/\/+$/, '') + '/rest/v1/rpc/importar_extrato_email', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey
    },
    payload: JSON.stringify({ p_user_id: userId, p_transacoes: transacoes }),
    muteHttpExceptions: true
  });

  const codigo = resposta.getResponseCode();
  const corpo = resposta.getContentText();
  if (codigo >= 300) {
    throw new Error('Supabase respondeu ' + codigo + ': ' + corpo);
  }
  const dados = JSON.parse(corpo);
  return { novasTransacoes: dados.novasTransacoes || 0, meses: dados.meses || [] };
}
