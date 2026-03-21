import fs from 'node:fs';
import path from 'node:path';
import type { FailurePayload } from './failurePayload.js';

export interface BugContent {
  summary: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  severity: string;
  fullDescription?: string;
}

const SUMMARY_MAX_LENGTH = 120;
const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'bug-api.md');

/** Remove códigos ANSI da mensagem de erro. */
export function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').trim();
}

function oneLine(s: string): string {
  return stripAnsi(s).replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  const t = oneLine(s);
  return t.length <= max ? t : t.slice(0, max - 3) + '...';
}

function severityFromStatus(status: number): string {
  if (status >= 500) return 'Alto';
  if (status >= 400) return 'Médio';
  return 'Médio';
}

function summaryInPortuguese(method: string, endpoint: string, status: number, cleanMessage: string): string {
  const expectedReceived = /Expected:\s*(\S+)\s+Received:\s*(\S+)/i.exec(cleanMessage);
  const shortDesc = expectedReceived
    ? `esperado ${expectedReceived[1]}, recebido ${expectedReceived[2]}`
    : `status ${status} — resposta não conforme`;
  return truncate(`Falha de API: ${method} ${endpoint} — ${shortDesc}`, SUMMARY_MAX_LENGTH);
}

export function buildBugContentFromFailure(payload: FailurePayload): BugContent {
  const { endpoint, method, status, errorMessage } = payload;
  const cleanMessage = stripAnsi(errorMessage).replace(/\s+/g, ' ').trim();
  const severity = severityFromStatus(status);
  const summary = summaryInPortuguese(method, endpoint, status, cleanMessage);

  let fullDescription: string;
  if (fs.existsSync(TEMPLATE_PATH)) {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    fullDescription = template
      .replace(/\{\{method\}\}/g, method)
      .replace(/\{\{endpoint\}\}/g, endpoint)
      .replace(/\{\{status\}\}/g, String(status))
      .replace(/\{\{errorMessage\}\}/g, cleanMessage)
      .replace(/\{\{severity\}\}/g, severity);
  } else {
    fullDescription = [
      `Requisição ${method} ${endpoint} retornou status ${status}. ${cleanMessage}`,
      '',
      '**Passos para reproduzir:**',
      `1. Enviar requisição ${method} para ${endpoint}.`,
      '2. Ver anexo request-response.json.',
      '',
      '**Esperado:** Status e resposta conforme contrato do teste.',
      `**Atual:** ${cleanMessage} Status HTTP: ${status}.`,
      `**Severidade:** ${severity}`,
    ].join('\n');
  }

  return {
    summary,
    description: '',
    steps: '',
    expected: '',
    actual: '',
    severity,
    fullDescription,
  };
}
