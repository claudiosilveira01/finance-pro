# Automação: extrato do Nubank por e-mail → Supabase

Configura o `Code.gs` desta pasta pra rodar sozinho no Google Apps Script, lendo o e-mail
"Extrato da sua conta do Nubank" (enviado por `todomundo@nubank.com.br` sempre que você pede
um extrato no app do Nubank) e importando pro Planner Financeiro sem abrir o site.

> **Sobre o gatilho:** o Nubank manda esse e-mail sob demanda — quando você pede um extrato
> no app dele, não numa rotina automática. Esta automação cuida do "e-mail chegou → app
> atualizado"; pedir o extrato no Nubank continua manual.

> **Notificações de vencimento** não fazem mais parte deste script — foram pra uma Supabase
> Edge Function (`avisos-vencimento`) com cron diário.

---

## 1. Pegar as 3 credenciais do Supabase

Você vai precisar de:

| Propriedade | O que é | Onde pegar |
|---|---|---|
| `SUPABASE_URL` | `https://jasrlsyfsbagnkkhifxq.supabase.co` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_KEY` | A **service_role key** (secreta, ignora RLS) | Supabase → Project Settings → API Keys → `service_role` → *Reveal* |
| `SUPABASE_USER_ID` | O UUID do seu usuário (claudio) | Supabase → Authentication → Users → clique no seu e-mail → *User UID* |

> ⚠️ A `service_role key` é uma credencial poderosa (acesso total ao banco, sem RLS). Ela fica
> **só** nas Propriedades do Script do Apps Script — nunca em arquivo, repositório, e-mail ou
> chat. É o mesmo nível de sigilo da antiga conta de serviço do Firebase.

---

## 2. Criar o projeto no Apps Script

1. Acesse **https://script.google.com** (logado na conta do Gmail que recebe os e-mails do Nubank).
2. **Novo projeto**.
3. Apague o conteúdo do `Código.gs` e cole **todo** o `Code.gs` desta pasta.
4. Renomeie o projeto (ex.: "Extrato Nubank → Supabase").

---

## 3. Configurar as Propriedades do Script

1. No editor: engrenagem **⚙ Configurações do projeto** (menu lateral).
2. Role até **Propriedades do script** → **Adicionar propriedade do script**.
3. Adicione as 4:

| Propriedade | Valor |
|---|---|
| `SUPABASE_URL` | `https://jasrlsyfsbagnkkhifxq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | *(a service_role key)* |
| `SUPABASE_USER_ID` | *(o UUID do seu usuário)* |
| `WEBAPP_SECRET_TOKEN` | *(invente uma senha longa aleatória — ex.: 32+ caracteres)* |

4. **Salvar propriedades do script**.

---

## 4. Autorizar e testar

1. No editor, selecione a função **`processarExtratosNubank`** no seletor ao lado de ▶ Executar.
2. Clique em **▶ Executar**. O Google vai pedir autorização (Gmail + acesso à internet) —
   aceite (em "Este app não foi verificado", clique em *Avançado* → *Acessar (não seguro)*;
   é o seu próprio script).
3. Veja o **Registro de execução**: deve dizer quantos e-mails/transações processou (ou
   "Nenhum e-mail novo").
4. Confira no app (ou no Supabase → Table Editor → `extrato`) se as transações apareceram no
   mês certo. Rode **de novo** — não deve duplicar nada.

---

## 5. Gatilho de tempo (rodar sozinho)

1. Menu lateral → **⏰ Gatilhos** → **Adicionar gatilho**.
2. Função: `processarExtratosNubank` · Evento: *Baseado em tempo* · *Temporizador por hora* ·
   *A cada hora* (ou o que preferir).
3. **Salvar**.

---

## 6. Web App (botão "Verificar agora" do app)

1. Editor → **Implantar** → **Nova implantação**.
2. Tipo (engrenagem): **App da Web**.
3. *Executar como*: **Eu**. *Quem pode acessar*: **Qualquer pessoa**.
   (a proteção real é o `WEBAPP_SECRET_TOKEN` na query string; sem ele a requisição é recusada.)
4. **Implantar** → copie a **URL do app da Web** (`https://script.google.com/macros/s/…/exec`).

> A cada vez que você editar o `Code.gs`, faça **Implantar → Gerenciar implantações → editar
> (lápis) → Versão: Nova versão → Implantar** pra a URL passar a servir o código novo.

---

## 7. Ligar no app

No Finance PRO: **Configurações → Verificação Automática de Extrato**:

- **URL do App da Web**: a URL `.../exec` do passo 6.
- **Token**: o mesmo valor de `WEBAPP_SECRET_TOKEN`.
- **Salvar** (fica só no `localStorage` deste aparelho — não vai pro repositório).

Pronto. O botão **"Verificar e-mail agora"** dispara a importação sob demanda; o gatilho de
tempo faz o resto sozinho.

---

## Migração da versão antiga (Firestore)

Se você já tinha o script antigo rodando:

1. **Apague** as Propriedades `FIRESTORE_CLIENT_EMAIL`, `FIRESTORE_PRIVATE_KEY`,
   `FIRESTORE_PROJECT_ID`, `FIRESTORE_USER_UID`.
2. Adicione as 3 novas `SUPABASE_*` (passo 3). `WEBAPP_SECRET_TOKEN` pode continuar o mesmo.
3. Substitua o `Code.gs` inteiro pelo novo.
4. **Implantar → Gerenciar implantações → Nova versão** (a URL do Web App continua a mesma —
   não precisa reconfigurar no app).
5. A conta de serviço do Google Cloud (`extrato-automacao`) pode ser apagada — não é mais usada.
