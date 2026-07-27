/**
 * ============================================================================
 * AUTOMAÇÃO: Extrato do Nubank por e-mail -> Firestore (Planner Financeiro)
 * ============================================================================
 * Este arquivo roda no Google Apps Script (script.google.com), na conta do
 * Gmail do Claudio — NÃO faz parte do site/deploy do finance-pro. Ele fica
 * aqui só como referência versionada junto com o resto do projeto.
 *
 * O que faz: a cada execução (disparada por um gatilho de tempo), procura
 * e-mails do Nubank com assunto "Extrato da sua conta do Nubank", pega o
 * anexo .csv (bem mais simples e confiável de ler que o PDF), transforma
 * cada linha numa transação no mesmo formato que o app já usa, e escreve
 * direto no Firestore — sem precisar abrir o finance-pro.
 *
 * IMPORTANTE — como o Nubank manda esse e-mail: só quando ALGUÉM pede um
 * extrato dentro do app do Nubank (não é uma rotina mensal automática do
 * banco). Ou seja, esta automação dispara sozinha assim que o e-mail chega,
 * mas ainda é preciso pedir o extrato no app do Nubank pra esse e-mail
 * existir.
 *
 * Também roda, no mesmo gatilho, o aviso de vencimento: verifica assinaturas
 * e contas fixas do mês e manda notificação push (Firebase Cloud Messaging)
 * pros dispositivos que ativaram "Notificações de vencimento" no app —
 * 3 dias antes e no dia do vencimento.
 *
 * Veja o arquivo SETUP.md (nesta mesma pasta) para o passo a passo completo
 * de configuração (conta de serviço do Google Cloud, propriedades do script,
 * gatilho de tempo).
 */

const CONFIG = {
  GMAIL_QUERY: 'from:todomundo@nubank.com.br subject:"Extrato da sua conta do Nubank" has:attachment',
  LABEL_PROCESSADO: 'ExtratoNubank/Processado',
  FIRESTORE_BASE: 'https://firestore.googleapis.com/v1'
};

// Mesma lista de tipos de transação usada no parser do app (js/extrato.js),
// ordenada da mais específica pra mais genérica.
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

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Ponto de entrada. Configure um gatilho de tempo (Editor do Apps Script >
 * ícone de relógio "Gatilhos" > Adicionar gatilho > esta função > a cada 1h,
 * por exemplo) apontando pra esta função.
 */
function processarExtratosNubank() {
  try {
    const label = obterOuCriarLabel_(CONFIG.LABEL_PROCESSADO);
    const threads = GmailApp.search(CONFIG.GMAIL_QUERY + ' -label:"' + CONFIG.LABEL_PROCESSADO + '"');

    if (threads.length === 0) {
      Logger.log('Nenhum e-mail novo de extrato do Nubank encontrado.');
      return;
    }

    const token = obterTokenFirestore_();

    threads.forEach(thread => {
      thread.getMessages().forEach(msg => {
        const anexoCsv = msg.getAttachments().find(a => a.getName().toLowerCase().endsWith('.csv'));
        if (!anexoCsv) {
          Logger.log('Mensagem sem anexo .csv, pulando: "' + msg.getSubject() + '"');
          return;
        }
        const transacoes = parseCsvNubank_(anexoCsv.getDataAsString('UTF-8'));
        Logger.log(`Encontradas ${transacoes.length} transação(ões) em "${msg.getSubject()}".`);
        if (transacoes.length > 0) salvarTransacoesNoFirestore_(transacoes, token);
      });
      thread.addLabel(label);
    });

    Logger.log('Concluído.');
  } catch (erro) {
    Logger.log('ERRO: ' + erro.message + '\n' + erro.stack);
    throw erro;
  }

  // Reaproveita o mesmo gatilho de tempo pra também checar vencimentos e mandar
  // notificação — assim não precisa configurar um segundo gatilho no Apps Script.
  verificarVencimentosEEnviarPush();
}

function obterOuCriarLabel_(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}

/** "01/04/2026" -> "2026-04-01" */
function converterData_(dataBr) {
  const [d, m, a] = dataBr.split('/');
  return `${a}-${m}-${d}`;
}

function encontrarTipo_(descricao) {
  for (const t of TIPOS_TRANSACAO) {
    if (descricao.toLowerCase().startsWith(t.toLowerCase())) return t;
  }
  return null;
}

function hashString_(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

/**
 * Faz o parse do CSV do Nubank. Colunas: Data,Valor,Identificador,Descrição
 * A descrição já vem como "Tipo - resto" (ex: "Compra no débito - Mercado"),
 * então a extração de tipo/item é bem mais simples que no parser de PDF.
 */
function parseCsvNubank_(csvTexto) {
  const linhas = Utilities.parseCsv(csvTexto);
  const transacoes = [];

  linhas.slice(1).forEach(colunas => {
    if (colunas.length < 4 || !colunas[0]) return;
    const [dataBr, valorStr, identificador, descricaoCompleta] = colunas;
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || !identificador) return;

    const tipo = encontrarTipo_(descricaoCompleta) || descricaoCompleta.split(' - ')[0].trim();
    const resto = descricaoCompleta.slice(tipo.length).replace(/^\s*-\s*/, '').trim();
    let item = (resto.split(' - ')[0] || '').trim();
    if (item.length > 60) item = item.slice(0, 60).trim();
    if (!item) item = tipo;

    transacoes.push({
      id: hashString_(identificador),
      idOrigem: identificador,
      data: converterData_(dataBr),
      tipo: tipo,
      item: item,
      valor: Math.abs(valor),
      direcao: valor >= 0 ? 'entrada' : 'saida'
    });
  });

  return transacoes;
}

/** Agrupa por mês (AAAA-MM), mescla com o que já existe no Firestore (sem duplicar) e salva. */
function salvarTransacoesNoFirestore_(transacoes, token) {
  const porMes = {};
  transacoes.forEach(t => {
    const mesKey = t.data.slice(0, 7);
    (porMes[mesKey] = porMes[mesKey] || []).push(t);
  });

  Object.keys(porMes).forEach(mesKey => {
    const doc = obterDocumentoMes_(mesKey, token);
    const extratoAtual = doc.extrato || [];
    const idsExistentes = new Set(extratoAtual.map(t => t.idOrigem || t.id));

    const novas = porMes[mesKey].filter(t => !idsExistentes.has(t.idOrigem));
    if (novas.length === 0) {
      Logger.log(`Mês ${mesKey}: nenhuma transação nova (${porMes[mesKey].length} já existiam).`);
      return;
    }

    salvarExtratoDoMes_(mesKey, extratoAtual.concat(novas), token);
    garantirMesNaLista_(mesKey, token);
    Logger.log(`Mês ${mesKey}: ${novas.length} transação(ões) nova(s) adicionada(s) (${porMes[mesKey].length - novas.length} já existiam).`);
  });
}

// ============================================================================
// AVISO DE VENCIMENTO: verifica assinaturas e contas fixas do mês atual e manda
// notificação push (via Firebase Cloud Messaging) pros dispositivos que
// ativaram "Notificações de vencimento" nas Configurações do app.
// Avisa 3 dias antes e no dia do vencimento (ver DIAS_DE_AVISO).
// ============================================================================

const DIAS_DE_AVISO = [3, 0];

