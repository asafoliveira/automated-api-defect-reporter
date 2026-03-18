# Automated Bug Creation PoC

When an API test fails, this PoC:

1. **Captures** structured error data (endpoint, method, status, request/response body, error message) into JSON files under `artifacts/`.
2. **Fingerprints** the failure for deduplication: `hash(method + endpoint + status + errorMessage)`.
3. **Searches Jira** with JQL: `project = QA AND text ~ "<errorMessage>" AND status != Done`.
4. **If a matching issue exists** → adds a comment with the new occurrence timestamp and response body.
5. **If not** → calls an LLM (OpenAI) to generate bug content (summary, description, steps, expected, actual, severity), creates a new Jira bug with the fingerprint as a label, and attaches request/response JSON.

All of this can run automatically in GitHub Actions after the test step.

## Prerequisites

- Node.js 20+
- Environment variables (see below)

## Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `JIRA_EMAIL` | Jira account email |
| `JIRA_API_TOKEN` | Jira API token (Atlassian) |
| `JIRA_BASE_URL` | Jira base URL (e.g. `https://your-domain.atlassian.net`) |
| `OPENAI_API_KEY` | OpenAI API key for the LLM step |

Optional: `JIRA_PROJECT` (default `QA`), `JIRA_ISSUE_TYPE` (default `Bug`).

## Running locally

### 1. Install and run tests

```bash
cd bug-automation-poc
npm install
npx playwright test
```

Two tests are intentionally failing (wrong assertions on GET /posts and GET /posts/1). After the run, `artifacts/` will contain one JSON file per failure.

### 2. Process failures (Jira + LLM)

```bash
npx tsx scripts/processFailures.ts
```

This reads all `artifacts/*.json`, generates a fingerprint for each, searches Jira, then either comments on an existing issue or creates a new one (with LLM-generated content and an attachment).

## GitHub Actions

Workflow file: `.github/workflows/api-tests.yml` (in this repo).

- **Triggers:** `push` and `pull_request` on `main`/`master`.
- **Steps:** Checkout → Setup Node → Install deps (in `bug-automation-poc`) → Install Playwright → Run tests (`continue-on-error: true`) → Run `processFailures.ts`.

**Secrets** to configure in the repo:

- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_BASE_URL`
- `OPENAI_API_KEY`

## Artifact JSON shape

Each failure file in `artifacts/` has the form:

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

Deduplication uses a deterministic hash:

`fingerprint = sha256(method + "|" + endpoint + "|" + status + "|" + errorMessage)`

The same fingerprint is stored as a Jira label on newly created issues so future runs can optionally search by label for stronger deduplication.

## Project structure

```
bug-automation-poc/
  src/
    tests/          # Playwright API tests (JSONPlaceholder)
    jira/           # Jira REST client (search, create, comment, attach)
    goose/          # LLM client (OpenAI) for bug content generation
    utils/          # fingerprint, failurePayload type
    reporter/       # Custom reporter that writes failure JSON to artifacts/
  scripts/
    processFailures.ts
  artifacts/        # Failure JSON files (gitignored except .gitkeep)
  playwright.config.ts
  package.json
  tsconfig.json
```

## APIs under test

Base URL: `https://jsonplaceholder.typicode.com`

- GET /posts
- GET /posts/{id}
- POST /posts
- PUT /posts/{id}
- DELETE /posts/{id}
