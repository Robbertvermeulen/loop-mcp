import { test, expect, request } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '3000';
const BASE = `http://localhost:${PORT}`;

async function bootstrap() {
  const api = await request.newContext({ baseURL: BASE });
  const signup = await api.post('/api/app/signup', {
    data: { email: `e2e-${Date.now()}@example.com`, password: 'hunter2hunter2', displayName: 'E2E Tester' },
  });
  const cookie = signup.headers()['set-cookie'] ?? '';
  const tokenRes = await api.post('/api/app/tokens', {
    data: { label: 'e2e' },
    headers: { cookie },
  });
  const tokenJson = (await tokenRes.json()) as { plain: string };
  const apiToken = tokenJson.plain;

  const createRes = await api.post('/mcp', {
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${apiToken}`,
    },
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'create_request',
        arguments: {
          title: 'E2E test',
          intro: 'Just a quick test',
          questions: [
            { id: 'name', type: 'text_short', prompt: 'Your name?' },
            { id: 'color', type: 'single_choice', prompt: 'Favorite color?', options: ['Red', 'Blue'] },
          ],
        },
      },
    },
  });
  const text = await createRes.text();
  let body: { result?: { content?: Array<{ text: string }> }; content?: Array<{ text: string }> };
  try {
    body = JSON.parse(text);
  } catch {
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) throw new Error(`bad response: ${text.slice(0, 200)}`);
    body = JSON.parse(dataLine.slice(5).trim());
  }
  const result = body.result ?? body;
  const toolText = result.content?.[0]?.text ?? '';
  const parsed = JSON.parse(toolText) as { url: string };
  const urlObj = new URL(parsed.url);
  return urlObj.pathname;
}

test('recipient can complete the form end-to-end', async ({ page }) => {
  const path = await bootstrap();
  await page.goto(path);

  await expect(page.getByRole('heading', { name: 'E2E test' })).toBeVisible();
  await page.getByRole('button', { name: /start/i }).click();

  await expect(page.getByText('Your name?')).toBeVisible();
  await page.getByRole('textbox').fill('Alice');
  await page.getByRole('button', { name: /next|review/i }).click();

  await expect(page.getByText('Favorite color?')).toBeVisible();
  await page.getByLabel('Blue').check();
  await page.getByRole('button', { name: /next|review/i }).click();

  await expect(page.getByText(/ready to send/i)).toBeVisible();
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page.getByText(/thank you/i)).toBeVisible();
});
