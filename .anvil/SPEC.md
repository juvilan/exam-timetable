# 시험 시간표 관리 시스템 — Excel 출력 + 응시반 편성

## 프로젝트 개요

고등학교 정기고사(중간·기말) 시간표를 관리하는 React 웹앱.
이미 구현된 기능: GA 최적화, 드래그앤드롭 시간표 편집, 과목/그룹 관리.

**이번 스펙 범위**: 확정된 시간표를 바탕으로
1. 응시반 편성 (학생별 시험반 배정)
2. Excel 결과물 다운로드 (22개 시트)

---

## 기술 스택

- React 18 + TypeScript + Vite (브라우저 전용, 서버 없음)
- Zustand (상태관리, localStorage 자동저장)
- ExcelJS (브라우저에서 xlsx 생성)
- @dnd-kit/core (드래그앤드롭, 기존 구현)

---

## 현재 코드베이스 구조

```
src/
  types/index.ts          ← 핵심 타입 (ExamSession, GradeMatrix, Subject 등)
  store/examStore.ts      ← Zustand 스토어 (전체 상태 + 액션)
  utils/
    gaEngine.ts           ← GA 최적화 엔진
    xlsxImport.ts         ← 선택과목 Excel 파싱
    examDefaults.ts       ← 기본값 생성
  workers/gaWorker.ts     ← GA Web Worker
  components/
    Grid/
      TimetableGrid.tsx   ← 드래그앤드롭 시간표 그리드
      EditorLayout.tsx    ← 편집 화면 레이아웃 (사이드탭: 최적화/과목·그룹)
    Optimize/
      OptimizePanel.tsx   ← GA 실행 UI (Excel 가져오기 → 최적화 → 배치)
    SubjectPanel/
      SubjectPanel.tsx    ← 과목/그룹 관리
    ExamList/ExamList.tsx ← 고사 목록
    ExamForm/ExamForm.tsx ← 고사 설정
    Print/PrintView.tsx   ← 인쇄 미리보기
```

### 핵심 타입 요약

```typescript
// src/types/index.ts 참조
type ExamSession = {
  id: string; title: string; schoolYear: number;
  semester: 1|2; examType: 'mid'|'final';
  grades: GradeConfig[];    // 학년별 설정 (시차등교, 교시시간)
  days: DayConfig[];        // 시험 일자 (최대 5일)
  subjects: Subject[];      // 과목 목록
  groups: SubjectGroup[];   // 병렬배치 그룹 (elective/class_split/culture)
  grid: GridCell[];         // 시간표 배치 결과
  gradeMatrices: Partial<Record<string, GradeMatrix>>; // 학생-과목 행렬
};

type GradeMatrix = {
  grade: 1|2|3;
  subjectNames: string[];
  matrix: number[][];   // [studentIdx][subjectIdx] = 0|1
  studentCount: number;
};

type GridCell = {
  gradeIndex: number; dayIndex: number; slotIndex: number;
  content: CellContent | null;
};
```

---

## 참조 파일

### GAS 원본 (포팅 참조용)
- `/Users/jeongsanghwa/Projects/school-tools/exam-timetable-optimizer/SeatingEngine.gs` — 응시반 편성 엔진
- `/Users/jeongsanghwa/Projects/school-tools/exam-timetable-optimizer/SheetOutput.gs` — 시트 출력 로직
- `/Users/jeongsanghwa/Projects/school-tools/exam-timetable-optimizer/SeatingOutput.gs` — 응시반 출력 로직

### 기대 출력 예시 (Excel 결과물 구조 파악용)
- `/Users/jeongsanghwa/내 드라이브(juvilan0429@gmail.com)/000_교무부_공유/4_정기고사/2026/1_1학기 중간고사/2학년_1학기_중간_가안.xlsx`
- `/Users/jeongsanghwa/내 드라이브(juvilan0429@gmail.com)/000_교무부_공유/4_정기고사/2026/1_1학기 중간고사/3학년_1학기_중간_가안.xlsx`

---

## Milestone 1: 응시반 편성 엔진

### 배경
- 학생별 응시 과목이 다르므로 같은 교시에 같은 과목 보는 학생끼리 모아 응시반 편성
- 응시반 정원: 28명 (기본), 초과 시 분반
- 결과: 학생별 응시반 번호 + 자리 번호 배정

