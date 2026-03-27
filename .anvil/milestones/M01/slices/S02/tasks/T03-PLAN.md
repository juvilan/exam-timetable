T03: Integrate SeatingPanel as tab in EditorLayout
**Type**: implement
**Files**: src/components/EditorLayout.tsx (or the layout component containing tabs)
**Description**: Add a new tab entry for "Seating" in EditorLayout's tab list. Render `SeatingPanel` when the seating tab is active. Ensure tab switching works correctly alongside existing tabs.
**Verify**: npx tsc --noEmit && npm run dev (manual: click seating tab, verify panel renders, click run, verify summary appears)
**Depends**: