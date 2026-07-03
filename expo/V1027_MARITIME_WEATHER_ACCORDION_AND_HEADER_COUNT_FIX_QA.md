# V1027 Maritime Weather Accordion + Header Count Fix QA

## Baseline
Built from `easyseas_v1026_seapass_true_shell_default_split_fix_FULL_CODEBASE.zip`.

## User-reported issues
1. Weather sections throughout the app were taking too much visible space and should be hidden under an accordion called **Maritime Weather** by default.
2. The compact dashboard header showed `1178 Cruises`; it should say `1178 Available Cruises`.
3. The compact dashboard header showed the wrong offers count (`1 Offers`) while Settings/Data Overview showed `4 Offers`.
4. Header booked/offers counts should reflect the actual app data, not alert counts or filtered active-only counts.

## Changes made

### Maritime Weather accordion
- Updated `components/MarineAlertsPanel.tsx` so the weather panel is an accordion.
- The panel header always displays **Maritime Weather**.
- The panel defaults to closed.
- The marine forecast query is disabled until the accordion is opened, reducing unnecessary background fetches.
- When opened, the previous rough-seas/weather-alert details remain available.

### Day Agenda weather section
- Updated `app/day-agenda.tsx` so the whole sailing weather block is behind a **Maritime Weather** accordion.
- The Day Agenda weather cards are now closed by default.
- Opening the accordion reveals the Marine Alerts panel and detailed Sailing Weather cards.

### Compact dashboard labels
- Updated `components/CompactDashboardHeader.tsx` so the cruise stat label reads **Available Cruises** instead of **Cruises**.
- Applied this to Royal Caribbean, Celebrity, Silversea, and Carnival header variants.

### Count fixes
- Updated `app/(tabs)/scheduling.tsx` so the header offer count uses the actual number of offer records in the current filtered data set, not the weather/offer-alert count.
- Updated `app/(tabs)/(overview)/index.tsx` so the header offer count uses total unique offers in the system instead of active-only/unblocked offers.

## Files changed
- `components/MarineAlertsPanel.tsx`
- `app/day-agenda.tsx`
- `components/CompactDashboardHeader.tsx`
- `app/(tabs)/scheduling.tsx`
- `app/(tabs)/(overview)/index.tsx`

## Expected result
- Weather sections are collapsed by default under **Maritime Weather**.
- The header reads `1178 Available Cruises`, not `1178 Cruises`.
- The header offer count should match Settings/Data Overview when the same profile/filter scope is selected.
- Booked count remains based on active booked cruises.