### Slice 1-1: SeatingEngine 포팅
**목표**: `SeatingEngine.gs` 로직을 TypeScript로 포팅

파일: `src/utils/seatingEngine.ts`

```typescript
// 입력
interface SeatingInput {
  gradeMatrix: GradeMatrix;         // 학생-과목 행렬
  periodCodeMap: Record<string, string>; // 과목명 → 교시코드 ("11", "12" 등)
  roomCapacity?: number;            // 응시반 정원 (기본 28)
}

// 출력
interface SeatingResult {
  // 교시별 응시반: examRooms[교시코드] = 반 배열
  examRooms: Record<string, ExamRoom[]>;
  // 학생별 배정 결과
  studentAssignments: StudentAssignment[];
}

interface ExamRoom {
  roomNumber: number;       // 응시반 번호 (1반부터)
  periodCode: string;       // "11" (1일차 1교시)
  subjectName: string;
  students: AssignedStudent[];
}

interface StudentAssignment {
  studentId: number;        // 학번
  name: string;
  classNum: number;         // 원반
  seatNum: number;          // 원반 번호
  // 교시코드 → 응시반/번호
  roomAssignments: Record<string, { roomNumber: number; seatNumber: number }>;
}
```

**구현 참조**: `SeatingEngine.gs`의 `assignRegularStudents_`, `runExamAssignmentWithSpecial` 함수

**핵심 로직**:
1. 교시별로 해당 과목 응시 학생 목록 추출
2. 학번 순 정렬
3. 28명씩 응시반 분할
4. 각 학생에게 응시반 번호 + 자리 번호 배정

### Slice 1-2: 응시반 편성 UI

파일: `src/components/Seating/SeatingPanel.tsx`

위치: EditorLayout의 사이드탭에 "🪑 응시반" 탭 추가

기능:
- `▶ 응시반 편성` 버튼 — SeatingEngine 실행
- 결과 요약: 학년별 응시반 수, 총 학생 수
- 결과를 ExamSession에 저장 (`seatingResult` 필드 추가)

스토어 추가:
```typescript
// examStore.ts에 추가
setSeatingResult: (sessionId: string, result: SeatingResult) => void;
```

---

## Milestone 2: Excel 출력

### 배경
ExcelJS를 브라우저에서 사용해 xlsx 파일 생성 후 다운로드.
학년별로 별도 xlsx 파일 생성 (2학년.xlsx, 3학년.xlsx).

### 의존성 추가
```bash
npm install exceljs
```

### Slice 2-1: 기본 시트 출력

파일: `src/utils/excelExport.ts`

생성할 시트 (기본 정보):

**시험시간표** 시트:
```
[학년] [학기] [고사명] 시간표
교시 | 1일차 | 2일차 | 3일차 | 4일차 | 5일차
1교시 | 대수  | 문학  | 영어Ⅰ | ...
2교시 | 화학  | 기하  | 물리학 | ...
```

**인쇄용_시간표** 시트:
- 시험시간표와 동일 구조
- 공통과목에 `[공통]` 태그 추가 (예: `대수\n[공통]`)
- 선택과목은 태그 없음

**시험_교시코드** 시트:
```
과목명 | 교시코드 | AI_과목명 | AI_교시코드
대수   | 11      | 대수      | 11
```

**시간표_비교** 시트:
```
[학년] 시간표 비교 (AI 최적 vs 수동 조정)
교시코드 | AI 최적 과목명 | 수동 조정 과목명 | 변경 여부
11      | 대수           | 대수             | 동일
```
- AI 최적 = GA 최초 결과 (session에 저장된 gaResult)
- 수동 조정 = 현재 grid 상태
- 변경 여부: "동일" / "변경"

**대기실_현황** 시트:
```
[학년] 대기실 현황
교시/과목           | [학년] 대기 | 제한: 60명
1일차 1교시\n대수   | 0          |
```
- 대기: 해당 교시에 앞뒤로 시험이 있어 대기실에 있어야 하는 학생 수

**상세_통계** 시트:
- GA 실행 파라미터 (세대수, 점수)
- 과목별 응시자 수
- 교시별 총 응시자 수

### Slice 2-2: 응시반 데이터 시트

(SeatingResult가 있을 때 생성)

