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
  let erroExtrato = null;
  let resultado = { novosEmails: 0, novasTransacoes: 0 };
  try {
    resultado = processarExtratosNubankInterno_();
  } catch (erro) {
    Logger.log('ERRO: ' + erro.message + '\n' + erro.stack);
    erroExtrato = erro; // guardado pra relançar só depois de checar os vencimentos abaixo
  }

  // Reaproveita o mesmo gatilho de tempo pra também checar vencimentos e mandar notificação —
  // roda sempre, mesmo sem e-mail novo ou se a importação acima falhou (são coisas independentes).
  verificarVencimentosEEnviarPush();

  if (erroExtrato) throw erroExtrato;
  return resultado;
}

/**
 * Núcleo da importação, isolado de processarExtratosNubank() pra poder ser chamado
 * também pelo doGet() (botão "Verificar agora" do app) sem duplicar lógica.
 * Retorna um resumo pra exibir pro usuário (quantos e-mails/transações novas).
 */
function processarExtratosNubankInterno_() {
  const label = obterOuCriarLabel_(CONFIG.LABEL_PROCESSADO);
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY + ' -label:"' + CONFIG.LABEL_PROCESSADO + '"');

  if (threads.length === 0) {
    Logger.log('Nenhum e-mail novo de extrato do Nubank encontrado.');
    return { novosEmails: 0, novasTransacoes: 0 };
  }

  const token = obterTokenFirestore_();
  let novasTransacoesTotal = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const anexoCsv = msg.getAttachments().find(a => a.getName().toLowerCase().endsWith('.csv'));
      if (!anexoCsv) {
        Logger.log('Mensagem sem anexo .csv, pulando: "' + msg.getSubject() + '"');
        return;
      }
      const transacoes = parseCsvNubank_(anexoCsv.getDataAsString('UTF-8'));
      Logger.log(`Encontradas ${transacoes.length} transação(ões) em "${msg.getSubject()}".`);
      if (transacoes.length > 0) novasTransacoesTotal += salvarTransacoesNoFirestore_(transacoes, token);
    });
    thread.addLabel(label);
  });

  Logger.log('Concluído.');
  return { novosEmails: threads.length, novasTransacoes: novasTransacoesTotal };
}

/**
 * Ponto de entrada HTTP — permite o botão "Verificar e-mail agora" do app disparar a
 * importação sob demanda (em vez de esperar o gatilho de hora em hora). Implante como
 * Web App (veja SETUP.md, seção 7) e configure WEBAPP_SECRET_TOKEN nas Propriedades do
 * Script; sem o token certo na query string, a requisição é recusada.
 */
