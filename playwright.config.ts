import { defineConfig, devices } from '@playwright/test';

const baseURL = 'https://jsonplaceholder.typicode.com';

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  timeout: 30_000,
  use: {
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  projects: [
    {
      name: 'api',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [
    ['list'],
    ['./src/reporter/failureArtifactReporter.ts'],
  ],
});