function verificarVencimentosEEnviarPush() {
  try {
    const token = obterTokenFirestore_();
    const config = obterConfigGeral_(token);
    const pushTokens = config.pushTokens || [];
    if (pushTokens.length === 0) {
      Logger.log('Nenhum dispositivo com notificação ativada ainda.');
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const mesAtualKey = Utilities.formatDate(hoje, Session.getScriptTimeZone(), 'yyyy-MM');

    const jaNotificados = config.notificacoesEnviadas || {};
    const avisos = [];

    (config.assinaturas || []).forEach(sub => {
      if (sub.faturadoEm === mesAtualKey) return; // já marcada como faturada este mês
      const diasRestantes = diasAteVencimento_(hoje, sub.vencimento);
      if (DIAS_DE_AVISO.indexOf(diasRestantes) === -1) return;
      const chave = `assinatura-${sub.id}-${mesAtualKey}-${diasRestantes}`;
      if (jaNotificados[chave]) return;
      avisos.push({
        chave,
        titulo: diasRestantes === 0 ? `Vence hoje: ${sub.nome}` : `Vence em ${diasRestantes} dias: ${sub.nome}`,
        corpo: sub.valor ? `Assinatura — R$ ${sub.valor.toFixed(2)}` : 'Assinatura'
      });
    });

    const mesDoc = obterDocumentoMes_(mesAtualKey, token);
    (mesDoc.fixas || []).forEach(fixa => {
      if (fixa.pago) return;
      const diasRestantes = diasAteVencimento_(hoje, fixa.vencimento);
      if (DIAS_DE_AVISO.indexOf(diasRestantes) === -1) return;
      const chave = `fixa-${fixa.id}-${mesAtualKey}-${diasRestantes}`;
      if (jaNotificados[chave]) return;
      avisos.push({
        chave,
        titulo: diasRestantes === 0 ? `Vence hoje: ${fixa.nome}` : `Vence em ${diasRestantes} dias: ${fixa.nome}`,
        corpo: `Conta fixa — R$ ${fixa.valor.toFixed(2)}`
      });
    });

    if (avisos.length === 0) {
      Logger.log('Nenhum vencimento pra avisar hoje.');
      return;
    }

    avisos.forEach(aviso => {
      pushTokens.forEach(fcmToken => enviarPush_(token, fcmToken, aviso.titulo, aviso.corpo));
      jaNotificados[aviso.chave] = true;
    });

    salvarNotificacoesEnviadas_(podarNotificacoesAntigas_(jaNotificados, mesAtualKey), token);
    Logger.log(`${avisos.length} aviso(s) de vencimento enviado(s) para ${pushTokens.length} dispositivo(s).`);
  } catch (erro) {
    Logger.log('ERRO (push de vencimento): ' + erro.message + '\n' + erro.stack);
    // Não relança — uma falha aqui não deve derrubar a importação do extrato, que já rodou antes.
  }
}

/** Quantos dias faltam pro dia "diaVenc" do mês atual (0 = hoje, negativo = já passou). */
function diasAteVencimento_(hoje, diaVenc) {
  const dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
  return Math.round((dataVenc - hoje) / 86400000);
}

/** Mantém só o registro dos últimos 2 meses, pra esse mapa não crescer pra sempre no Firestore. */
function podarNotificacoesAntigas_(mapa, mesAtualKey) {
  const [ano, mes] = mesAtualKey.split('-').map(Number);
  const mesAnteriorKey = Utilities.formatDate(new Date(ano, mes - 2, 1), Session.getScriptTimeZone(), 'yyyy-MM');
  const podado = {};
  Object.keys(mapa).forEach(chave => {
    if (chave.indexOf('-' + mesAtualKey + '-') !== -1 || chave.indexOf('-' + mesAnteriorKey + '-') !== -1) {
      podado[chave] = mapa[chave];
    }
  });
  return podado;
}

function enviarPush_(tokenGoogle, fcmToken, titulo, corpo) {
  const projectId = PropertiesService.getScriptProperties().getProperty('FIRESTORE_PROJECT_ID');
  const resposta = UrlFetchApp.fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + tokenGoogle },
    contentType: 'application/json',
    payload: JSON.stringify({
      message: { token: fcmToken, notification: { title: titulo, body: corpo } }
    }),
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() >= 400) {
    Logger.log('Falha ao enviar push (token pode estar expirado): ' + resposta.getContentText());
  }
}

function obterConfigGeral_(token) {
  const resposta = UrlFetchApp.fetch(urlConfigGeral_(), {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() === 404) return {};
  return deFirestoreDocumento_(JSON.parse(resposta.getContentText()));
}

function salvarNotificacoesEnviadas_(mapa, token) {
  UrlFetchApp.fetch(urlConfigGeral_() + '?updateMask.fieldPaths=notificacoesEnviadas', {
    method: 'patch',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify({ fields: { notificacoesEnviadas: paraFirestoreValue_(mapa) } }),
    muteHttpExceptions: true
  });
}

// ============================================================================
// Firestore REST API — autenticação via conta de serviço (bypassa as regras
// de segurança do cliente, igual o Firebase Admin SDK faria; por isso a
// chave da conta de serviço precisa ficar só nas Propriedades do Script,
// nunca em texto solto em lugar nenhum).
// ============================================================================

function obterTokenFirestore_() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty('FIRESTORE_CLIENT_EMAIL');
  const privateKey = props.getProperty('FIRESTORE_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Propriedades FIRESTORE_CLIENT_EMAIL / FIRESTORE_PRIVATE_KEY não configuradas. Veja o SETUP.md.');
  }

  const agora = Math.floor(Date.now() / 1000);
  const base64url = obj => Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');

  const naoAssinado = base64url({ alg: 'RS256', typ: 'JWT' }) + '.' + base64url({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora
  });

  const assinatura = Utilities.computeRsaSha256Signature(naoAssinado, privateKey);
  const jwt = naoAssinado + '.' + Utilities.base64EncodeWebSafe(assinatura).replace(/=+$/, '');

  const resposta = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  const corpo = JSON.parse(resposta.getContentText());
  if (!corpo.access_token) throw new Error('Falha ao obter token do Firestore: ' + resposta.getContentText());
  return corpo.access_token;
}

