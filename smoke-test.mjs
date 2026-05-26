import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'dist/smoke-home.png', fullPage: true });

const title = await page.locator('h1').first().textContent({ timeout: 1000 }).catch(() => null);
const hasLoginButton = await page.getByRole('button', { name: '로그인' }).count();
const bodyText = await page.locator('body').innerText();

console.log(JSON.stringify({ title, hasLoginButton, bodyText, errors }, null, 2));
await browser.close();
