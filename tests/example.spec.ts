import { expect, test } from '@playwright/test';

test('basic page interaction works', async ({ page }) => {
  await page.setContent('<main><h1>Playwright is ready</h1></main>');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Playwright is ready');
});
