import type { ExamSession, GradeConfig, SlotConfig, DayConfig } from '../types';
import { genId } from './id';

/** 기본 교시 시작시간 (전 학년 공통, 최대 4교시) */
export const DEFAULT_PERIOD_TIMES = [
  { period: 1, startTime: '08:30', durationMin: 50 },
  { period: 2, startTime: '09:40', durationMin: 50 },
  { period: 3, startTime: '10:50', durationMin: 50 },
  { period: 4, startTime: '12:00', durationMin: 50 },
];

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** 교시 수로 SlotConfig 배열 생성 (DEFAULT_PERIOD_TIMES 기반) */
export function makeSlotConfigs(periodCount: number): SlotConfig[] {
  return DEFAULT_PERIOD_TIMES.slice(0, Math.min(periodCount, 4)).map(p => ({
    period: p.period,
    startTime: p.startTime,
    endTime: addMinutes(p.startTime, p.durationMin),
    durationMin: p.durationMin,
  }));
}

/** 학년별 기본 슬롯: 1학년 = 1교시, 2/3학년 = 2교시 */
export function defaultSlotsForGrade(grade: 1 | 2 | 3): SlotConfig[] {
  return makeSlotConfigs(grade === 1 ? 1 : 2);
}

/** 하위 호환용 */
export function defaultSlots(): SlotConfig[] {
  return makeSlotConfigs(2);
}

/** 학년별 기본 GradeConfig 생성 */
export function defaultGradeConfig(grade: 1 | 2 | 3, dayCount: number): GradeConfig {
  return {
    grade,
    arrivalTime: grade === 1 ? '10:30' : null,
    slotConfigs: Array.from({ length: dayCount }, () => defaultSlotsForGrade(grade)),
  };
}

/** 새 고사 기본값 */
export function createDefaultExamSession(
  overrides: Partial<Pick<ExamSession, 'title' | 'schoolYear' | 'semester' | 'examType'>> = {}
): ExamSession {
  const now       = new Date().toISOString();
  const schoolYear = overrides.schoolYear ?? new Date().getFullYear();
  const semester   = overrides.semester ?? 1;
  const examType   = overrides.examType ?? 'mid';
  const title      = overrides.title ?? `${schoolYear}학년도 ${semester}학기 ${examType === 'mid' ? '중간고사' : '기말고사'}`;

  const days: DayConfig[] = Array.from({ length: 3 }, () => ({
    id:   genId('day'),
    date: '',
  }));

  const grades: GradeConfig[] = [1, 2, 3].map(g =>
    defaultGradeConfig(g as 1 | 2 | 3, days.length)
  );

  return {
    id:           genId('exam'),
    title,
    schoolYear,
    semester,
    examType,
    grades,
    days,
    subjects:     [],
    groups:       [],
    grid:         [],
    gradeMatrices: {},
    createdAt:    now,
    updatedAt:    now,
  };
}

/** 고사에서 과목이 이번 고사에 응시하는지 */
export function isSubjectActive(
  examScope: 'both' | 'mid_only' | 'final_only' | 'none',
  examType: 'mid' | 'final'
): boolean {
  if (examScope === 'none') return false;
  if (examScope === 'both') return true;
  if (examScope === 'mid_only') return examType === 'mid';
  if (examScope === 'final_only') return examType === 'final';
  return false;
}
