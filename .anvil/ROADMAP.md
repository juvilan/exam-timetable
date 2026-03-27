

# Roadmap

## M01: Seating Engine
Build the exam room assignment engine and integrate it into the app.

### Slices
- S01: SeatingEngine core — Port `SeatingEngine.gs` to `src/utils/seatingEngine.ts` with types, period-based student grouping, room splitting (28-cap), and seat numbering
- S02: Seating UI + store — Add `seatingResult` to ExamSession, store action `setSeatingResult`, and `SeatingPanel.tsx` tab in EditorLayout with run button and result summary

## M02: Excel Export — Basic Sheets
Generate the foundational Excel sheets that don't depend on seating results.

### Slices
- S01: Export infrastructure — Install ExcelJS, create `src/utils/excelExport.ts` with workbook creation, browser download helper, and `gaResults` field on ExamSession
- S02: Timetable & reference sheets — Implement 시험시간표, 인쇄용_시간표, 시험_교시코드, 시간표_비교, 대기실_현황, 상세_통계 sheets

## M03: Excel Export — Seating Sheets + UI
Generate seating-dependent sheets and wire up the download UI.

### Slices
- S01: Seating data sheets — Implement 교시별응시현황, 담임안내용, 응시현황표, 학생데이터 sheets
- S02: Waiting list & seat maps — Implement 대기자 명단 (per-period) and 좌석배치도 (per-room) sheets
- S03: Export UI — Add `ExportPanel.tsx` with grade selection, conditional sheet generation (basic-only vs full), and `{학년}학년_{고사명}.xlsx` download
