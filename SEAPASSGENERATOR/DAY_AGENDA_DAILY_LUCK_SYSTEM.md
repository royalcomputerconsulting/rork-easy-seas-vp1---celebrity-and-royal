# Day Agenda + Daily Luck System

## Scope
This document captures how the current app builds the Day Agenda screen, how Daily Luck is generated and stored, how the live luck card is fetched, and which files matter if this system ever needs to be rebuilt.

## Primary source-of-truth files
### Day Agenda route and UI
- `expo/app/day-agenda.tsx`
- `expo/app/_layout.tsx`
- `expo/app/(tabs)/events.tsx`

### Daily Luck types and generation
- `expo/types/daily-luck.ts`
- `expo/lib/dailyLuck.ts`
- `expo/lib/dailyLuck/signs.ts`
- `expo/constants/earthRoosterLuck2026.ts`
- `expo/lib/date.ts`

### User persistence and retrieval
- `expo/state/UserProvider.tsx`

### Daily Luck UI
- `expo/components/DailyLuckReport.tsx`
- `expo/components/daily-luck/DailyLuckExpandedCard.tsx`

### Backend live-analysis route
- `expo/report_export/render-backend-v2/src/trpc/app-router.ts`
- Snapshot copy archived at `SEAPASSGENERATOR/code/expo/report_export/render-backend-v2/src/trpc/app-router.ts`

## Route and screen ownership
- Public route path: `/day-agenda`
- Main screen component: `DayAgendaScreen`
- Current layout version constant: `agenda_24h_v2`
- Header owner: the page itself uses `headerShown: false`
- Current top-of-screen header state:
  - back button
  - “Day Agenda” title row
  - sync button
  - date
  - `LUCK#` chip
- Explicitly removed from the current top area:
  - runtime fingerprint card
  - timed block count text
  - “strong luck day” label

## What a Day Agenda page is
The app does not prebuild static day-agenda pages. Each page is created on demand from the `date` route param.

High-level flow:
1. Read the selected date from the route.
2. Normalize the user birthdate.
3. Ensure the selected year has stored daily-luck entries.
4. Read the stored daily-luck entry for the selected day.
5. Merge booked cruises and local calendar/travel data.
6. Build:
   - `agendaItems`
   - `timelineEvents`
   - `dayScheduleData`
   - `opportunePlayingTimes`
   - session tracker inputs
7. Render the sections for that single date.

## Current Day Agenda render sections
In current order, the screen renders:
1. top header row
2. date header with `LUCK#`
3. `24-Hour Agenda`
4. daily-luck section
5. `Cruises & Events`
6. casino session tracker
7. `Opportune Playing Times`
8. `Day Timeline`
9. time-zone converter
10. add-session modal

## Day Agenda data pipeline
### Selected date
`day-agenda.tsx` resolves a single `selectedDate` from the route param and derives:
- `formattedDate`
- `selectedDayWindow.start`
- `selectedDayWindow.end`
- `dateStr`

### Birthdate normalization
The screen resolves birthdate through:
- `currentUser?.birthdate`
- `normalizeBirthdateInput(...)`

This is important because the Daily Luck system relies on a normalized birthdate string before generating or fetching luck.

### Stored Daily Luck lookup
The screen uses `useUser()` and reads:
- `ensureDailyLuckYear(year)`
- `getDailyLuckEntry(date)`

On mount/date change, it calls `ensureDailyLuckYear(selectedDate.getFullYear())`.

It then calculates:
- `storedDailyLuckEntry`
- `dailyLuckDigit`
- `dailyLuckColor`

The priority order is:
1. stored daily-luck entry if available
2. fallback digit from `getDailyLuckDigitForDate(...)`

### Cruise/calendar merge
The Day Agenda merges cruise data from multiple places using:
- `mergeBookedCruiseSources(localData.booked || [], bookedCruises)`

It then builds merged same-sailing cruise groups keyed by ship + sail date so the agenda shows a combined sailing with combined booking metadata.

### Timeline and schedule generation
The screen creates multiple layers of date-specific output:

#### `timelineEvents`
Built from:
- cruise itinerary day
- sea day vs port day
- embarkation/disembarkation
- casino availability windows
- imported/local calendar events

