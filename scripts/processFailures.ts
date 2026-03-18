import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFailurePayload } from '../src/utils/failurePayload.js';
import { fingerprint } from '../src/utils/fingerprint.js';
import * as jira from '../src/jira/client.js';
import { generateBugContent } from '../src/goose/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts');

const JIRA_PROJECT = process.env.JIRA_PROJECT ?? 'QA';
const JIRA_ISSUE_TYPE = process.env.JIRA_ISSUE_TYPE ?? 'Bug';

async function main(): Promise<void> {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    console.log('No artifacts directory; nothing to process.');
    return;
  }

  const files = fs.readdirSync(ARTIFACTS_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No failure JSON files in artifacts/.');
    return;
  }

  for (const file of files) {
    const filepath = path.join(ARTIFACTS_DIR, file);
    let raw: string;
    try {
      raw = fs.readFileSync(filepath, 'utf8');
    } catch (e) {
      console.warn(`Skip ${file}: ${e}`);
      continue;
    }

    let data: ReturnType<typeof parseFailurePayload>;
    try {
      data = parseFailurePayload(JSON.parse(raw));
    } catch {
      console.warn(`Skip ${file}: invalid JSON`);
      continue;
    }

    if (!data) {
      console.warn(`Skip ${file}: invalid payload shape`);
      continue;
    }

    const fp = fingerprint(data);
    const escapedMessage = jira.escapeJqlText(data.errorMessage);
    const jql = `project = ${JIRA_PROJECT} AND text ~ "${escapedMessage}" AND status != Done`;

    let existing: Array<{ key: string }>;
    try {
      existing = await jira.searchIssues(jql);
    } catch (e) {
      console.error(`Jira search failed for ${file}:`, e);
      continue;
    }

    if (existing.length > 0) {
      const issueKey = existing[0].key;
      const comment = `New occurrence: ${data.timestamp}\n\nResponse body:\n\`\`\`json\n${JSON.stringify(data.responseBody, null, 2)}\n\`\`\``;
      try {
        await jira.addComment(issueKey, comment);
        console.log(`Commented on existing issue ${issueKey} (${file})`);
      } catch (e) {
        console.error(`Failed to add comment to ${issueKey}:`, e);
      }
      continue;
    }

    let bugContent: Awaited<ReturnType<typeof generateBugContent>>;
    try {
      bugContent = await generateBugContent(data);
    } catch (e) {
      console.error(`Goose/LLM failed for ${file}:`, e);
      continue;
    }

    const description = [
      bugContent.description,
      '',
      '**Steps:**',
      bugContent.steps,
      '',
      '**Expected:**',
      bugContent.expected,
      '',
      '**Actual:**',
      bugContent.actual,
      '',
      '**Severity:**',
      bugContent.severity,
    ].join('\n');

    try {
      const { key } = await jira.createIssue({
        project: JIRA_PROJECT,
        issueType: JIRA_ISSUE_TYPE,
        summary: bugContent.summary,
        description,
        labels: [fp],
      });

      const attachmentPayload = { requestBody: data.requestBody, responseBody: data.responseBody };
      const attachmentBuffer = Buffer.from(JSON.stringify(attachmentPayload, null, 2), 'utf8');
      await jira.addAttachment(key, 'request-response.json', attachmentBuffer, 'application/json');
      console.log(`Created new issue ${key} (${file})`);
    } catch (e) {
      console.error(`Failed to create issue for ${file}:`, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
