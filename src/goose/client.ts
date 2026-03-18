import OpenAI from 'openai';
import type { FailurePayload } from '../utils/failurePayload.js';

export interface BugContent {
  summary: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  severity: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

const SYSTEM_PROMPT = `You are a QA engineer. Given a JSON object describing an API test failure, produce a structured bug report.
Return ONLY a valid JSON object with these exact keys (no markdown, no extra text):
- summary: short one-line title for the bug
- description: 1-2 sentences describing what failed
- steps: brief steps to reproduce (e.g. "1. Call GET /posts 2. ...")
- expected: what was expected
- actual: what actually happened
- severity: one of Critical, High, Medium, Low`;

export async function generateBugContent(failure: FailurePayload): Promise<BugContent> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const userContent = JSON.stringify(
    {
      endpoint: failure.endpoint,
      method: failure.method,
      status: failure.status,
      responseBody: failure.responseBody,
      requestBody: failure.requestBody,
      errorMessage: failure.errorMessage,
    },
    null,
    2,
  );

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('Empty LLM response');

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    summary: String(parsed.summary ?? 'API test failure'),
    description: String(parsed.description ?? ''),
    steps: String(parsed.steps ?? ''),
    expected: String(parsed.expected ?? ''),
    actual: String(parsed.actual ?? ''),
    severity: String(parsed.severity ?? 'Medium'),
  };
}
