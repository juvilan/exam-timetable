/**
 * ipTIME 공유기 포트포워딩 자동 설정
 * - 캡차 읽기 → 로그인 → 포트포워딩 추가
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const ROUTER_IP   = '192.168.0.1';
const LOCAL_IP    = '192.168.0.10';
const PORT        = 5173;
const ADMIN_ID    = 'admin';
const ADMIN_PW    = 'admin';

async function api(page, method, param) {
  return page.evaluate(async ({ method, param }) => {
    const body = param ? { method, param } : { method };
    const r = await fetch('/cgi/service.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }, { method, param });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`http://${ROUTER_IP}/ui/`, { timeout: 20000, waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// ── 1. 캡차 이미지 가져오기 ──────────────────────────────────
const captchaRes = await api(page, 'captcha/new');
const captchaUrl = captchaRes.result;
console.log('캡차 URL:', captchaUrl);

// 캡차 이미지 PNG로 저장
const imgPage = await ctx.newPage();
await imgPage.goto(`http://${ROUTER_IP}${captchaUrl}`, { timeout: 5000, waitUntil: 'domcontentloaded' });
await imgPage.screenshot({ path: '/tmp/captcha_final.png', clip: { x: 535, y: 325, width: 200, height: 70 } });
await imgPage.close();

console.log('\n캡차 이미지: /tmp/captcha_final.png');
console.log('캡차 텍스트를 입력하세요:');

// stdin에서 캡차 읽기
const rl = createInterface({ input: process.stdin, output: process.stdout });
const captchaText = await new Promise(resolve => rl.question('> ', ans => { rl.close(); resolve(ans.trim()); }));

// ── 2. 로그인 ────────────────────────────────────────────────
const loginRes = await api(page, 'session/login', {
  id: ADMIN_ID,
  pw: ADMIN_PW,
  captcha: captchaText,
});
console.log('로그인 결과:', JSON.stringify(loginRes));

if (loginRes.error) {
  console.error('로그인 실패:', loginRes.error.message);
  await browser.close();
  process.exit(1);
}

// ── 3. 기존 포트포워딩 목록 확인 ─────────────────────────────
const pfList = await api(page, 'portforward/list');
console.log('\n기존 포트포워딩:', JSON.stringify(pfList.result?.slice(0, 3) ?? pfList));

// ── 4. 포트포워딩 추가 ────────────────────────────────────────
const addRes = await api(page, 'portforward/add', {
  name:      'exam-timetable',
  protocol:  'tcp',
  exPort:    PORT,
  inIp:      LOCAL_IP,
  inPort:    PORT,
});
console.log('\n포트포워딩 추가 결과:', JSON.stringify(addRes));

// ── 5. 결과 확인 스크린샷 ────────────────────────────────────
await page.goto(`http://${ROUTER_IP}/ui/`, { timeout: 10000, waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/router_done.png' });

await browser.close();
console.log('\n완료! http://juvilan-server.iptime.org:5173 으로 접속 가능');