**교시별응시현황** 시트:
```
[학년] 교시별 응시 현황
응시반 | 1일차\n1교시\n대수 | 1일차\n2교시\n화학 | ...
1반   | 28               | 26              | ...
합계  | 173              | 173             |
```

**담임안내용** 시트:
```
[학년] 응시반 편성 안내
학번   | 응시반/번호 | 이름 | 1일차\n1교시\n대수 | ...
20101 | 4반/20번   | 홍길동 | 1             | ...
```
- 원반(담임반) 순서로 정렬
- 응시하는 과목만 1, 미응시는 빈칸

**응시현황표** 시트:
```
[학년] 응시 현황
응시반/번호 | 학번  | 이름   | 1일차\n1교시\n대수 | ...
1반/01번   | 20120 | 조하진 | 1               | ...
```
- 응시반 번호 순서로 정렬

**학생데이터** 시트:
- GradeMatrix의 원본 데이터 그대로 복사

### Slice 2-3: 대기자 명단 + 좌석배치도

**대기자 명단** (4일차/5일차 각 교시별, 해당하는 경우만 생성):

시트명: `{N}일차{P}교시_대기`
```
[학년] {N}일차 {P}교시 대기자 명단 (총 X명)
응시반/번호 | 학번  | 이름   | 다음 시험 교시
1반/01번   | 20120 | 조하진 | 4일차 3교시
```
- 해당 교시 직전에 시험이 없고 직후에 시험이 있는 학생
- 즉, 그 교시에 시험이 없지만 같은 날 이후에 시험이 있어 학교에 남아야 하는 학생

**좌석배치도** (반별):

시트명: `좌석배치도_{N}반`
```
[학년] {N}반 좌석 배치
응시번호 | 학번  | 이름
1       | 20120 | 조하진 | (빈칸) | 교탁
2       | 20204 | 김철수
...
```
- 응시반 내 번호 순서
- "교탁" 텍스트는 1번 학생 행의 우측에 배치

### Slice 2-4: Excel 내보내기 UI

파일: `src/components/Export/ExportPanel.tsx`

위치: EditorLayout 상단 바에 `💾 Excel 내보내기` 버튼 추가

기능:
- 학년 선택 (2학년 / 3학년 / 전체)
- GradeMatrix 없는 학년은 기본 시트만 생성 (시험시간표, 시험_교시코드)
- SeatingResult 있는 학년은 전체 시트 생성
- `다운로드` 클릭 시 `{학년}학년_{고사명}.xlsx` 저장

---

## 구현 제약 및 주의사항

### 불변성 (CRITICAL)
```typescript
// 절대 금지: 기존 객체 직접 수정
sessions[idx].grid = newGrid;

// 올바른 방법: 새 객체 생성
return sessions.map(s => s.id === id ? { ...s, grid: newGrid } : s);
```

### 파일 크기
- 파일당 800줄 이하
- 함수당 50줄 이하
- 큰 유틸리티는 파일 분리

### ExcelJS 브라우저 사용
```typescript
import ExcelJS from 'exceljs';

// 브라우저에서 다운로드
const wb = new ExcelJS.Workbook();
// ... 시트 생성 ...
const buf = await wb.xlsx.writeBuffer();
const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'output.xlsx'; a.click();
URL.revokeObjectURL(url);
```

### 기존 applyGaOrder 활용
시간표_비교 시트의 "AI 최적" 값은 OptimizePanel의 GaResult에서 가져옴.
ExamSession에 `gaResults: Partial<Record<string, GaResult>>` 필드를 추가해 저장.

### CSS Modules
모든 스타일은 `ComponentName.module.css` 파일에 작성.
인라인 스타일은 동적 값(색상 변수 등)에만 사용.

---

## 완료 기준 (Acceptance Criteria)

1. `npm run build` 오류 없이 통과
2. `npx tsc --noEmit` 오류 없이 통과
3. 브라우저에서:
   - 선택과목 Excel 가져오기 → GA 최적화 → 시간표 배치 → 응시반 편성 → Excel 다운로드 전체 흐름 동작
   - 다운로드된 xlsx 파일에 모든 시트 존재
   - 시험시간표 시트의 과목 배치가 앱 그리드와 일치
   - 교시별응시현황의 합계가 선택과목 Excel의 실제 학생 수와 일치
