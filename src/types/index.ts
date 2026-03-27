// ============================================================
// 핵심 타입 정의
// ============================================================

/** 교시 설정 (날짜·학년별 독립) */
export type SlotConfig = {
  period: number;
  startTime: string;  // "08:30"
  endTime: string;    // "09:20"
  durationMin: number;
};

/** 일자 설정 */
export type DayConfig = {
  id: string;
  date: string;       // "2025-04-14"
};

/** 학년별 설정 */
export type GradeConfig = {
  grade: 1 | 2 | 3;
  arrivalTime: string | null;     // "10:30" → 시차등교 행 표시, null = 일반 등교
  slotConfigs: SlotConfig[][];    // [dayIdx][slotIdx]
};

/** 집중이수 반 설정 */
export type ConcentratedClass = '1~4반' | '5~8반' | string;

/** 과목 */
export type Subject = {
  id: string;
  name: string;
  grade: 1 | 2 | 3;
  examScope: 'both' | 'mid_only' | 'final_only' | 'none';
  groupId: string | null;
  concentratedClass?: ConcentratedClass | null;
};

/** 병렬 배치 그룹 타입 */
export type GroupType = 'elective' | 'class_split' | 'culture';

/** 병렬 배치 그룹 */
export type SubjectGroup = {
  id: string;
  displayLabel: string;   // "일본어Ⅰ/중국어Ⅰ"
  subjectIds: string[];
  groupType: GroupType;
};

/** 셀 내용 */
export type CellContent =
  | { type: 'single'; subjectId: string }
  | { type: 'group'; groupId: string; activeSubjectIds: string[] };

/** 배치 셀 */
export type GridCell = {
  gradeIndex: number;
  dayIndex: number;
  slotIndex: number;
  content: CellContent | null;
};

/**
 * GA 최적화에 필요한 학생-과목 행렬 (학년별)
 * 선택과목 Excel에서 파싱해서 저장
 */
export type GradeMatrix = {
  grade: 1 | 2 | 3;
  subjectNames: string[];   // 과목명 목록 (열 순서)
  matrix: number[][];       // [studentIdx][subjectIdx] = 0|1
  studentCount: number;
};

/** 고사 단위 (최상위) */
export type ExamSession = {
  id: string;
  title: string;              // "2025학년도 1학기 중간고사"
  schoolYear: number;
  semester: 1 | 2;
  examType: 'mid' | 'final';
  grades: GradeConfig[];
  days: DayConfig[];
  subjects: Subject[];
  groups: SubjectGroup[];
  grid: GridCell[];
  gradeMatrices: Partial<Record<string, GradeMatrix>>; // key = grade ("2", "3")
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// 유틸리티 타입
// ============================================================

/** 고사 목록 화면용 요약 */
export type ExamSummary = Pick<ExamSession, 'id' | 'title' | 'schoolYear' | 'semester' | 'examType' | 'createdAt' | 'updatedAt'> & {
  gradeCount: number;
  subjectCount: number;
};

/** GA 결과 가져오기 포맷 */
export type GaImportData = {
  order: string[];          // 과목명 배열 (순서 = 배치 순서)
  periodCodeMap?: Record<string, string>;  // { "과목명": "11" } 형태도 허용
};

/** 드래그 아이템 */
export type DragItemType = 'subject' | 'group';
export type DragItem = {
  type: DragItemType;
  subjectId?: string;
  groupId?: string;
};

/** 드롭 대상 */
export type DropTarget = {
  gradeIndex: number;
  dayIndex: number;
  slotIndex: number;
};

// ============================================================
// 학기별 참여 학년 기본값
// ============================================================
export const DEFAULT_GRADE_PARTICIPATION: Record<`${1|2}_${'mid'|'final'}`, (1|2|3)[]> = {
  '1_mid':   [1, 2, 3],
  '1_final': [1, 2, 3],
  '2_mid':   [1, 2, 3],
  '2_final': [1, 2],    // 2학기 기말: 3학년 제외
};

// 학년별 테마 색상
export const GRADE_COLORS: Record<1|2|3, { bg: string; text: string; border: string }> = {
  1: { bg: '#FFF9C4', text: '#F57F17', border: '#F9A825' },
  2: { bg: '#E3F2FD', text: '#1565C0', border: '#1E88E5' },
  3: { bg: '#E8F5E9', text: '#2E7D32', border: '#43A047' },
};
