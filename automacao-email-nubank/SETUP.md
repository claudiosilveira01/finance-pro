# Automação: extrato do Nubank por e-mail → Firestore

Este guia configura o `Code.gs` desta pasta pra rodar sozinho no Google Apps Script,
lendo o e-mail "Extrato da sua conta do Nubank" (enviado por `todomundo@nubank.com.br`
sempre que você pede um extrato no app do Nubank) e atualizando o Planner Financeiro
sem precisar abrir o site.

**Importante sobre o gatilho:** o Nubank manda esse e-mail sob demanda — quando você
pede um extrato no app dele, não numa rotina mensal automática. Esta automação cuida
do "e-mail chegou → sistema atualizado sozinho"; pedir o extrato no Nubank continua
sendo manual.

## 1. Criar a conta de serviço (Google Cloud)

Uma conta de serviço é uma credencial que deixa o Apps Script escrever no Firestore
sem passar pelo login do app (ela ignora as regras de segurança do `firestore.rules`,
do mesmo jeito que o Firebase Admin SDK faria — por isso a chave dela precisa ficar
só nas Propriedades do Script, nunca em outro lugar).

1. Acesse **https://console.cloud.google.com/iam-admin/serviceaccounts?project=finance-pro-v1**
   (mesmo projeto do Firebase — pode pedir pra você confirmar que é esse o projeto certo).
2. **Criar conta de serviço** → dê um nome (ex: `extrato-automacao`) → **Criar e continuar**.
3. Em "Conceder acesso", escolha o papel **Cloud Datastore User** (dá permissão de
   leitura/escrita no Firestore) → **Concluir**.
4. Clique na conta recém-criada → aba **Chaves** → **Adicionar chave** → **Criar nova
   chave** → tipo **JSON** → confirma. Um arquivo `.json` será baixado — guarde-o num
   lugar seguro (ele não deve ir para o GitHub nem para lugar nenhum público).

## 2. Pegar seu UID do Firebase Auth

1. Acesse **https://console.firebase.google.com/project/finance-pro-v1/authentication/users**
2. Encontre a linha com seu e-mail de login do finance-pro.
3. Copie o valor da coluna **User UID**.

## 3. Criar o projeto no Apps Script

1. Acesse **https://script.google.com/** → **Novo projeto**.
2. Apague o conteúdo padrão do arquivo `Code.gs` e cole o conteúdo do arquivo
   `Code.gs` desta pasta.
3. Renomeie o projeto (ícone de nome no topo) para algo como
   "Extrato Nubank → Finance Pro".

## 4. Configurar as Propriedades do Script

No editor: ⚙️ **Configurações do projeto** → **Propriedades do script** →
**Adicionar propriedade do script**. Adicione estas 4:

| Propriedade | Valor |
|---|---|
| `FIRESTORE_PROJECT_ID` | `finance-pro-v1` |
| `FIRESTORE_CLIENT_EMAIL` | campo `client_email` do JSON baixado no passo 1 |
| `FIRESTORE_PRIVATE_KEY` | campo `private_key` do JSON baixado (cole inteiro, incluindo as linhas `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`) |
| `FIRESTORE_USER_UID` | o UID copiado no passo 2 |

## 5. Testar manualmente (antes de automatizar)

1. No editor do Apps Script, escolha a função `processarExtratosNubank` no menu
   suspenso ao lado do botão **Executar** → clique em **Executar**.
2. Na primeira vez, o Google vai pedir autorização — é a sua própria conta pedindo
   acesso ao seu próprio Gmail e à API do Firestore. Revise e autorize.
3. Confira o **Log de execução** (aparece embaixo) — ele mostra quantos e-mails e
   transações foram encontrados.
4. Confira no [Firebase Console](https://console.firebase.google.com/project/finance-pro-v1/firestore)
   se o campo `extrato` do mês certo (`users/{seu UID}/meses/AAAA-MM`) foi atualizado.
5. Abra o finance-pro normalmente e veja se o card de Extrato Bancário mostra as
   movimentações novas.

Rodar de novo é seguro — transações já importadas não duplicam (o script usa o
`Identificador` único que o próprio Nubank manda no CSV).

## 6. Automatizar (gatilho de tempo)

1. No editor: ícone de relógio ⏰ **Gatilhos** → **Adicionar gatilho**.
2. Função a ser executada: `processarExtratosNubank`.
3. Origem do evento: **Baseado em tempo**.
4. Tipo: **Temporizador por hora** (ou o intervalo que preferir — de hora em hora é
   um bom padrão; não precisa ser mais frequente que isso).
5. **Salvar**.

Pronto — a partir de agora, toda vez que você pedir um extrato no app do Nubank, em
até uma hora o Planner Financeiro já vai estar com os dados atualizados sozinho.

## Sobre segurança

A chave da conta de serviço (passo 1) tem acesso de leitura/escrita a **todo** o
Firestore do projeto `finance-pro-v1` (o Firestore não tem como restringir uma
conta de serviço a "só os dados de um usuário" — isso só existe nas regras de
segurança do cliente, que essa credencial ignora). Como hoje só existe a sua conta
nesse projeto, o risco prático é baixo, mas trate esse arquivo `.json` como uma
senha: não envie por e-mail, não coloque em repositórios, e se desconfiar que
vazou, revogue a chave em
Google Cloud Console → IAM e administrador → Contas de serviço → (a conta) → Chaves.
