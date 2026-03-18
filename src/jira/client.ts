import fs from 'node:fs';
import path from 'node:path';
import type { JiraCreateIssuePayload, JiraCreateIssueResponse, JiraSearchResult } from './types.js';

const JIRA_EMAIL = process.env.JIRA_EMAIL ?? '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? '';
const JIRA_BASE_URL = (process.env.JIRA_BASE_URL ?? '').replace(/\/$/, '');

function authHeader(): string {
  const encoded = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return `Basic ${encoded}`;
}

async function fetchJira(
  pathname: string,
  options: RequestInit & { body?: object; formData?: FormData } = {},
): Promise<Response> {
  const url = `${JIRA_BASE_URL}${pathname}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: authHeader(),
    ...(options.headers as Record<string, string>),
  };

  let body: string | FormData | undefined;
  if (options.formData) {
    body = options.formData;
    delete (headers as Record<string, unknown>)['Content-Type'];
  } else if (options.body) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers,
    body,
  });
}

export async function searchIssues(jql: string): Promise<Array<{ key: string }>> {
  const q = encodeURIComponent(jql);
  const res = await fetchJira(`/rest/api/3/search?jql=${q}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira search failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as JiraSearchResult;
  return data.issues.map((i) => ({ key: i.key }));
}

/**
 * Escape a string for use inside JQL text ~ "..." (escape backslash and double quote).
 */
export function escapeJqlText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Atlassian Document Format: single paragraph with plain text.
 */
function adfParagraph(text: string): object {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

export async function addComment(issueKey: string, body: string): Promise<void> {
  const res = await fetchJira(`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    body: { body: adfParagraph(body) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira addComment failed: ${res.status} ${text}`);
  }
}

export async function createIssue(payload: JiraCreateIssuePayload): Promise<{ key: string }> {
  const body = {
    fields: {
      project: { key: payload.project },
      issuetype: { name: payload.issueType },
      summary: payload.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: payload.description }] }],
      },
      labels: payload.labels,
    },
  };
  const res = await fetchJira('/rest/api/3/issue', { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira createIssue failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as JiraCreateIssueResponse;
  return { key: data.key };
}

export async function addAttachment(
  issueKey: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, filename);

  const url = `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/attachments`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: authHeader(),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira addAttachment failed: ${res.status} ${text}`);
  }
}
