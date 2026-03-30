import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5173/');

// 고사 만들기 클릭
await page.getByText('첫 번째 고사 만들기').click();
await page.waitForTimeout(500);

// 2026년 1학기 중간고사로 생성
await page.getByText('고사 만들기').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/shot_after_create.png' });
console.log('고사 생성 후:', await page.textContent('body').then(t => t.replace(/\s+/g, ' ').slice(0, 400)));

// 시간표 추가 버튼 찾기
const addBtn = page.getByText('시간 추가').or(page.getByText('+ 추가')).or(page.getByText('추가'));
if (await addBtn.first().isVisible()) {
  await addBtn.first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/shot_add_slot.png' });
  console.log('시간 추가 후:', await page.textContent('body').then(t => t.replace(/\s+/g, ' ').slice(0, 400)));
}

await browser.close();
