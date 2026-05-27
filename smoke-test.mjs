import { chromium } from '@playwright/test';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:47831';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('아이디').fill(process.env.SMOKE_ADMIN_ID || 'admin');
await page.getByPlaceholder('비밀번호').fill(process.env.SMOKE_ADMIN_PASSWORD || 'admin123');
await page.getByRole('button', { name: '로그인' }).click();
await page.waitForURL('**/admin', { timeout: 5000 });
await page.waitForSelector('text=교사 계정 발급', { timeout: 5000 });
await page.screenshot({ path: 'dist/smoke-home.png', fullPage: true });

const title = await page.locator('h1').first().textContent({ timeout: 1000 }).catch(() => null);
const hasCreateTeacherButton = await page.getByRole('button', { name: '교사 계정 발급' }).count();
const bodyText = await page.locator('body').innerText();

console.log(JSON.stringify({ baseUrl, title, hasCreateTeacherButton, bodyText, errors }, null, 2));
await browser.close();

if (errors.length || title !== '교사 계정 발급' || hasCreateTeacherButton < 1) {
  process.exit(1);
}
