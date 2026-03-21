import { test, expect, type TestInfo } from '@playwright/test';
import {
  FAILURE_CONTEXT_ATTACHMENT_NAME,
  type FailureContext,
} from '../utils/failurePayload.js';

const BASE = 'https://jsonplaceholder.typicode.com';

function attachFailureContext(testInfo: TestInfo, ctx: FailureContext) {
  testInfo.attachments.push({
    name: FAILURE_CONTEXT_ATTACHMENT_NAME,
    body: Buffer.from(JSON.stringify(ctx), 'utf8'),
    contentType: 'application/json',
  });
}

test('GET /posts returns 200 and list of posts', async ({ request }, testInfo) => {
  const response = await request.get(`${BASE}/posts`);
  const body = await response.json().catch(() => null);
  attachFailureContext(testInfo, {
    endpoint: '/posts',
    method: 'GET',
    status: response.status(),
    responseBody: body,
    requestBody: null,
  });
  expect(response.status()).toBe(500); // falha intencional: esperado 500
});

test('GET /posts/1 returns 200 and single post', async ({ request }, testInfo) => {
  const response = await request.get(`${BASE}/posts/1`);
  const body = await response.json().catch(() => null);
  attachFailureContext(testInfo, {
    endpoint: '/posts/1',
    method: 'GET',
    status: response.status(),
    responseBody: body,
    requestBody: null,
  });
  expect(body).toHaveProperty('nonExistentField', 'wrong'); // falha intencional: campo inexistente
});

test('POST /posts creates a post', async ({ request }, testInfo) => {
  const reqBody = { title: 'foo', body: 'bar', userId: 1 };
  const response = await request.post(`${BASE}/posts`, { data: reqBody });
  const resBody = await response.json().catch(() => null);
  attachFailureContext(testInfo, {
    endpoint: '/posts',
    method: 'POST',
    status: response.status(),
    responseBody: resBody,
    requestBody: reqBody,
  });
  expect(response.status()).toBe(201);
  expect(resBody).toHaveProperty('id');
});

test('PUT /posts/1 updates a post', async ({ request }, testInfo) => {
  const reqBody = { id: 1, title: 'updated', body: 'updated body', userId: 1 };
  const response = await request.put(`${BASE}/posts/1`, { data: reqBody });
  const resBody = await response.json().catch(() => null);
  attachFailureContext(testInfo, {
    endpoint: '/posts/1',
    method: 'PUT',
    status: response.status(),
    responseBody: resBody,
    requestBody: reqBody,
  });
  expect(response.status()).toBe(200);
  expect(resBody).toHaveProperty('id', 1);
});

test('DELETE /posts/1 returns 200', async ({ request }, testInfo) => {
  const response = await request.delete(`${BASE}/posts/1`);
  attachFailureContext(testInfo, {
    endpoint: '/posts/1',
    method: 'DELETE',
    status: response.status(),
    responseBody: null,
    requestBody: null,
  });
  expect(response.status()).toBe(200);
});
