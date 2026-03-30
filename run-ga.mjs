/**
 * GA 최적화 실행 스크립트
 * 2학년/3학년 Excel → GA → 최적 시간표 출력
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('./node_modules/xlsx');

// ── Excel 파싱 ────────────────────────────────────────────────────────────
function parseMatrix(filePath) {
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  const header = rows[0];
  const grade = Number(String(rows[1][0]).trim());
  const subjectNames = header.slice(4); // 학년, 반, 번호, 이름 제외
  const dataRows = rows.slice(1).filter(r => r.length > 4);

  const students = dataRows.map(r => ({
    homeroom: Number(r[1]),
    number: Number(r[2]),
    name: String(r[3] ?? '').trim(),
  }));

  const matrix = dataRows.map(r =>
    subjectNames.map((_, i) => (r[4 + i] === 1 ? 1 : 0))
  );

  return { grade, subjectNames, matrix, students, studentCount: dataRows.length };
}

// ── GA 엔진 (gaEngine.ts에서 포팅) ────────────────────────────────────────
const WAIT_WEIGHT       = 10;
const WAIT_ROOM_PENALTY = 100;
const SMALL_ROOM_LIMIT  = 12;
const DEFAULT_ROOM_CAP  = 28;
const DEFAULT_WAIT_CAP  = 60;

function minProctors(n, roomCap) {
  if (n === 0) return 0;
  const full = Math.floor(n / roomCap);
  const rem  = n % roomCap;
  return full * 2 + (rem === 0 ? 0 : (rem <= SMALL_ROOM_LIMIT ? 1 : 2));
}

function precompute(matrix, daySizes, roomCap = DEFAULT_ROOM_CAP, waitCap = DEFAULT_WAIT_CAP) {
  const nSubj = matrix[0]?.length ?? 0;
  const n = matrix.length;
  const subjectCounts = new Array(nSubj).fill(0);
  for (let s = 0; s < n; s++)
    for (let j = 0; j < nSubj; j++)
      if (matrix[s][j] === 1) subjectCounts[j]++;

  let totalProctors = 0;
  for (let j = 0; j < nSubj; j++)
    totalProctors += minProctors(subjectCounts[j], roomCap);

  const studentSubjects = matrix.map(row => {
    const r = [];
    for (let j = 0; j < nSubj; j++) if (row[j] === 1) r.push(j);
    return r;
  });

  const nDays = daySizes.length;
  const bufSize = (nDays + 1) * 100 + 10 * 10 + 10;
  return { subjectCounts, totalProctors, studentSubjects, waitCap, _buf: new Array(bufSize).fill(0) };
}

function evaluate(order, matrix, daySizes, pre) {
  const n     = matrix.length;
  const nSubj = order.length;
  const nDays = daySizes.length;
  const slotDay    = new Array(nSubj);
  const slotPeriod = new Array(nSubj);
  let idx = 0;
  for (let day = 1; day <= nDays; day++)
    for (let p = 1; p <= daySizes[day-1]; p++) {
      if (idx >= nSubj) break;
      slotDay[order[idx]] = day;
      slotPeriod[order[idx]] = p;
      idx++;
    }

  const buf = pre._buf;
  buf.fill(0);
  let wait = 0;

  for (let s = 0; s < n; s++) {
    const sSubjs = pre.studentSubjects[s];
    if (sSubjs.length === 0) continue;
    const dpArr = Array.from({ length: nDays }, () => []);
    for (const sj of sSubjs) {
      const d = slotDay[sj]; const p = slotPeriod[sj];
      if (d >= 1 && d <= nDays) dpArr[d-1].push(p);
    }
    for (let di = 0; di < nDays; di++) {
      const ps = dpArr[di];
      if (ps.length === 0) continue;
      ps.sort((a, b) => a - b);
      const maxPd = ps[ps.length-1]; const minPd = ps[0];
      if (ps.length > 1) wait += maxPd - minPd - (ps.length - 1);
      const psSet = {};
      for (const p of ps) psSet[p] = 1;
      for (let p = 1; p < maxPd; p++)
        if (!psSet[p]) buf[(di+1)*100 + p*10]++;
    }
  }

  let overflow = 0;
  for (const v of buf) if (v > pre.waitCap) overflow += v - pre.waitCap;

  const score = wait * WAIT_WEIGHT + pre.totalProctors + overflow * WAIT_ROOM_PENALTY;
  return { wait, proctors: pre.totalProctors, overflow, score };
}

function oxCrossover(p1, p2) {
  const n = p1.length;
  let a = Math.floor(Math.random() * n);
  let b; do { b = Math.floor(Math.random() * n); } while (b === a);
  if (a > b) { const t = a; a = b; b = t; }
  const child = new Array(n).fill(-1);
  const inChild = {};
  for (let i = a; i < b; i++) { child[i] = p1[i]; inChild[p1[i]] = true; }
  const fill = p2.filter(x => !inChild[x]);
  let fi = 0;
  for (let i = 0; i < n; i++) if (child[i] === -1) child[i] = fill[fi++];
  return child;
}

function runGa(matrix, subjectNames, daySizes, { population=100, generations=500 } = {}) {
  const n = subjectNames.length;
  const pre = precompute(matrix, daySizes);
  const indices = Array.from({ length: n }, (_, i) => i);
  const shuffle = () => {
    const a = indices.slice();
    for (let i = a.length-1; i > 0; i--) {
      const r = Math.floor(Math.random() * (i+1));
      [a[i], a[r]] = [a[r], a[i]];
    }
    return a;
  };

  let pop = Array.from({ length: population }, shuffle);
  const eliteN = Math.max(1, Math.floor(population * 0.08));
  const mutRate = 0.20;

  let bestScore = Infinity, bestOrder = [], bestScores = null;
  const convergence = [];

  for (let gen = 0; gen < generations; gen++) {
    const scored = pop.map(order => ({ order, scores: evaluate(order, matrix, daySizes, pre) }));
    scored.sort((a, b) => a.scores.score - b.scores.score);

    if (scored[0].scores.score < bestScore) {
      bestScore = scored[0].scores.score;
      bestOrder = scored[0].order.slice();
      bestScores = scored[0].scores;
    }

    if (gen % 100 === 0 || gen === generations - 1) {
      convergence.push({ gen, score: scored[0].scores.score });
      process.stdout.write(`  gen ${String(gen).padStart(4)} / ${generations}  score=${scored[0].scores.score}\r`);
    }

    const elites = scored.slice(0, eliteN).map(x => x.order);
    const top    = scored.slice(0, Math.floor(population/2)).map(x => x.order);
    const newPop = elites.slice();
    while (newPop.length < population) {
      const child = oxCrossover(
        elites[Math.floor(Math.random() * eliteN)],
        top[Math.floor(Math.random() * top.length)]
      );
      if (Math.random() < mutRate) {
        const mi = Math.floor(Math.random() * n);
        const mj = Math.floor(Math.random() * n);
        [child[mi], child[mj]] = [child[mj], child[mi]];
      }
      newPop.push(child);
    }
    pop = newPop;
  }
  console.log('');
  return { order: bestOrder, scores: bestScores, convergence };
}

// ── 메인 ─────────────────────────────────────────────────────────────────
const FILE2 = '/Users/juvilan/.claude/channels/telegram/inbox/1774749702757-AgADvBsAAtdgQVY.xlsx';
const FILE3 = '/Users/juvilan/.claude/channels/telegram/inbox/1774749712890-AgADvRsAAtdgQVY.xlsx';

const DAYS = ['4/27(일)', '4/28(월)', '4/29(화)', '4/30(수)'];
const N_DAYS = 4;
const GENERATIONS = 800;
const POPULATION  = 120;

function calcDaySizes(subjCount, dayCount) {
  const base  = Math.floor(subjCount / dayCount);
  const extra = subjCount % dayCount;
  return Array.from({ length: dayCount }, (_, i) => base + (i < extra ? 1 : 0));
}

async function optimize(fileP, label) {
  const data = parseMatrix(fileP);
  const daySizes = calcDaySizes(data.subjectNames.length, N_DAYS);
  console.log(`\n▶ ${label} (${data.studentCount}명, ${data.subjectNames.length}과목, ${daySizes.join('+')}교시/일)`);
  console.log(`  과목: ${data.subjectNames.join(', ')}`);
  console.log(`  GA 실행 중... (세대: ${GENERATIONS}, 인구: ${POPULATION})`);

  const result = runGa(data.matrix, data.subjectNames, daySizes, {
    population: POPULATION, generations: GENERATIONS
  });

  console.log(`\n  ✓ 완료! 점수: ${result.scores.score} (대기=${result.scores.wait}, 감독=${result.scores.proctors}, 초과=${result.scores.overflow})`);
  console.log('\n  📅 최적 배치:');

  let slotIdx = 0;
  for (let d = 0; d < N_DAYS; d++) {
    const subjects = [];
    for (let p = 0; p < daySizes[d]; p++) {
      const subjIdx = result.order[slotIdx++];
      subjects.push(`${p+1}교시: ${data.subjectNames[subjIdx]}`);
    }
    console.log(`    ${DAYS[d]}  ${subjects.join('  |  ')}`);
  }

  // periodCodeMap 출력
  console.log('\n  🗂 periodCodeMap (시간표 적용용):');
  slotIdx = 0;
  const periodCodeMap = {};
  for (let d = 0; d < N_DAYS; d++) {
    for (let p = 0; p < daySizes[d]; p++) {
      const subjIdx = result.order[slotIdx++];
      const code = String((d+1)*10 + (p+1));
      periodCodeMap[data.subjectNames[subjIdx]] = code;
    }
  }
  console.log('  ', JSON.stringify(periodCodeMap, null, 2).replace(/\n/g, '\n   '));

  return { data, result, periodCodeMap };
}

const r2 = await optimize(FILE2, '2학년');
const r3 = await optimize(FILE3, '3학년');

console.log('\n✅ 완료');
