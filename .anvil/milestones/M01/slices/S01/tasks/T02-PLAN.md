T02: Implement period-based grouping and room splitting
**Type**: implement
**Files**: src/utils/seatingEngine.ts
**Description**: Implement `groupStudentsByPeriod()` to bucket students by exam period. Implement `splitIntoRooms()` that takes a group and splits into rooms with 28-seat capacity, creating additional rooms when overflow occurs. Port logic from `SeatingEngine.gs`.
**Verify**: npx tsc --noEmit
**Depends**: