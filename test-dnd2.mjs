/**
 * dnd-kit 드래그앤드롭 테스트
 * PointerSensor (activationConstraint: distance 4) 사용
 */
import { chromium } from '@playwright/test';

const store = JSON.stringify({
  state: {
    sessions: [{
      id:'e1', title:'2025학년도 1학기 중간고사', schoolYear:2025, semester:1, examType:'mid',
      grades:[{
        grade:2, arrivalTime:null,
        slotConfigs:[
          [{period:1,startTime:'09:10',endTime:'10:00',durationMin:50},{period:2,startTime:'10:30',endTime:'11:20',durationMin:50}],
          [{period:1,startTime:'09:10',endTime:'10:00',durationMin:50},{period:2,startTime:'10:30',endTime:'11:20',durationMin:50}],
        ]
      }],
      days:[{id:'d1',date:'2025-04-28'},{id:'d2',date:'2025-04-29'}],
      subjects:[
        {id:'s1',name:'문학',grade:2,examScope:'both',groupId:null},
        {id:'s2',name:'대수',grade:2,examScope:'both',groupId:null},
        {id:'s3',name:'영어Ⅰ',grade:2,examScope:'both',groupId:null},
        {id:'s4',name:'화학',grade:2,examScope:'both',groupId:null},
      ],
      groups:[], grid:[], gradeMatrices:{},
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
    }],
    activeSessionId:'e1', view:'editor'
  }, version:1
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto('http://localhost:5173/');
await page.waitForTimeout(600);
await page.evaluate(d => localStorage.setItem('exam-timetable-store', d), store);
await page.reload();
await page.waitForTimeout(1500);

await page.screenshot({ path: '/tmp/dnd2_before.png' });
console.log('Before 캡처');

// 팔레트 카드 + 드롭 셀 위치 확인
const card = page.locator('[class*="paletteCard"]').first();
const cell = page.locator('[class*="dropCell"]').first();

const cardBox = await card.boundingBox();
const cellBox = await cell.boundingBox();
console.log('카드:', cardBox);
console.log('셀:', cellBox);

// PointerSensor는 pointerdown → pointermove(>4px) → pointerup
const cardCx = cardBox.x + cardBox.width / 2;
const cardCy = cardBox.y + cardBox.height / 2;
const cellCx = cellBox.x + cellBox.width / 2;
const cellCy = cellBox.y + cellBox.height / 2;

// 드래그 시뮬레이션
await page.mouse.move(cardCx, cardCy);
await page.mouse.down();
await page.waitForTimeout(100);

// 활성화 거리(4px) 이상 이동
for (let i = 0; i <= 30; i++) {
  const t = i / 30;
  await page.mouse.move(
    cardCx + (cellCx - cardCx) * t,
    cardCy + (cellCy - cardCy) * t,
  );
  await page.waitForTimeout(16); // ~60fps
}

await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/dnd2_dragging.png' });
console.log('Dragging 캡처');

await page.mouse.up();
await page.waitForTimeout(800);

await page.screenshot({ path: '/tmp/dnd2_after.png' });
console.log('After 캡처');

// 배치됐는지 확인
const cellText = await cell.textContent().catch(() => '');
console.log('셀 텍스트:', cellText);

const remainCards = await page.locator('[class*="paletteCard"]').count();
console.log('남은 팔레트 카드 수:', remainCards);

await browser.close();
console.log('완료!');
