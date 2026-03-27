T01: Extend store with seatingResult field and action
**Type**: implement
**Files**: src/store/*.ts (or wherever ExamSession type and zustand store live)
**Description**: Add `seatingResult` field to `ExamSession` type (nullable, holds seating assignment data). Add `setSeatingResult` action to the zustand store. Initialize `seatingResult` as `null` in default state.
**Verify**: npx tsc --noEmit
**Depends**: none