#### `agendaItems`
Built from:
- calendar/travel/personal events
- merged cruise bookings

#### `dayScheduleData`
Built from:
- all-day chips
- timed blocks
- overlap layout columns
- total in-port minutes
- total casino-open minutes

#### `opportunePlayingTimes`
Built by intersecting:
- casino open windows
- user preferred playing sessions

This produces “golden time” slots that feed the casino session tracker.

## 24-hour schedule creation details
The schedule system in `day-agenda.tsx` includes these important helpers:
- `parseScheduleTimeToMinutes(...)`
- `clampScheduleRange(...)`
- `formatScheduleTime(...)`
- `formatScheduleTimeRange(...)`
- `layoutDayScheduleCluster(...)`
- `layoutDayScheduleBlocks(...)`

Important behavior:
- supports `MIDNIGHT`, `NOON`, 12-hour text, and 24-hour text
- clamps blocks into a 24-hour day window
- lays out overlapping items into multiple columns
- creates all-day items separately from timed blocks

Timed blocks come from both cruise logic and non-all-day calendar events.

## Daily Luck type model
Defined in `expo/types/daily-luck.ts`.

### Core stored entry
`DailyLuckEntry` contains:
- `dateKey`
- `birthdate`
- `year`
- `generatedAt`
- `source`
- `westernSign`
- `chineseSign`
- `tarotCard`
- `luckNumber`
- `luckScore`
- `scoreBreakdown`
- `readings`

### Source/provider model
Current provider keys:
- `chineseDaily`
- `westernDaily`
- `skyToday`
- `loveDaily`
- `yearlyChinese`

### Analysis response
`DailyLuckAnalysisResponse` includes:
- top-level score/level/confidence
- provider breakdown by source key
- play style
- UI card copy
- plain-English summary

## Daily Luck sign derivation
Defined in `expo/lib/dailyLuck/signs.ts`.

### Western sign
Derived from birth month/day using fixed zodiac ranges.

### Chinese sign
Derived from birth year using a 12-sign array:
- rat
- ox
- tiger
- rabbit
- dragon
- snake
- horse
- goat
- monkey
- rooster
- dog
- pig

## Local fallback Daily Luck generation
Defined in `expo/lib/dailyLuck.ts`.

### Normalization helpers
- `normalizeDate(...)`
- `getDailyLuckDateKey(...)`
- `clampScore(...)`

### Fallback entry creation
`buildLocalDailyLuckEntry(birthdate, selectedDate)`:
1. parses birthdate
2. normalizes storage birthdate
3. derives western sign
4. derives Chinese sign
5. checks for 2026 Earth Rooster override
6. otherwise calculates a fallback luck digit with `getDailyLuckDigitForDate(...)`
7. builds conservative fallback score breakdown and readings

### Fallback reading tone
Fallback synthesis is intentionally conservative:
- higher luck numbers -> supportive but deliberate
- mid-range -> balanced/timing matters
- lower -> cautious/patient/clean choices

## 2026 Earth Rooster override
Defined in `expo/constants/earthRoosterLuck2026.ts`.

Current implementation details:
- hard-coded digit string for all 2026 days
- only applies in year `2026`
- maps digits to:
  - color
  - tone
  - description
- used in two places:
  1. fallback entry generation
  2. stored entry override at retrieval time in `UserProvider`

That means the app can preserve existing stored yearly data while still forcing 2026 Earth Rooster day output on retrieval.

## Yearly Daily Luck generation and storage
Defined in `expo/state/UserProvider.tsx`.

### User profile fields
Current user objects can store:
- `dailyLuckByDate?: Record<string, DailyLuckEntry>`
- `dailyLuckYears?: number[]`
- `dailyLuckLastGeneratedAt?: string`

### Persistence flow
`generateAndPersistDailyLuckYear(userId, birthdate, year)`:
1. dedupes concurrent work via `dailyLuckGenerationRef`
2. calls `generateDailyLuckEntriesForYear(...)`
3. merges entries into the user record
4. stores them in AsyncStorage-backed user data
5. tracks generated years and timestamp

### Year generation details
`generateDailyLuckEntriesForYear(...)` loops through every day in the year and creates a local fallback entry for each date.