function urlDocumentoMes_(mesKey) {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FIRESTORE_PROJECT_ID');
  const uid = props.getProperty('FIRESTORE_USER_UID');
  return `${CONFIG.FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/meses/${mesKey}`;
}

function urlConfigGeral_() {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FIRESTORE_PROJECT_ID');
  const uid = props.getProperty('FIRESTORE_USER_UID');
  return `${CONFIG.FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/config/geral`;
}

function obterDocumentoMes_(mesKey, token) {
  const resposta = UrlFetchApp.fetch(urlDocumentoMes_(mesKey), {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() === 404) return {};
  return deFirestoreDocumento_(JSON.parse(resposta.getContentText()));
}

/** PATCH só do campo "extrato" — updateMask garante que fixas/faturamentos/saldo não são tocados. */
function salvarExtratoDoMes_(mesKey, extrato, token) {
  UrlFetchApp.fetch(urlDocumentoMes_(mesKey) + '?updateMask.fieldPaths=extrato', {
    method: 'patch',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify({ fields: { extrato: paraFirestoreValue_(extrato) } }),
    muteHttpExceptions: true
  });
}

/** Garante que o mês apareça no seletor de meses do app (config/geral.meses), como addNovoMes() faz no cliente. */
function garantirMesNaLista_(mesKey, token) {
  const resposta = UrlFetchApp.fetch(urlConfigGeral_(), {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (resposta.getResponseCode() === 404) return; // config ainda não existe — o app cria isso no primeiro login

  const dados = deFirestoreDocumento_(JSON.parse(resposta.getContentText()));
  const meses = dados.meses || [];
  if (meses.some(m => m.key === mesKey)) return;

  const [ano, mes] = mesKey.split('-').map(Number);
  meses.push({ key: mesKey, label: `${MESES_NOMES[mes - 1]} / ${ano}` });
  meses.sort((a, b) => a.key.localeCompare(b.key));

  UrlFetchApp.fetch(urlConfigGeral_() + '?updateMask.fieldPaths=meses', {
    method: 'patch',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify({ fields: { meses: paraFirestoreValue_(meses) } }),
    muteHttpExceptions: true
  });
}

// ---------- Conversão entre JSON comum e o formato de valores do Firestore ----------

function paraFirestoreValue_(valor) {
  if (valor === null || valor === undefined) return { nullValue: null };
  if (typeof valor === 'string') return { stringValue: valor };
  if (typeof valor === 'number') return Number.isInteger(valor) ? { integerValue: String(valor) } : { doubleValue: valor };
  if (typeof valor === 'boolean') return { booleanValue: valor };
  if (Array.isArray(valor)) return { arrayValue: { values: valor.map(paraFirestoreValue_) } };
  if (typeof valor === 'object') {
    const fields = {};
    Object.keys(valor).forEach(k => { fields[k] = paraFirestoreValue_(valor[k]); });
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function deFirestoreValue_(campo) {
  if (!campo) return null;
  if ('stringValue' in campo) return campo.stringValue;
  if ('integerValue' in campo) return parseInt(campo.integerValue, 10);
  if ('doubleValue' in campo) return campo.doubleValue;
  if ('booleanValue' in campo) return campo.booleanValue;
  if ('nullValue' in campo) return null;
  if ('arrayValue' in campo) return (campo.arrayValue.values || []).map(deFirestoreValue_);
  if ('mapValue' in campo) {
    const obj = {};
    const fields = campo.mapValue.fields || {};
    Object.keys(fields).forEach(k => { obj[k] = deFirestoreValue_(fields[k]); });
    return obj;
  }
  return null;
}

function deFirestoreDocumento_(doc) {
  if (!doc || !doc.fields) return {};
  const obj = {};
  Object.keys(doc.fields).forEach(k => { obj[k] = deFirestoreValue_(doc.fields[k]); });
  return obj;
}
