T03: Implement seat numbering and main engine entry point
**Type**: implement
**Files**: src/utils/seatingEngine.ts
**Description**: Implement `assignSeats()` that numbers seats 1–28 within each room. Create the main `runSeatingEngine(students: Student[]): SeatAssignment[]` entry point that chains grouping → room splitting → seat numbering. Export the public API.
**Verify**: npx tsc --noEmit
**Depends**: