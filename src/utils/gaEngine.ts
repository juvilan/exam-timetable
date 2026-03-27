/**
 * gaEngine.ts
 * GA 최적화 엔진 – evaluate-core.js + ga-engine.js TypeScript 포팅
 */

// ── 상수 ────────────────────────────────────────────────────────────────
const WAIT_WEIGHT            = 10;
const WAIT_ROOM_PENALTY      = 100;
const SMALL_ROOM_LIMIT       = 12;
const DEFAULT_ROOM_CAP       = 28;
const DEFAULT_WAIT_ROOM_CAP  = 60;

// ── 타입 ────────────────────────────────────────────────────────────────

export interface GaConfig {
  population?:  number;  // default 100
  generations?: number;  // default 500
  roomCap?:     number;  // default 28
  waitRoomCap?: number;  // default 60
}

export interface GaScores {
  wait:      number;
  proctors:  number;
  overflow:  number;
  score:     number;
}

export interface GaResult {
  /** 과목 인덱스 순열 (슬롯 순서대로) */
  order:       number[];
  scores:      GaScores;
  convergence: { gen: number; score: number }[];
}

export interface GaProgressMessage {
  type:     'progress';
  gen:      number;
  total:    number;
  score:    number;
}

export interface GaCompleteMessage {
  type:    'complete';
  result:  GaResult;
}

export type GaWorkerMessage = GaProgressMessage | GaCompleteMessage;

// ── 감독관 수 ────────────────────────────────────────────────────────────

function minProctors(n: number, roomCap: number): number {
  if (n === 0) return 0;
  const full = Math.floor(n / roomCap);
  const rem  = n % roomCap;
  return full * 2 + (rem === 0 ? 0 : (rem <= SMALL_ROOM_LIMIT ? 1 : 2));
}

// ── 사전 계산 ────────────────────────────────────────────────────────────

interface Precomputed {
  subjectCounts:   number[];
  totalProctors:   number;
  studentSubjects: number[][];
  waitRoomCap:     number;
  _waitBuf:        number[];
}

function precomputeData(
  matrix:    number[][],  // [studentIdx][subjectIdx]
  daySizes:  number[],
  config:    Required<GaConfig>
): Precomputed {
  const nSubj = matrix[0]?.length ?? 0;
  const n     = matrix.length;

  const subjectCounts = new Array<number>(nSubj).fill(0);
  for (let s = 0; s < n; s++) {
    for (let j = 0; j < nSubj; j++) {
      if (matrix[s][j] === 1) subjectCounts[j]++;
    }
  }

  let totalProctors = 0;
  for (let j = 0; j < nSubj; j++) {
    totalProctors += minProctors(subjectCounts[j], config.roomCap);
  }

  const studentSubjects: number[][] = [];
  for (let s = 0; s < n; s++) {
    const sSubjs: number[] = [];
    for (let j = 0; j < nSubj; j++) {
      if (matrix[s][j] === 1) sSubjs.push(j);
    }
    studentSubjects.push(sSubjs);
  }

  const nDays   = daySizes.length;
  const bufSize = (nDays + 1) * 100 + 10 * 10 + 10;

  return {
    subjectCounts,
    totalProctors,
    studentSubjects,
    waitRoomCap: config.waitRoomCap,
    _waitBuf: new Array<number>(bufSize).fill(0),
  };
}

// ── 평가 함수 ────────────────────────────────────────────────────────────

function evaluate(
  order:       number[],
  matrix:      number[][],
  daySizes:    number[],
  precomputed: Precomputed
): GaScores {
  const n     = matrix.length;
  const nSubj = order.length;
  const nDays = daySizes.length;

  const slotDay    = new Array<number>(nSubj);
  const slotPeriod = new Array<number>(nSubj);
  let idx = 0;
  for (let day = 1; day <= nDays; day++) {
    for (let p = 1; p <= daySizes[day - 1]; p++) {
      if (idx >= nSubj) break;
      slotDay[order[idx]]    = day;
      slotPeriod[order[idx]] = p;
      idx++;
    }
  }

  const waitBuf = precomputed._waitBuf;
  for (let bi = 0; bi < waitBuf.length; bi++) waitBuf[bi] = 0;

  let wait = 0;
  const { studentSubjects } = precomputed;

  for (let s = 0; s < n; s++) {
    const sSubjs = studentSubjects[s];
    if (sSubjs.length === 0) continue;

    // 일차별 교시 수집
    const dpArr: number[][] = Array.from({ length: nDays }, () => []);
    for (let k = 0; k < sSubjs.length; k++) {
      const sj = sSubjs[k];
      const d  = slotDay[sj];
      const p2 = slotPeriod[sj];
      if (d >= 1 && d <= nDays) dpArr[d - 1].push(p2);
    }

    for (let di = 0; di < nDays; di++) {
      const ps = dpArr[di];
      if (ps.length === 0) continue;

      // 삽입 정렬
      for (let pi = 1; pi < ps.length; pi++) {
        const tmp = ps[pi];
        let pj = pi - 1;
        while (pj >= 0 && ps[pj] > tmp) { ps[pj + 1] = ps[pj]; pj--; }
        ps[pj + 1] = tmp;
      }

      const maxPd = ps[ps.length - 1];
      const minPd = ps[0];
      if (ps.length > 1) wait += maxPd - minPd - (ps.length - 1);

      // 대기실 카운트
      const psSet: Record<number, 1> = {};
      for (let psi = 0; psi < ps.length; psi++) psSet[ps[psi]] = 1;
      for (let p3 = 1; p3 < maxPd; p3++) {
        if (!psSet[p3]) waitBuf[(di + 1) * 100 + p3 * 10]++;
      }
    }
  }

  let overflow = 0;
  const cap = precomputed.waitRoomCap;
  for (let bi = 0; bi < waitBuf.length; bi++) {
    if (waitBuf[bi] > cap) overflow += waitBuf[bi] - cap;
  }

  const proctors = precomputed.totalProctors;
  const score = wait * WAIT_WEIGHT + proctors + overflow * WAIT_ROOM_PENALTY;
  return { wait, proctors, overflow, score };
}

// ── OX 교배 ─────────────────────────────────────────────────────────────

function oxCrossover(p1: number[], p2: number[]): number[] {
  const n = p1.length;
  let a = Math.floor(Math.random() * n);
  let b: number;
  do { b = Math.floor(Math.random() * n); } while (b === a);
  if (a > b) { const tmp = a; a = b; b = tmp; }

  const child   = new Array<number>(n).fill(-1);
  const inChild: Record<number, boolean> = {};
  for (let i = a; i < b; i++) {
    child[i]       = p1[i];
    inChild[p1[i]] = true;
  }

  const fill: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!inChild[p2[i]]) fill.push(p2[i]);
  }

  let fi = 0;
  for (let i = 0; i < n; i++) {
    if (child[i] === -1) child[i] = fill[fi++];
  }
  return child;
}

// ── GA 메인 루프 ─────────────────────────────────────────────────────────

export function runGa(
  matrix:    number[][],
  subjects:  string[],
  daySizes:  number[],
  config:    GaConfig = {},
  onProgress?: (gen: number, total: number, score: number) => void
): GaResult {
  const cfg: Required<GaConfig> = {
    population:  config.population  ?? 100,
    generations: config.generations ?? 500,
    roomCap:     config.roomCap     ?? DEFAULT_ROOM_CAP,
    waitRoomCap: config.waitRoomCap ?? DEFAULT_WAIT_ROOM_CAP,
  };

  const n      = subjects.length;
  const popSize = cfg.population;
  const gens    = cfg.generations;
  const mutRate = 0.20;
  const eliteN  = Math.max(1, Math.floor(popSize * 0.08));

  const precomputed = precomputeData(matrix, daySizes, cfg);
  const indices = Array.from({ length: n }, (_, i) => i);

  function randomOrder(): number[] {
    const arr = indices.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const ri  = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[ri]; arr[ri] = tmp;
    }
    return arr;
  }

  let pop = Array.from({ length: popSize }, () => randomOrder());

  let bestScore  = Infinity;
  let bestOrder: number[] = [];
  let bestScores: GaScores = { wait: 0, proctors: 0, overflow: 0, score: Infinity };
  const convergence: { gen: number; score: number }[] = [];

  for (let gen = 0; gen < gens; gen++) {
    const scored = pop.map(order => ({
      order,
      scores: evaluate(order, matrix, daySizes, precomputed),
    }));
    scored.sort((a, b) => a.scores.score - b.scores.score);

    if (scored[0].scores.score < bestScore) {
      bestScore  = scored[0].scores.score;
      bestOrder  = scored[0].order.slice();
      bestScores = scored[0].scores;
    }

    if (gen % 50 === 0 || gen === gens - 1) {
      convergence.push({ gen, score: scored[0].scores.score });
      onProgress?.(gen, gens, scored[0].scores.score);
    }

    const elites = scored.slice(0, eliteN).map(x => x.order);
    const top    = scored.slice(0, Math.floor(popSize / 2)).map(x => x.order);

    const newPop = elites.slice();
    while (newPop.length < popSize) {
      const eIdx  = Math.floor(Math.random() * elites.length);
      const tIdx  = Math.floor(Math.random() * top.length);
      const child = oxCrossover(elites[eIdx], top[tIdx]);
      if (Math.random() < mutRate) {
        const mi = Math.floor(Math.random() * n);
        const mj = Math.floor(Math.random() * n);
        const tmp = child[mi]; child[mi] = child[mj]; child[mj] = tmp;
      }
      newPop.push(child);
    }
    pop = newPop;
  }

  return { order: bestOrder, scores: bestScores, convergence };
}

/**
 * 슬롯 수에서 daySizes 자동 계산
 * 과목수를 일수에 최대한 균등하게 배분
 */
export function calcDaySizes(subjectCount: number, dayCount: number): number[] {
  if (dayCount <= 0) return [];
  const base  = Math.floor(subjectCount / dayCount);
  const extra = subjectCount % dayCount;
  return Array.from({ length: dayCount }, (_, i) => base + (i < extra ? 1 : 0));
}
