import * as XLSX from 'xlsx';
import type { GradeMatrix } from '../types';

export interface SubjectImportResult {
  grade: 1 | 2 | 3;
  subjectNames: string[];
  studentCount: number;
}

export interface GaExcelResult {
  subjectName: string;
  periodCode: number;
}

/**
 * 선택과목 Excel 파싱 (과목명만)
 * 형식: 1행=헤더(학년/반/번호/이름/과목...), 2행~=학생데이터
 */
export function parseSubjectExcel(buffer: ArrayBuffer): SubjectImportResult {
  const { grade, subjectNames, studentCount } = parseSubjectMatrix(buffer);
  return { grade, subjectNames, studentCount };
}

/**
 * 선택과목 Excel 전체 파싱 (GA용 학생-과목 행렬 포함)
 * 반환: GradeMatrix (grade, subjectNames, matrix, studentCount)
 */
export function parseSubjectMatrix(buffer: ArrayBuffer): GradeMatrix {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];

  if (rows.length < 2) throw new Error('데이터가 없습니다.');

  const header = rows[0] as string[];
  const subjectNames = header.slice(4).map(s => String(s).trim()).filter(Boolean);

  const firstDataRow = rows[1] as (string | number)[];
  const gradeRaw = Number(firstDataRow[0]);
  const grade = ([1, 2, 3].includes(gradeRaw) ? gradeRaw : 2) as 1 | 2 | 3;

  const dataRows = rows.slice(1).filter(r => r && (r as unknown[])[0]);
  const matrix = dataRows.map(row => {
    const r = row as (string | number)[];
    return subjectNames.map((_, si) => (Number(r[4 + si]) === 1 ? 1 : 0));
  });

  return { grade, subjectNames, matrix, studentCount: dataRows.length };
}

/**
 * 가안 Excel에서 GA 결과(시험_교시코드 시트) 파싱
 * 형식: 과목명 | 교시코드 | AI_과목명 | AI_교시코드
 */
export function parseGaResultExcel(buffer: ArrayBuffer): GaExcelResult[] {
  const wb = XLSX.read(buffer, { type: 'array' });

  // '시험_교시코드' 시트 우선, 없으면 첫 시트
  const sheetName = wb.SheetNames.find(n => n.includes('교시코드')) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws) as Record<string, unknown>[];

  const results: GaExcelResult[] = [];
  for (const row of rows) {
    const nameKey = Object.keys(row).find(k => k.includes('과목'));
    const codeKey = Object.keys(row).find(k => k.includes('교시코드'));
    if (!nameKey || !codeKey) continue;
    const name = String(row[nameKey] ?? '').trim();
    const code = Number(row[codeKey]);
    if (name && !isNaN(code) && code > 0) {
      results.push({ subjectName: name, periodCode: code });
    }
  }
  return results;
}

/**
 * 시험시간표 시트 파싱 (교시 x 일차 그리드)
 * 형식: 교시 | 1일차 | 2일차 | ...
 */
export interface TimetableCell {
  slotIndex: number; // 0-based
  dayIndex: number;  // 0-based
  subjectName: string;
}

export function parseTimetableSheet(buffer: ArrayBuffer): TimetableCell[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => n.includes('시험시간표')) ?? '';
  if (!sheetName) return [];

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as unknown[][];

  const cells: TimetableCell[] = [];
  // 첫 행: 타이틀, 두 번째 행: "교시" | "1일차" | "2일차" ...
  const headerRowIdx = rows.findIndex(r => (r as string[])[0] === '교시');
  if (headerRowIdx < 0) return cells;

  for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
    const row = rows[ri] as (string | null)[];
    if (!row || !row[0]) continue;
    const slotIndex = ri - headerRowIdx - 1;
    for (let di = 1; di < row.length; di++) {
      const name = String(row[di] ?? '').trim();
      if (name) cells.push({ slotIndex, dayIndex: di - 1, subjectName: name });
    }
  }
  return cells;
}
