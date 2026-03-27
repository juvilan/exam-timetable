import type { ExamSession, GradeConfig, SlotConfig, DayConfig } from '../types';
import { genId } from './id';

/** 기본 교시 설정 (5교시) */
export function defaultSlots(): SlotConfig[] {
  return [
    { period: 1, startTime: '08:40', endTime: '09:30', durationMin: 50 },
    { period: 2, startTime: '09:50', endTime: '10:40', durationMin: 50 },
    { period: 3, startTime: '11:00', endTime: '11:50', durationMin: 50 },
    { period: 4, startTime: '13:00', endTime: '13:50', durationMin: 50 },
    { period: 5, startTime: '14:10', endTime: '15:00', durationMin: 50 },
  ];
}

/** 학년별 기본 GradeConfig 생성 */
export function defaultGradeConfig(grade: 1 | 2 | 3, dayCount: number): GradeConfig {
  return {
    grade,
    arrivalTime: grade === 1 ? '10:30' : null,
    slotConfigs: Array.from({ length: dayCount }, () => defaultSlots()),
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
    id:         genId('exam'),
    title,
    schoolYear,
    semester,
    examType,
    grades,
    days,
    subjects:   [],
    groups:     [],
    grid:       [],
    createdAt:  now,
    updatedAt:  now,
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