function doGet(e) {
  const tokenEsperado = PropertiesService.getScriptProperties().getProperty('WEBAPP_SECRET_TOKEN');
  const tokenRecebido = e && e.parameter && e.parameter.token;

  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: 'Não autorizado.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const resultado = processarExtratosNubankInterno_();
    verificarVencimentosEEnviarPush();
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      novosEmails: resultado.novosEmails,
      novasTransacoes: resultado.novasTransacoes
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (erro) {
    Logger.log('ERRO (doGet): ' + erro.message + '\n' + erro.stack);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: erro.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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

/** Agrupa por mês (AAAA-MM), mescla com o que já existe no Firestore (sem duplicar) e salva. Retorna quantas eram realmente novas. */
function salvarTransacoesNoFirestore_(transacoes, token) {
  const porMes = {};
  transacoes.forEach(t => {
    const mesKey = t.data.slice(0, 7);
    (porMes[mesKey] = porMes[mesKey] || []).push(t);
  });

  let totalNovas = 0;
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
    totalNovas += novas.length;
  });
  return totalNovas;
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
    const pushTokensMap = config.pushTokens || {};
    const deviceIds = Object.keys(pushTokensMap);
    if (deviceIds.length === 0) {
      Logger.log('Nenhum dispositivo com notificação ativada ainda.');
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const mesAtualKey = Utilities.formatDate(hoje, Session.getScriptTimeZone(), 'yyyy-MM');

    const jaNotificados = config.notificacoesEnviadas || {};
    const avisos = [];

    (config.assinaturas || []).forEach(sub => {
      if (sub.faturadoEm === mesAtualKey) return;
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

    // Double-check: relê config ANTES de marcar como notificado, pra evitar race condition
    // se dois gatilhos rodarem simultaneamente (ex: manual + automático)
    const configAntesEnvio = obterConfigGeral_(token);
    const jaNotificadosAntesEnvio = configAntesEnvio.notificacoesEnviadas || {};

    const avisosParaEnviar = avisos.filter(aviso => !jaNotificadosAntesEnvio[aviso.chave]);

    if (avisosParaEnviar.length === 0) {
      Logger.log('Todos os vencimentos já foram notificados (double-check).');
      return;
    }

    // Marca como notificado ANTES de disparar os pushes (race condition window ainda existe,
    // mas é bem menor agora). Atualiza os dicts para a tentativa de envio.
    avisosParaEnviar.forEach(aviso => { jaNotificados[aviso.chave] = true; });
    salvarNotificacoesEnviadas_(podarNotificacoesAntigas_(jaNotificados, mesAtualKey), token);

    // Use avisosParaEnviar ao invés de avisos para evitar reenviar os que já foram notificados
    const avisosAFinal = avisosParaEnviar;

    // Agrupa por token de push (não por deviceId): se o mesmo aparelho físico ficou registrado sob
    // dois deviceIds (ex.: PWA instalado na tela de início + aba do Safari, cada um com seu próprio
    // localStorage/deviceId), os dois apontam pro mesmo token do FCM — sem isso, cada vencimento
    // manda 2 notificações idênticas pro mesmo iPhone. Com o agrupamento, só 1 push sai por token.
    const deviceIdsPorToken = {};
    deviceIds.forEach(devId => {
      const tok = pushTokensMap[devId];
      (deviceIdsPorToken[tok] = deviceIdsPorToken[tok] || []).push(devId);
    });

    const deviceIdsInvalidos = new Set();
    avisosAFinal.forEach(aviso => {
      Object.keys(deviceIdsPorToken).forEach(fcmToken => {
        const ok = enviarPush_(token, fcmToken, aviso.titulo, aviso.corpo);
        if (!ok) deviceIdsPorToken[fcmToken].forEach(devId => deviceIdsInvalidos.add(devId));
      });
    });

    removerDispositivosInvalidos_(deviceIdsInvalidos, pushTokensMap, token);
    Logger.log(`${avisosAFinal.length} aviso(s) de vencimento enviado(s) para ${Object.keys(deviceIdsPorToken).length} token(s) único(s) (${deviceIds.length} dispositivo(s) registrado(s)).`);
  } catch (erro) {
    Logger.log('ERRO (push de vencimento): ' + erro.message + '\n' + erro.stack);
    // Não relança — uma falha aqui não deve derrubar a importação do extrato, que já rodou antes.
  }
}

/**
 * Remove do Firestore os dispositivos cujo token o FCM rejeitou como inexistente (app
 * reinstalado, notificação desativada etc.) — evita acumular lixo e notificação duplicada.
 * Cada aparelho tem uma identidade fixa (pushTokens é um mapa deviceId -> token, não uma lista
 * solta), então reativar num aparelho já conhecido SUBSTITUI a entrada dele em vez de somar.
 */
function removerDispositivosInvalidos_(deviceIdsInvalidosSet, pushTokensMap, token) {
  if (deviceIdsInvalidosSet.size === 0) return;
  const restante = {};
  Object.keys(pushTokensMap).forEach(devId => {
    if (!deviceIdsInvalidosSet.has(devId)) restante[devId] = pushTokensMap[devId];
  });
  salvarPushTokens_(restante, token);
  Logger.log(`${deviceIdsInvalidosSet.size} dispositivo(s) inválido(s) removido(s) automaticamente.`);
}

function salvarPushTokens_(pushTokensMap, token) {
  UrlFetchApp.fetch(urlConfigGeral_() + '?updateMask.fieldPaths=pushTokens', {
    method: 'patch',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify({ fields: { pushTokens: paraFirestoreValue_(pushTokensMap) } }),
    muteHttpExceptions: true
  });
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

/**
 * Só pra teste manual: manda uma notificação de mentira agora, pros dispositivos já
 * ativados, sem precisar de nenhuma conta vencendo. Selecione "testarPush" no menu ao
 * lado do botão Executar e clique em Executar.
 */
function testarPush() {
  const token = obterTokenFirestore_();
  const config = obterConfigGeral_(token);
  const pushTokensMap = config.pushTokens || {};
  const deviceIds = Object.keys(pushTokensMap);
  if (deviceIds.length === 0) {
    Logger.log('Nenhum dispositivo com notificação ativada ainda.');
    return;
  }
  const deviceIdsInvalidos = new Set();
  deviceIds.forEach(devId => {
    const ok = enviarPush_(token, pushTokensMap[devId], 'Teste — Planner Financeiro', 'Se isso chegou no seu celular, as notificações estão funcionando! 🎉');
    if (!ok) deviceIdsInvalidos.add(devId);
  });
  removerDispositivosInvalidos_(deviceIdsInvalidos, pushTokensMap, token);
  Logger.log(`Push de teste enviado para ${deviceIds.length - deviceIdsInvalidos.size} dispositivo(s) válido(s).`);
}

/** Manda o push; retorna false se o FCM disse que esse token não existe mais (celular/app reinstalado). */
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
  const codigo = resposta.getResponseCode();
  if (codigo >= 400) {
    Logger.log('Falha ao enviar push: ' + resposta.getContentText());
  }
  // 404/400 = token não existe mais pro FCM (não é um erro passageiro de rede).
  return codigo !== 404 && codigo !== 400;
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
