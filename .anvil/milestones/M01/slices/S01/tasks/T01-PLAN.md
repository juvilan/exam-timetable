T01: Define seating domain types
**Type**: implement
**Files**: src/utils/seatingEngine.ts
**Description**: Create the type definitions needed for the seating engine: `Student` (name, grade, class, examPeriod, etc.), `Room` (name, capacity, seats), `SeatAssignment` (student, room, seatNumber), and any intermediate grouping types. Port type concepts from `SeatingEngine.gs`. Export all types.
**Verify**: npx tsc --noEmit
**Depends**: none