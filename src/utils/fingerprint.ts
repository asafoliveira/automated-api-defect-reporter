import crypto from 'node:crypto';
import type { FailurePayload } from './failurePayload.js';

/**
 * Deterministic fingerprint for deduplication.
 * fingerprint = hash(method + endpoint + status + errorMessage)
 */
export function fingerprint(data: FailurePayload): string {
  const input = `${data.method}|${data.endpoint}|${data.status}|${data.errorMessage}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
