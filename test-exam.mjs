import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');
await page.screenshot({ path: '/tmp/shot1.png' });
console.log('페이지 제목:', await page.title());
console.log('페이지 내용:', await page.textContent('body').then(t => t.slice(0, 200)));

// "첫 번째 고사 만들기" 버튼 클릭
const btn = page.getByText('첫 번째 고사 만들기');
if (await btn.isVisible()) {
  await btn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/shot2.png' });
  console.log('클릭 후 내용:', await page.textContent('body').then(t => t.slice(0, 300)));
}

// "+ 새 고사 만들기" 버튼 테스트
const newBtn = page.getByText('새 고사 만들기');
if (await newBtn.isVisible()) {
  await newBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/shot3.png' });
  console.log('새 고사 모달:', await page.textContent('body').then(t => t.slice(0, 400)));
}

await browser.close();
