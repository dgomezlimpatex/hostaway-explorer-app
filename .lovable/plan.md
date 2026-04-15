

## Plan: Fix Laundry Delivery Links to Include All Collection Days

### Problem
When creating a laundry link for Wednesday, only Wednesday's tasks appear. The schedule configuration says Wednesday should collect tasks from **Tuesday + Wednesday** (collection_days=[2,3]), but the system ignores this.

### Root Causes

1. **`QuickDayLinksWidget`** creates links using only a single date (`fetchTasksForDates([dateStr])`), completely ignoring the delivery schedule configuration. It should look up which schedule matches the selected day, then fetch tasks for all its collection dates.

2. **Link date range too narrow**: The widget sets `dateStart` and `dateEnd` to the same single date, so even if tasks were fetched correctly, the public view's date filter (`gte/lte`) would exclude tasks from other days.

### Changes

**File 1: `src/components/laundry-share/QuickDayLinksWidget.tsx`**
- Import `useLaundryDeliverySchedule` and date utilities
- In `handleCreateLink`, find the matching schedule for the given date's day-of-week
- Calculate all collection dates based on the schedule's `collectionDays` array
- Call `fetchTasksForDates` with ALL collection dates instead of just one
- Set `dateStart`/`dateEnd` to span the full collection date range
- Update the task count queries to also use the schedule's collection dates

**File 2: No other files need changes** — The `LaundryScheduledLinkModal` already correctly uses `selectedOption.collectionDates` from `useDeliveryDayOptions`, so that path works. The issue is only in the QuickDayLinksWidget shortcut path.

### Technical Detail
For Wednesday (day_of_week=3, collection_days=[2,3]):
- Current: fetches tasks for `[2026-04-16]` only
- Fixed: fetches tasks for `[2026-04-15, 2026-04-16]` (Tuesday + Wednesday)
- Link created with `dateStart: 2026-04-15, dateEnd: 2026-04-16`

