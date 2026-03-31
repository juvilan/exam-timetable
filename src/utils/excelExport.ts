import * as XLSX from 'xlsx';
import type { ExamSession, GradeConfig, GradeMatrix } from '../types';

// ============================================================
// Helpers
// ============================================================

/** 교시코드: (dayIndex+1)*10 + (slotIndex+1). 예) 1일차 2교시 → 12 */
function periodCode(dayIndex: number, slotIndex: number): number {
  return (dayIndex + 1) * 10 + (slotIndex + 1);
}

/** 셀 내용에서 과목명 문자열 반환 */
function cellLabel(
  session: ExamSession,
  gradeIndex: number,
  dayIndex: number,
  slotIndex: number
): string {
  const cell = session.grid.find(
    c => c.gradeIndex === gradeIndex && c.dayIndex === dayIndex && c.slotIndex === slotIndex
  );
  if (!cell || !cell.content) return '';
  const content = cell.content;
  if (content.type === 'single') {
    return session.subjects.find(s => s.id === content.subjectId)?.name ?? '';
  }
  return (content as { type: 'group'; activeSubjectIds: string[] }).activeSubjectIds
    .map(id => session.subjects.find(s => s.id === id)?.name ?? id)
    .join(' / ');
}

/** 과목이 공통과목인지 (어떤 그룹에도 속하지 않으면 공통) */
function isCommonSubject(session: ExamSession, subjectId: string): boolean {
  return !session.groups.some(g => g.subjectIds.includes(subjectId));
}

// ============================================================
// Sheet builders
// ============================================================

/** 시험시간표 시트: 행=교시, 열=일차 */
function buildTimetableSheet(
  session: ExamSession,
  gradeConfig: GradeConfig,
  gi: number,
  withCommonTag: boolean
): XLSX.WorkSheet {
  const maxSlots = Math.max(...gradeConfig.slotConfigs.flatMap(d => d.length), 0);
  const rows: unknown[][] = [];

  // 타이틀
  rows.push([`${gradeConfig.grade}학년 시험시간표`]);
  rows.push([]);

  // 헤더: 교시 | 1일차(날짜) | 2일차(날짜) | ...
  const header: string[] = ['교시', ...session.days.map((d, di) => `${di + 1}일차${d.date ? `\n(${d.date})` : ''}`)];
  rows.push(header);

  for (let si = 0; si < maxSlots; si++) {
    const slot = gradeConfig.slotConfigs[0]?.[si];
    if (!slot) continue;
    const row: string[] = [`${si + 1}교시\n${slot.startTime}~${slot.endTime}`];
    for (let di = 0; di < session.days.length; di++) {
      const cell = session.grid.find(
        c => c.gradeIndex === gi && c.dayIndex === di && c.slotIndex === si
      );
      let label = '';
      if (cell && cell.content) {
        const content = cell.content;
        if (content.type === 'single') {
          const subj = session.subjects.find(s => s.id === content.subjectId);
          label = subj?.name ?? '';
          if (withCommonTag && subj && isCommonSubject(session, subj.id)) {
            label += '\n[공통]';
          }
        } else {
          label = (cell.content as { type: 'group'; activeSubjectIds: string[] }).activeSubjectIds
            .map(id => session.subjects.find(s => s.id === id)?.name ?? id)
            .join(' / ');
        }
      }
      row.push(label);
    }
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, ...session.days.map(() => ({ wch: 16 }))];
  return ws;
}

/** 시험_교시코드 시트: 과목명 | 교시코드 | AI_과목명 | AI_교시코드 */
function buildPeriodCodeSheet(
  session: ExamSession,
  gradeConfig: GradeConfig,
  gi: number
): XLSX.WorkSheet {
  const rows: unknown[][] = [];
  rows.push([`${gradeConfig.grade}학년 시험_교시코드`]);
  rows.push([]);
  rows.push(['과목명', '교시코드', 'AI_과목명', 'AI_교시코드']);

  const seen = new Set<string>();
  for (let di = 0; di < session.days.length; di++) {
    const maxSlots = gradeConfig.slotConfigs[di]?.length ?? 0;
    for (let si = 0; si < maxSlots; si++) {
      const label = cellLabel(session, gi, di, si);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      const code = periodCode(di, si);
      rows.push([label, code, label, code]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
  return ws;
}

/** 교시별응시현황 시트: 교시 | 과목 | 응시인원 */
function buildAttendanceSheet(
  session: ExamSession,
  gradeConfig: GradeConfig,
  gi: number,
  matrix: GradeMatrix
): XLSX.WorkSheet {
  const rows: unknown[][] = [];
  rows.push([`${gradeConfig.grade}학년 교시별 응시 현황`]);
  rows.push([]);
  rows.push(['교시코드', '교시', '과목', '응시인원']);

  const { subjectNames, matrix: mat } = matrix;

  for (let di = 0; di < session.days.length; di++) {
    const maxSlots = gradeConfig.slotConfigs[di]?.length ?? 0;
    for (let si = 0; si < maxSlots; si++) {
      const label = cellLabel(session, gi, di, si);
      if (!label) continue;
      const code = periodCode(di, si);
      const periodLabel = `${di + 1}일차 ${si + 1}교시`;

      // 해당 교시 과목에 응시하는 학생 수 계산
      // 과목명이 여러 개(그룹)인 경우 각 과목별로 OR 처리
      const subjectLabels = label.split(' / ');
      let count = 0;
      for (const subjName of subjectLabels) {
        const subjIdx = subjectNames.findIndex(n => n === subjName || n.includes(subjName) || subjName.includes(n));
        if (subjIdx >= 0) {
          count += mat.filter(row => row[subjIdx] === 1).length;
        }
      }

      rows.push([code, periodLabel, label, count]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 10 }];
  return ws;
}

/** 상세_통계 시트 */
function buildStatsSheet(
  session: ExamSession,
  gradeConfig: GradeConfig,
  _gi: number,
  matrix: GradeMatrix | null
): XLSX.WorkSheet {
  const rows: unknown[][] = [];
  rows.push([`${gradeConfig.grade}학년 상세 통계`]);
  rows.push([]);

  if (matrix) {
    rows.push(['학생 수', matrix.studentCount]);
    rows.push([]);
    rows.push(['과목명', '응시인원']);
    for (let si = 0; si < matrix.subjectNames.length; si++) {
      const count = matrix.matrix.filter(row => row[si] === 1).length;
      rows.push([matrix.subjectNames[si], count]);
    }
  } else {
    rows.push(['(선택과목 Excel 없음 — 과목 수만 표시)']);
    rows.push([]);
    const gradeSubjects = session.subjects.filter(s => s.grade === gradeConfig.grade);
    rows.push(['과목 수', gradeSubjects.length]);
    rows.push(['과목명']);
    for (const s of gradeSubjects) rows.push([s.name]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 12 }];
  return ws;
}

// ============================================================
// Public API
// ============================================================

export interface ExportOptions {
  grade: 2 | 3 | 'all';
}

/** 학년 xlsx Blob 생성 후 다운로드 */
export function exportExcel(session: ExamSession, options: ExportOptions): void {
  const targetGrades: (2 | 3)[] = options.grade === 'all' ? [2, 3] : [options.grade];

  for (const grade of targetGrades) {
    const gi = session.grades.findIndex(g => g.grade === grade);
    if (gi < 0) continue;
    const gradeConfig = session.grades[gi];
    const matrix = session.gradeMatrices?.[String(grade)] ?? null;

    const wb = XLSX.utils.book_new();

    // 기본 시트
    XLSX.utils.book_append_sheet(wb, buildTimetableSheet(session, gradeConfig, gi, false), '시험시간표');
    XLSX.utils.book_append_sheet(wb, buildTimetableSheet(session, gradeConfig, gi, true), '인쇄용_시간표');
    XLSX.utils.book_append_sheet(wb, buildPeriodCodeSheet(session, gradeConfig, gi), '시험_교시코드');

    // 선택과목 데이터 있을 때
    if (matrix) {
      XLSX.utils.book_append_sheet(wb, buildAttendanceSheet(session, gradeConfig, gi, matrix), '교시별응시현황');
    }

    // 통계
    XLSX.utils.book_append_sheet(wb, buildStatsSheet(session, gradeConfig, gi, matrix), '상세_통계');

    const fileName = `${grade}학년_${session.title}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
