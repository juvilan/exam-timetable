T04: Add unit tests for SeatingEngine
**Type**: test
**Files**: src/utils/__tests__/seatingEngine.test.ts
**Description**: Test period grouping (students correctly bucketed), room splitting (groups >28 split into multiple rooms, last room has correct count), seat numbering (sequential 1–N per room), and full `runSeatingEngine` end-to-end with a mixed dataset of ~60 students across 2 periods.
**Verify**: npx vitest run src/utils/__tests__/seatingEngine.test.ts
**Depends**: