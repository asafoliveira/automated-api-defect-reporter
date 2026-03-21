import crypto from 'node:crypto';
import type { FailurePayload } from './failurePayload.js';

function cleanForFingerprint(s: string): string {
  return s.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\s+/g, ' ').trim();
}

/** Fingerprint para deduplicação (hash estável da falha). */
export function fingerprint(data: FailurePayload): string {
  const errorClean = cleanForFingerprint(data.errorMessage);
  const input = `${data.method}|${data.endpoint}|${data.status}|${errorClean}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}
