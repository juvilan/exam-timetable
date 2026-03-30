/**
 * GA 최적화 결과를 앱 localStorage에 주입하는 스크립트
 * 2025년 1학기 중간고사 (4/27~4/30) 2/3학년 시간표 배치
 */
import { chromium } from '@playwright/test';

// ── ID 생성 ──────────────────────────────────────────────────
let _cnt = 1;
const gid = (prefix) => `${prefix}_${Date.now()}_${_cnt++}`;

// ── 2학년 과목 ────────────────────────────────────────────────
const SUBJ2 = [
  '대수','문학','영어Ⅰ','기하','세계시민과 지리','세계사',
  '경제','윤리와 사상','물리학','화학','지구과학','생명과학',
];

// ── 3학년 과목 ────────────────────────────────────────────────
const SUBJ3 = [
  '독서','확률과 통계','영어 독해와 작문','화법과 작문',
  '언어와 매체','미적분','한국지리','경제','사회·문화',
  '윤리와 사상','물리학Ⅱ','생명과학Ⅱ',
];

// ── GA 결과 periodCodeMap ─────────────────────────────────────
// code = "${일차}${교시}" (1-based) → dayIndex = 일차-1, slotIndex = 교시-1
const PERIOD_MAP_2 = {
  "문학":"11","대수":"12","세계사":"13",
  "영어Ⅰ":"21","물리학":"22","화학":"23",
  "세계시민과 지리":"31","윤리와 사상":"32","경제":"33",
  "생명과학":"41","기하":"42","지구과학":"43",
};

const PERIOD_MAP_3 = {
  "언어와 매체":"11","미적분":"12","물리학Ⅱ":"13",
  "한국지리":"21","윤리와 사상":"22","경제":"23",
  "독서":"31","확률과 통계":"32","영어 독해와 작문":"33",
  "사회·문화":"41","화법과 작문":"42","생명과학Ⅱ":"43",
};

// ── 슬롯 설정 (3교시/일 - 실제 중간고사 시간) ─────────────────
function makeSlots3() {
  return [
    { period: 1, startTime: '09:10', endTime: '10:00', durationMin: 50 },
    { period: 2, startTime: '10:30', endTime: '11:20', durationMin: 50 },
    { period: 3, startTime: '13:00', endTime: '13:50', durationMin: 50 },
  ];
}

// 1학년: 시차등교 (10:30 이후 - 2,3교시만)
function makeSlots1() {
  return [
    { period: 2, startTime: '10:30', endTime: '11:20', durationMin: 50 },
    { period: 3, startTime: '13:00', endTime: '13:50', durationMin: 50 },
  ];
}

// ── 날짜 ────────────────────────────────────────────────────
const DAYS = ['4/27(일)', '4/28(월)', '4/29(화)', '4/30(수)'];

// ── 세션 구성 ────────────────────────────────────────────────
const sessionId = gid('exam');
const now = new Date().toISOString();

const days = DAYS.map(date => ({ id: gid('day'), date }));

const grades = [
  {
    grade: 1,
    arrivalTime: '10:30',
    slotConfigs: days.map(() => makeSlots1()),
  },
  {
    grade: 2,
    arrivalTime: null,
    slotConfigs: days.map(() => makeSlots3()),
  },
  {
    grade: 3,
    arrivalTime: null,
    slotConfigs: days.map(() => makeSlots3()),
  },
];

// 과목 생성 (2학년)
const subjects2 = SUBJ2.map(name => ({
  id: gid('sub'),
  name,
  grade: 2,
  examScope: 'both',
  groupId: null,
}));

// 과목 생성 (3학년)
const subjects3 = SUBJ3.map(name => ({
  id: gid('sub'),
  name,
  grade: 3,
  examScope: 'both',
  groupId: null,
}));

const subjects = [...subjects2, ...subjects3];

// 그리드 셀 생성 함수
function buildGrid() {
  const grid = [];

  // 2학년 (gradeIndex=1)
  for (const [subjName, code] of Object.entries(PERIOD_MAP_2)) {
    const subj = subjects2.find(s => s.name === subjName);
    if (!subj) continue;
    const dayIndex  = parseInt(code[0]) - 1;
    const slotIndex = parseInt(code.slice(1)) - 1;
    grid.push({
      gradeIndex: 1,
      dayIndex,
      slotIndex,
      content: { type: 'single', subjectId: subj.id },
    });
  }

  // 3학년 (gradeIndex=2)
  for (const [subjName, code] of Object.entries(PERIOD_MAP_3)) {
    const subj = subjects3.find(s => s.name === subjName);
    if (!subj) continue;
    const dayIndex  = parseInt(code[0]) - 1;
    const slotIndex = parseInt(code.slice(1)) - 1;
    grid.push({
      gradeIndex: 2,
      dayIndex,
      slotIndex,
      content: { type: 'single', subjectId: subj.id },
    });
  }

  return grid;
}

const session = {
  id: sessionId,
  title: '2025학년도 1학기 중간고사',
  schoolYear: 2025,
  semester: 1,
  examType: 'mid',
  grades,
  days,
  subjects,
  groups: [],
  grid: buildGrid(),
  gradeMatrices: {},
  createdAt: now,
  updatedAt: now,
};

const storeData = {
  state: {
    sessions: [session],
    activeSessionId: sessionId,
    view: 'editor',
  },
  version: 1,
};

// ── Playwright 실행 ───────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// 빈 페이지 로드 후 localStorage 주입
await page.goto('http://localhost:5173/');
await page.waitForTimeout(800);

await page.evaluate((data) => {
  localStorage.setItem('exam-timetable-store', JSON.stringify(data));
}, storeData);

// 새로고침 후 에디터 로드
await page.reload();
await page.waitForTimeout(1500);

await page.screenshot({ path: '/tmp/shot_ga_grid.png', fullPage: true });
console.log('그리드 스크린샷 완료: /tmp/shot_ga_grid.png');

// 인쇄 미리보기로 이동
const printBtn = page.getByRole('button', { name: /인쇄 미리보기/ });
if (await printBtn.isVisible({ timeout: 3000 })) {
  await printBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/shot_ga_print.png', fullPage: true });
  console.log('인쇄 미리보기 스크린샷 완료: /tmp/shot_ga_print.png');
} else {
  console.log('인쇄 미리보기 버튼을 찾지 못했습니다');
  const body = await page.textContent('body');
  console.log('페이지 내용:', body?.replace(/\s+/g, ' ').slice(0, 300));
}

await browser.close();
console.log('완료!');
