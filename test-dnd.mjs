/**
 * 드래그앤드롭 테스트: 미배치 과목 → 그리드 셀
 */
import { chromium } from '@playwright/test';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('./node_modules/xlsx');

// 이전 주입 스크립트에서 만든 세션 재사용 (run-ga.mjs 결과)
const storeJson = JSON.stringify({
  state: {
    sessions: [{
      id: 'exam_dnd_1',
      title: '2025학년도 1학기 중간고사',
      schoolYear: 2025,
      semester: 1,
      examType: 'mid',
      grades: [
        {
          grade: 2,
          arrivalTime: null,
          slotConfigs: [
            [{ period: 1, startTime: '09:10', endTime: '10:00', durationMin: 50 },
             { period: 2, startTime: '10:30', endTime: '11:20', durationMin: 50 }],
            [{ period: 1, startTime: '09:10', endTime: '10:00', durationMin: 50 },
             { period: 2, startTime: '10:30', endTime: '11:20', durationMin: 50 }],
          ],
        },
      ],
      days: [
        { id: 'day1', date: '2025-04-28' },
        { id: 'day2', date: '2025-04-29' },
      ],
      subjects: [
        { id: 'sub1', name: '문학',   grade: 2, examScope: 'both', groupId: null },
        { id: 'sub2', name: '대수',   grade: 2, examScope: 'both', groupId: null },
        { id: 'sub3', name: '영어Ⅰ', grade: 2, examScope: 'both', groupId: null },
        { id: 'sub4', name: '화학',   grade: 2, examScope: 'both', groupId: null },
      ],
      groups: [],
      grid: [],  // 전부 미배치
      gradeMatrices: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }],
    activeSessionId: 'exam_dnd_1',
    view: 'editor',
  },
  version: 1,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto('http://localhost:5173/');
await page.waitForTimeout(600);
await page.evaluate((data) => localStorage.setItem('exam-timetable-store', data), storeJson);
await page.reload();
await page.waitForTimeout(1500);

// 초기 상태 캡처
await page.screenshot({ path: '/tmp/dnd_before.png' });
console.log('초기 상태 캡처 완료');

// 미배치 과목 패널에서 "문학" 카드 찾기
const subjectCard = page.locator('[data-subject-id="sub1"]').first();
const gridCell = page.locator('[data-grade-index="0"][data-day-index="0"][data-slot-index="0"]').first();

if (await subjectCard.isVisible({ timeout: 3000 })) {
  const srcBox = await subjectCard.boundingBox();
  const dstBox = await gridCell.boundingBox();

  if (srcBox && dstBox) {
    console.log('드래그 시작:', srcBox);
    console.log('드롭 대상:', dstBox);

    // HTML5 drag & drop 시뮬레이션
    await page.mouse.move(srcBox.x + srcBox.width/2, srcBox.y + srcBox.height/2);
    await page.mouse.down();
    await page.waitForTimeout(300);

    // 천천히 이동
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const x = srcBox.x + srcBox.width/2 + (dstBox.x + dstBox.width/2 - srcBox.x - srcBox.width/2) * i / steps;
      const y = srcBox.y + srcBox.height/2 + (dstBox.y + dstBox.height/2 - srcBox.y - srcBox.height/2) * i / steps;
      await page.mouse.move(x, y);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.waitForTimeout(800);

    await page.screenshot({ path: '/tmp/dnd_after.png' });
    console.log('드래그앤드롭 후 캡처 완료');
  } else {
    console.log('바운딩박스 없음 - 셀 또는 카드 미표시');
    // data 속성 없이 locator 시도
    const allCells = await page.locator('[data-slot-index]').all();
    console.log('data-slot-index 요소 수:', allCells.length);
    await page.screenshot({ path: '/tmp/dnd_debug.png' });
  }
} else {
  console.log('[data-subject-id] 속성 없음 - DOM 확인');
  // 미배치 패널 내용 확인
  const panel = page.locator('[class*="unassigned"], [class*="subjectPanel"], [class*="SubjectPanel"]').first();
  if (await panel.isVisible({ timeout: 2000 })) {
    console.log('패널 텍스트:', await panel.textContent());
  }
  await page.screenshot({ path: '/tmp/dnd_debug.png' });
}

await browser.close();
console.log('완료');
