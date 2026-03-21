/** Formato do JSON de falha em artifacts/ */
export interface FailurePayload {
  endpoint: string;
  method: string;
  status: number;
  responseBody: unknown;
  requestBody: unknown;
  errorMessage: string;
  timestamp: string;
}

/** Contexto anexado pelo teste para o reporter. */
export interface FailureContext {
  endpoint: string;
  method: string;
  status: number;
  responseBody: unknown;
  requestBody: unknown;
}

export const FAILURE_CONTEXT_ATTACHMENT_NAME = 'failure-context';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function parseFailurePayload(data: unknown): FailurePayload | null {
  if (!isRecord(data)) return null;
  const { endpoint, method, status, responseBody, requestBody, errorMessage, timestamp } = data;
  if (
    typeof endpoint !== 'string' ||
    typeof method !== 'string' ||
    typeof status !== 'number' ||
    typeof errorMessage !== 'string' ||
    typeof timestamp !== 'string'
  ) {
    return null;
  }
  return {
    endpoint,
    method,
    status,
    responseBody: responseBody ?? null,
    requestBody: requestBody ?? null,
    errorMessage,
    timestamp,
  };
}
