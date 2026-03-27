T02: Create SeatingPanel component with run button and result summary
**Type**: implement
**Files**: src/components/SeatingPanel.tsx
**Description**: Create `SeatingPanel.tsx` that reads `seatingResult` from the store. Include a "Run" button (calls `setSeatingResult` with placeholder/mock data for now). When result exists, display a summary (e.g. total assigned, unassigned count). When null, show empty state message.
**Verify**: npx tsc --noEmit
**Depends**: