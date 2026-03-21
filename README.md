# PoC de criação automática de bugs

Quando um teste de API falha, esta PoC:

1. **Captura** dados estruturados da falha (endpoint, método, status, corpo da requisição/resposta, mensagem de erro) em arquivos JSON em `artifacts/`.
2. **Gera um fingerprint** para deduplicação: `hash(método + endpoint + status + mensagemDeErro)`.
3. **Consulta o Jira** com JQL: `project = QA AND labels = "<fingerprint>" AND status != Done`.
4. **Se já existir um issue correspondente** → adiciona um comentário com o horário da nova ocorrência e o corpo da resposta.
5. **Se não** → preenche o template `templates/bug-api.md` com os dados da falha, cria um novo bug no Jira com o fingerprint como label e anexa o JSON de requisição/resposta.

Tudo isso pode rodar automaticamente no GitHub Actions após a etapa de testes.

## Pré-requisitos

- Node.js 20+
- Variáveis de ambiente (veja abaixo)

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Descrição |
|----------|-----------|
| `JIRA_EMAIL` | E-mail da conta Jira |
| `JIRA_API_TOKEN` | Token de API do Jira (Atlassian) |
| `JIRA_BASE_URL` | URL base do Jira (ex.: `https://seu-dominio.atlassian.net`) |
| `JIRA_PROJECT` | Chave do projeto (ex.: `QA`). **Obrigatório** para criar no projeto certo (local e Actions). |
| `JIRA_ISSUE_TYPE` | Opcional (padrão `Bug`). |

## Execução local

### 1. Instalar e rodar os testes

```bash
cd bug-automation-poc
npm install
npx playwright test
```

Dois testes falham de propósito (asserções incorretas em GET /posts e GET /posts/1). Após a execução, `artifacts/` terá um arquivo JSON por falha.

### 2. Processar falhas (Jira)

```bash
npx tsx scripts/processFailures.ts
```

Lê todos os `artifacts/*.json`, gera um fingerprint para cada um, busca no Jira e então comenta em um issue existente ou cria um novo (conteúdo a partir de `templates/bug-api.md` e um anexo).

## GitHub Actions

Arquivo do workflow: `.github/workflows/api-tests.yml` (neste repositório).

- **Gatilhos:** `push` e `pull_request` em `main`/`master`.
- **Etapas:** Checkout → Configurar Node → Instalar dependências (em `bug-automation-poc`) → Instalar Playwright → Rodar testes (`continue-on-error: true`) → Executar `processFailures.ts`.

**Secrets** no repositório (Settings → Secrets and variables → Actions):

- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_BASE_URL`
- `JIRA_PROJECT` — mesma chave do `.env` (ex.: `QA`)
- `JIRA_ISSUE_TYPE` — opcional; se omitir, o script usa `Bug`

**Erro 410 na busca Jira (“API removida… migre para `/rest/api/3/search/jql`”):** o código deste repositório já usa esse endpoint. Faça **pull/push** da versão atual de `src/jira/client.ts` no remoto — pipelines com código antigo ainda chamavam `/rest/api/3/search`, que a Atlassian desligou.

## Formato do JSON em artifacts/

Cada arquivo de falha em `artifacts/` tem a forma:

```json
{
  "endpoint": "/posts",
  "method": "GET",
  "status": 200,
  "responseBody": { ... },
  "requestBody": null,
  "errorMessage": "Expected status 500, got 200",
  "timestamp": "2025-03-09T12:00:00.000Z"
}
```

## Fingerprint

A deduplicação usa um hash determinístico:

`fingerprint = sha256(método + "|" + endpoint + "|" + status + "|" + mensagemDeErro)`

O mesmo fingerprint é armazenado como label no Jira nos issues criados, para que execuções futuras possam buscar por label com deduplicação mais forte.

## Estrutura do projeto

```
bug-automation-poc/
  src/
    tests/          # Testes de API Playwright (JSONPlaceholder)
    jira/           # Cliente REST Jira (busca, criar, comentar, anexar)
    utils/          # fingerprint, failurePayload, bugTemplate
    reporter/       # Reporter customizado que grava JSON de falha em artifacts/
  scripts/
    processFailures.ts
  templates/
    bug-api.md      # Template da descrição do bug (placeholders: method, endpoint, status, etc.)
  artifacts/        # Arquivos JSON de falha (gitignored, exceto .gitkeep)
  playwright.config.ts
  package.json
  tsconfig.json
```

## APIs sob teste

URL base: `https://jsonplaceholder.typicode.com`

- GET /posts
- GET /posts/{id}
- POST /posts
- PUT /posts/{id}
- DELETE /posts/{id}
