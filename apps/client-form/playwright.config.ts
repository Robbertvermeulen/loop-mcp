import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: [
    {
      command: `cd ../.. && PORT=${PORT} bun run dev`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