### Access helper
`ensureDailyLuckYear(year)`:
- no-ops if no current user
- no-ops if no normalized birthdate
- no-ops if the year already exists and passes transparent-entry checks
- otherwise generates the year

### Retrieval helper
`getDailyLuckEntry(date)`:
- reads from `currentUser.dailyLuckByDate`
- rejects entries that do not pass `hasTransparentDailyLuckEntry(...)`
- applies Earth Rooster 2026 override when relevant

## Important implementation note about persisted sources
The typed model allows `source: 'ai' | 'fallback' | 'live'`.

Current persisted-year generation uses fallback entries.
The live analysis is fetched on demand for the Day Agenda card and does not appear to be the main stored-year generation source.

Also note that `sanitizeDailyLuckMap(...)` in `UserProvider` currently validates persisted entry sources against `ai` and `fallback`, which makes the current stored flow effectively fallback-oriented.

## Live Daily Luck fetch flow
### Frontend query
Defined in `expo/components/DailyLuckReport.tsx`.

The component:
1. builds a fallback entry with `buildLocalDailyLuckEntry(...)`
2. computes `dateKey`
3. derives signs from birthdate
4. runs a React Query request:
   - query key: `['daily-luck-live', dateKey, birthdate, westernSign, chineseSign]`
   - query fn: `fetchLiveDailyLuckAnalysis(...)`

### UI states
`DailyLuckReport` has 4 states:
1. no birthdate -> empty prompt card
2. live loading -> loading card
3. live data -> `DailyLuckExpandedCard`
4. live failure -> fallback card using stored/local entry

### Expanded live card
`DailyLuckExpandedCard.tsx` renders:
- top hero score and confidence
- sign tags
- one card per provider source
- reason/source impact copy
- “open source” action
- plain-English strategy summary

## Current backend “live” analysis implementation
The current backend route is in:
- `expo/report_export/render-backend-v2/src/trpc/app-router.ts`

Important current behavior:
- route: `dailyLuck.getLive`
- provider order is hard-coded as:
  - `chineseDaily`
  - `westernDaily`
  - `skyToday`
  - `loveDaily`
  - `yearlyChinese`
- the backend currently builds a deterministic analysis object from the request seed
- scores are hashed/clamped and summarized into breakdown objects

In other words, the current “live” engine is backend-fetched and real-time from the app’s API route, but the snapshot implementation shown here is deterministic score synthesis rather than a direct third-party horoscope scraper.

## Date and birthdate utilities used by luck
Important helpers in `expo/lib/date.ts`:
- `parseBirthdate(...)`
- `formatBirthdateForStorage(...)`
- `normalizeBirthdateInput(...)`
- `getDailyLuckDigitForDate(...)`
- `getLuckDigitColor(...)`

These utilities handle:
- multiple birthdate formats
- placeholder birthdate rejection
- normalization to storage-safe `MM/DD/YYYY`
- deterministic luck-digit generation
- digit-to-color mapping for the Day Agenda chip

## Rebuild checklist for Day Agenda + Daily Luck
If rebuilding this feature stack, preserve these behaviors:
1. `/day-agenda` must be date-driven, not static.
2. Birthdate must be normalized before luck generation.
3. A full fallback year must be generated and stored per user.
4. Day Agenda must read the stored luck entry first.
5. 2026 Earth Rooster overrides must still apply on retrieval.
6. `DailyLuckReport` must gracefully fall back if live fetch fails.
7. The Day Agenda header must remain simplified to date + `LUCK#` only.
8. Timed blocks must still use overlap-aware layout.
9. Opportune playing times must still be generated from overlaps between casino-open time and preferred sessions.

## Recommended files to preserve in any rebuild
Minimum critical set:
- `expo/app/day-agenda.tsx`
- `expo/state/UserProvider.tsx`
- `expo/lib/dailyLuck.ts`
- `expo/lib/dailyLuck/signs.ts`
- `expo/lib/date.ts`
- `expo/types/daily-luck.ts`
- `expo/constants/earthRoosterLuck2026.ts`
- `expo/components/DailyLuckReport.tsx`
- `expo/components/daily-luck/DailyLuckExpandedCard.tsx`
- `expo/report_export/render-backend-v2/src/trpc/app-router.ts`
