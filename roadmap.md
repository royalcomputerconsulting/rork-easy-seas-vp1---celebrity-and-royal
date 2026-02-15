# Easy Seas / Club Royale App Roadmap

## 1. High-Level Architecture

### Purpose

The app is an Easy Seas / Club Royale point & cruise tracker. It:
- Tracks casino offers, all cruises, and booked cruises.
- Imports data from local files (DATA/*.xlsx/.csv, ICS calendars).
- Computes ROI, comp value, analytics, and anomalies.
- Uses AI (Rork toolkit + tRPC) for search and recommendations.
- Provides a mobile-friendly Expo app that also runs on the web.

### Tech stack

**Frontend**
- React Native with Expo Router.
- Navigation: Stack + Tabs.
- Data fetching: @tanstack/react-query.
- TRPC client for backend calls.
- Styling: StyleSheet + constants/theme.
- Icons: lucide-react-native.
- Storage: AsyncStorage for local "database".

**Backend (in the same repo)**
- Hono HTTP server (backend/hono.ts).
- tRPC (backend/trpc) for typed RPC endpoints.
- File-based storage using lib/storage into the DATA/ directory.

**Runtime & tooling**
- bun as the JS runtime.
- Rork AI toolkit (@rork-ai/toolkit-sdk) for AI text generation.
- Expo dev tooling via bun x rork start ….

### Build / run scripts (top-level package.json)
- `start`: bun x rork start -p <project-id> --tunnel (mobile/Expo).
- `start-web`: bun x rork start -p <project-id> --web --tunnel.
- `start-web-dev`: same as above with DEBUG=expo* for verbose logs.
- `lint`: expo lint.

**Rebuild key point**: the app assumes those scripts and .env entries exist, and that the Hono backend is mounted at /api/trpc via the Expo route in app/api/trpc/[...trpc]+api.ts.

---

## 2. Data & Models

### 2.1 DATA folder (local "database")

/DATA contains real user data that the app can load/use offline:
- `cruises.xlsx`: master cruises list from offers.
- `booked.xlsx`: list of booked or completed cruises.
- `offers.xlsx`: casino offers file (20-column schema).
- `offers.csv`: Has Casino cruises and current pricing and Itinerary and offer information.
- `financials.database.csv`: normalized financial records.
- `calendar.ics`, `tripit.ics`: calendar feeds for events and cruises.
- `PRICEMASTER.csv`: retail pricing & itineraries. (OUTDATED due to pricing being able to be imported via offers.csv)
- `README.md` / `README.txt` explaining how to use local data.
- `Double-Click to Run.command`: helper script to start app locally (Mac).

The import and processing screens are designed to read from and write to these files through AsyncStorage and the backend storage helpers.

### 2.2 Type system (types/models.ts, types/context.ts)

**types/models.ts** defines all core domain objects:

**Cruise**
- Identity: id, ship, sailDate, departurePort, nights.
- Itinerary: itineraryName, ports, destinationRegion.
- Casino context: linked offerCode, roomType, guests, priceInterior/OceanView/Balcony/Suite, taxesFees and day to day port itineraries.
- Status fields: status (available/booked/completed), notes.

**BookedCruise**
- Adds bookingId, reservationNumber, checkInDate, departureDate, returnDate, completion state.
- Links to Cruise id and to financial records.

**CasinoOffer**
- offerCode, offerName, category, perks, offerType (e.g., "2 person" vs "1+discount").
- Trade-in value, FreePlay, OBC.
- Cross-mapping fields that match 20-column offers.csv (shipName, sailingDate, itinerary, roomType, guestsInfo, etc.)
- Expiration fields: expires, offerExpiryDate.

**CalendarEvent**
- title, start, end, sourceType (TripIt, personal, cruise).
- location, notes.
- Used by Calendar and Events tabs.

**FinancialsRecord**
- sourceType (receipt/statement).
- date, amount, category, department, folioOrRef.
- Cruise association, cabin, and normalized categories for analytics.

**Analytics / casino performance**
- CasinoPerformance, EstimatorParams etc. used to compute ROI, cost per point, anomalies.

**types/context.ts** defines shapes for React context values (AppState, Filters, Analytics, etc.).

**Rebuild key point**: these models are the source of truth for every page, filter, and TRPC router.

---

## 3. Backend: Hono + tRPC

### 3.1 Hono app (backend/hono.ts)

Creates a Hono server, attaches:
- CORS middleware (allows Expo/web to call it).
- A path normalizer preventing double /trpc/trpc segments (helps with Render/Expo route quirks).
- trpcServer to serve appRouter at /trpc/*.

Initializes storage via lib/storage:
- Determines DATA directory (Render persistent disk vs local).
- Provides helpers: getDataFilePath, saveDataFile, readDataFile.

Exposes a basic /health route returning app & storage info (used by backend-diagnostic and backend-test screens).

### 3.2 App router (backend/trpc/app-router.ts)

Composes all domain routers:
- `analyticsRouter` (advanced analytics, value scoring, etc.).
- `backupRouter` (snapshots, backups, restore).
- `bookedCruisesRouter` (manipulating booked cruise data).
- `calendarRouter` (import ICS, sync events).
- `casinoOffersRouter` (offer details, value ranking).
- `cruisesRouter` (CRUD, pricing, scraping).
- `financialsRouter` (financial ingestion and analytics).
- `fveRouter` (Full Value Engine tests).
- `importRouter` (bulk import of CSV/XLSX).
- `intelligenceRouter` (booking predictor, offer alerts).
- `ocrRouter` (OCR for flyers, receipts, statements).
- `retailPricingRouter` (retail price lookups from PRICEMASTER.csv).
- `searchRouter` (AI and quick search over all data).

**Rebuild key point**: you can recreate the backend by re-implementing these routers as pure functions over the models. They are stateless on each call, using memoryStore + filesystem as the persistence layer.

### 3.3 Memory store & FS helpers

**backend/trpc/routes/_stores/memory.ts**
- Simple in-memory store keyed by type (cruises, offers, calendar, financials, analytics).
- API: setCruises, getCruises, setOffers, getOffers, clearAllData, etc.
- Used as a cache between requests and for tests.

**backend/trpc/routes/_utils/fsSupport.ts / dataLoader.ts**
- Helpers to locate DATA files relative to process.cwd().
- Provide robust CSV parsing with "never drop rows" semantics.
- Normalize header formats, handle weird line endings and quoted commas.

### 3.4 Major routers and what they do

#### Import router (backend/trpc/routes/import/router.ts)
- `clearBackendData`: wipes memory store.
- `importAllData`: accepts parsed data payload from the Import screen:
  - Offers, cruises, booked, calendar, financials.
  - Normalizes dates (handles YYYYMMDD, ISO strings).
  - Saves them to memory store and/or to disk (via storage helpers).
- `importStartupData`: loads any existing DATA files into memory on startup.

#### Cruises router (backend/trpc/routes/cruises)
- `list`: list all cruises with filters (e.g., ship, dates, status).
- `get`: get one cruise by id.
- `create`: add new cruise records (used by "Add Cruise" or "Book Cruise" screens).
- `update`: update cruise fields (booking id, status, notes).
- `verify-data`: cross-checks the master cruises dataset with retail pricing.
- `fetch-pricing`, `web-pricing`, `fetch-web-pricing`:
  - Call external (retail) pricing endpoints or use PRICEMASTER.csv.
  - Save results for ROI calculations.
- `smart-analysis`: runs advanced analysis (conflicts, overlaps, gaps).
- `launch-scraper`, `royal-caribbean-scraper`, `scrape-data`:
  - Kick off scraper jobs (headless process) for Club Royale offers.
- `points-rewards`: compute predicted points and reward tiers for cruises.
- `itinerary-enrich`: attach detailed ports/times to cruises from pricing master.
- `web-offers`: load offers scraped via Chrome extension into the backend.
- `pricing-progress`, `rollback`: track and rollback pricing fetches.

#### Casino offers router (backend/trpc/routes/casino-offers)
- `calculateOfferValue`: core logic for value of an offer:
  - For each cruise tied to an offer, uses:
    - Room type (Interior/Oceanview/Balcony/Suite).
    - Retail pricing fields (interior/oceanview/balcony/suite prices).
    - Taxes & fees.
  - Computes comp value, discount vs retail, and "coverage fraction" of cabin.
- `getOfferDetails`: fetch full details for one offer, including linked cruises.
- `getOfferRankings`: ranking offers by ROI, comp value, expiration risk.
- `router.ts`: ties these together for the frontend.

#### Analytics router (backend/trpc/routes/analytics)

Submodules:
- `advanced`: multi-dimensional analytics (ROI over time, segments).
- `alerts`: anomalies and suspicious patterns (e.g., negative ROI).
- `benchmarking`: compare cruises to peers.
- `booking-window`: performance vs booking date.
- `cash-flow`: timeline of cash outlay vs expected rewards.
- `casino`: casino-specific stats (points, FreePlay ROI).
- `comprehensive`: "full report" aggregator.
- `cruise-ai`: AI-skewed analytics per cruise.
- `offer-alerts`: analytics view of expiring offers.
- `optimization`: route/offer optimization suggestions.
- `portfolio`: treat cruises as an investment portfolio.
- `predictive`: future trends predictions.
- `value-score`: normalized "value score" per cruise/offer.

These feed the Analytics tab, analytics-dashboard.tsx, advanced-analytics.tsx, and ai-insights.tsx.

#### Financials router (backend/trpc/routes/financials/router.ts)
- Reads financials.database.csv or a combined file.
- Uses normalizers.ts to:
  - Clean category names (casino, dining, spa, etc.).
  - Map statements and receipts into a unified structure.
- Aggregates:
  - Total spend by category.
  - Casino spend vs non-casino.
  - Cruise-level totals (linked via booking id).
- Exposes data for:
  - financials screens.
  - Analytics (ROI, cost per point, anomalies).

#### Calendar router (backend/trpc/routes/calendar/router.ts)
- `import-calendar`:
  - Accepts ICS content (TripIt or generic).
  - Parses into CalendarEvent records.
  - Links events to cruises (same dates / same ship).
- Supports calendar queries: events by date, by cruise.

#### OCR router (backend/trpc/routes/ocr/router.ts) (OCR IS NOT NEEDED ANY LONGER)
- Sub-routes:
  - `offer-flyer`: parse PDF/image offers into structured offers/cruises.
  - `casino-overview`: parse "casino overview" flyer.
  - `receipt` / `batch-receipts`: parse receipts images to financial records.
  - `cruise-statement`: parse on-board statements.
  - `pdf`: generic PDF text extraction.
- Uses memoryStore for intermediate results.
- Exposes debug endpoints like debugFileSystem to inspect DATA directories.

#### Intelligence router (backend/trpc/routes/intelligence/router.ts)
- `offerAlerts`:
  - `getExpiring`: list offers by date (expiring soon).
  - `autoMatch`: match offers to ideal cruises using analytics.
- `bookingPredictor`:
  - `getCruise`: for one cruise, predict best booking window and watch price.
  - `getAll`: system-wide booking predictions.
  - `getPriceDropAlerts`: track price drops vs previous snapshots.

#### Search router (backend/trpc/routes/search/router.ts)
- `aiSearch`:
  - Accepts natural language query (query).
  - Chooses from cruises, booked, offers, calendar.
  - Ranks results by simple text matching and AI scoring.
- `quickSearch`:
  - Filtered search for one type (e.g., cruises or offers only).

#### Backup router (backend/trpc/routes/backup)
- `create`, `list`, `latest`, `restore`, `auto`, `default`:
  - Creates on-disk snapshots of current cruises/offers/booked/financials.
  - Restores previous state.
- Used by backup-manager.tsx and create-full-snapshot.tsx.

#### Retail pricing router (backend/trpc/routes/retail-pricing/route.ts)
- Looks up prices from PRICEMASTER.csv.
- Used by pricing-related screens and fetch-pricing flows.

---

## 4. Global State & Providers (state/)

### 4.1 AppStateProvider
Holds core app state and local data:
- `localData`:
  - cruises, booked, offers, calendarEvents, financials, userProfile.
- Flags: hasLocalData, lastImportDate.
- UI settings: showTaxesInList, showPricePerNight, etc.

Loads and saves a local snapshot via AsyncStorage:
- Keyed by environment (web vs native).

On startup:
- Loads saved snapshot.
- Optionally merges with backend data from memoryStore or DATA.

Provides helpers used across the app:
- updateUserPoints, userPoints.
- cleanExpiredOffers (removes expired offers).
- autoCompletePaidOffers and autoCompletePaidCruises.
- refreshBackendData (calls importStartupData).
- setLocalData / mergeLocalData.

### 4.2 CruiseStoreProvider
Central store for merged cruises:
- Combines local cruises, booked (from AppState) and backend data.

Exposes:
- allCruises, bookedCruises, availableCruises.
- Utility selectors (by ship, by date, by offer, etc.).
- Mutators for updating specific cruises, marking as booked, etc.

Allows front-end screens to use the same canonical list.

### 4.3 FiltersProvider
Holds UI filters used by lists:
- Selected ships, date range, cabin type, destination.
- Text search query.
- Flags: "only available", "only booked", etc.

Shared between Overview, Cruises, Booked, Analytics.

### 4.4 FinancialsProvider
- Holds in-memory normalized financial records.
- Exposes aggregated totals and chart-ready series.
- Synced with the backend financialsRouter.

### 4.5 SimpleAnalyticsProvider
Maintains simplified analytics over cruises/booked:
- ROI per cruise.
- Points per dollar.
- Summary stats per month.

Derived series used by the Analytics tab and charts.

API:
- `useSimpleAnalytics()` returns computed metrics.
- Helpers: calculateCruiseROI, calculateValueScore, calculateRetailValue.

### 4.6 CasinoStrategyProvider
Stores user's casino strategy and target:
- Target tier (e.g., Signature).
- Desired ROI threshold, daily budget.
- Strategy toggles (chase tier vs chase comps).

Used by play-strategy.tsx, casino-analytics.tsx, portfolio-optimizer.tsx.

### 4.7 UserProvider
User profile:
- Name, email, Club Royale tier, Crown & Anchor level.
- Default points (e.g., 3,130 PRIME towards 25,000 target).
- Preferences (units, theme).

### 4.8 CelebrityProvider
Parallel store for Celebrity Cruises data:
- celebrityOffers, celebrityCruises.
- Integrates constants from constants/celebrityOffers.ts, etc.

Used by Blue Chip Club UI and cross-line analytics.

---

## 5. Shared Components (components/)

Key components used across multiple screens:

### HeroHeaderCompact
Top header showing:
- App title / tab title.
- Player summary (Club Royale points, tier).
- Optional background image.
- Accepts title, subtitle, and optional action buttons.

### ClubRoyalePoints
Visual card showing:
- Current Club Royale tier. (Choice, Prime, Signature Masters).
- Current points and progress bar to next tier.
- Can be reused in Overview, Analytics, Settings.

### OfferCard
Pressable card representing one casino offer:
- Background gradient with decorative circles.
- Title: offer name + code.
- Expiration date (with formatted date or "No expiry").
- Trade-in / comp value with a "Trade-In Value" label.
- Shows count of eligible cruises and a short preview of them.

When pressed:
- Calls onPress prop (usually navigates to /offer/[id]).

Internally uses AppState to:
- Show which preview cruises are already booked (with "Booked" mini badge).

### CruiseCard & CruiseUnifiedCard
Cards for cruise display:
- Ship name, dates, nights.
- Itinerary text & ports.
- Cabin type and offer code.
- ROI summary (if analytics available).
- Pressing them typically navigates to /cruise/[id].

### QuickActions
Row of pill buttons (or gradient buttons) for "Jump to…" actions:
- Examples include: Import Data, Financials, Analytics, AI Insights.

### StatCard / PerformanceMetrics / CasinoMetrics
Small cards with:
- Title, numeric value, and short description.
- Used in Overview and Analytics dashboards.

### ShimmerLoading / LoadingState / EmptyState / ErrorState
Visual states for operations:
- Shimmer skeletons while loading.
- Friendly messages for "no data" and errors.

### CertificatesBar / LoyaltyCard / ShipInfoDisplay
- CertificatesBar: shows Next Cruise certificates or FPP certificates.
- LoyaltyCard: Crown & Anchor, Club Royale status. (Gold, Platinum, Emerald, Diamond, Diamond Plus and Pinnacle).
- ShipInfoDisplay: textual info about ships (class, passenger capacity) using constants/shipInfo.ts.

### WelcomeSplash
Full-screen initial splash:
- Branding animation.
- After duration (e.g., 10s), calls onFinish to reveal the app.

### UI primitives (components/ui)
- GradientButton: main CTA button with gradient and label.
- ThemedCard: base container card with shadow and theme.
- Badge: small label for statuses (expiring, booked).
- ProgressBar: for points progress or completion metrics.

---

## 6. Navigation & Screens

### 6.1 Root Layout (app/_layout.tsx)

Wraps entire app in:
- ErrorBoundary.
- QueryClientProvider (React Query).
- trpc.Provider (TRPC client).
- GestureHandlerRootView.
- UserProvider, CruiseStoreProvider, AppStateProvider, SimpleAnalyticsProvider, FinancialsProvider, CasinoStrategyProvider, FiltersProvider, CelebrityProvider.

Defines a Stack navigator with:
- `(tabs)` – the tab layout (main app).
- `import` – import & export screen (modal).
- `cruise/[id]` – detailed cruise view (card-style).
- `offer/[id]` – detailed offer view (card-style).
- `alerts` – alerts modal.
- `settings` – settings modal.
- `ocr` – OCR control panel modal.
- `points-status` – extended points & tier info.
- `blue-chip-club` – Celebrity Blue Chip view.

AppContent:
- Shows WelcomeSplash first.
- After splash, renders RootLayoutNav.

### 6.2 Tabs Layout (app/(tabs)/_layout.tsx)

Defines the bottom tab bar:
- initialRouteName = "(overview)".

Styling:
- On iOS: translucent blurred background over gradient.
- On Android: solid Royal Caribbean blue.
- Floating tab bar, rounded corners, drop shadow.

Visible tabs:
1. `"(overview)"` – Overview
   - Icon: Tag.
   - Title: "Overview".
2. `"(booked)"` – Booked Cruises
   - Icon: Bookmark.
   - Title: "Booked".
3. `"(events)"` – Events
   - Icon: CalendarDays.
   - Title: "Events".
4. `"(analytics)"` – Analytics
   - Icon: BarChart3.
   - Title: "Analytics".
5. `"(settings)"` – Settings
   - Icon: Settings.
   - Title: "Settings".

Hidden tabs (not in bar, but routable):
- `"(cruises)"` – cruises availability planner.
- `"(calendar)"` – year view calendar.

### 6.3 Overview tab (app/(tabs)/(overview)/index.tsx)

**Purpose**: top-level snapshot of offers, cruises, and status.

**Data loading**:
- Reads from useAppState():
  - localData.offers, localData.cruises.
- Uses useCruiseStore() for a canonical cruise list.
- Filters offers to non-expired (based on expiration date).
- Computes:
  - numOffers, numCruises, numBooked.
  - Duplicate offers with different dates (grouped by offer name).

**UI structure**:
- HeroHeaderCompact at top:
  - App name and user's Club Royale points (via ClubRoyalePoints).
- Summary stats section:
  - "Active offers", "Upcoming cruises", "Booked cruises".
  - Displays StatCard style cards.
- Offers list:
  - For each non-expired offer, renders an OfferCard with:
    - offerName, offerCode.
    - Expiration date.
    - Trade-in value and perks (when present).
    - Count of associated cruises (from merged cruises).
  - Button behavior: tapping the card triggers router.push('/offer/[id]') with route params.
- Duplicate offers info:
  - If duplicate groups exist, a collapsible section lists each group and underlying offers, highlighting that multiple offers share the same name but different dates.
- Empty state:
  - If no offers, shows:
    - Tag icon.
    - "No offers found".
    - Message: "Import casino offers data to see available offers."

**Key interactions**:
- Tap OfferCard → go to Offer Details.
- Pull-to-refresh:
  - Uses RefreshControl to call cleanExpiredOffers, ensuring expired offers are removed from local state.

### 6.4 Booked tab (app/(tabs)/(booked)/index.tsx)

**Purpose**: list booked and completed cruises from local data and static sample.

**Data flow**:
- Uses useAppState() to get:
  - localData.booked.
- Uses STATIC_BOOKED_CRUISES as fallback seed if local data empty.
- detectAndMapUnified merges booked entries with cruise master data.

**Logic**:
- Classifies unified cruises into:
  - upcoming, in-progress, completed.
- Detects missing dates (for QA).
- Sorts by departure date.

**UI**:
- HeroHeaderCompact with title "Booked Cruises".
- Summary counts:
  - Number of upcoming, in-progress, completed cruises.
- Filter/search:
  - A text input for filtering by ship/itinerary.
- Booked cruises list:
  - Rendered via CruiseCard or ShipInfoDisplay.
  - Each item shows:
    - Ship, departure date, nights.
    - Itinerary name.
    - Booking id or reservation number.
    - Status indicator (color coded).

**Interactions**:
- Tap a booked cruise → navigate to /cruise/[id].
- Pull-to-refresh to reload from backend and local data.

### 6.5 Cruises tab (app/(tabs)/(cruises)/index.tsx)

**Purpose**: show all cruises, with focus on available cruises that fit schedule and cabin/offer constraints.

**Data**:
- useAppState() and useCruiseStore() to get all cruises.
- STATIC_BOOKED_CRUISES to treat existing bookings as blocked days.
- Filters by:
  - Cabin type (Interior, Oceanview, Balcony, Suite).
  - Date range (roughly next ~180 days).
  - Whether cruise conflicts with booked cruises.

**UI**:
- Header section with view toggle:
  - View mode: "all" vs "available".
- Filter bar:
  - Cabin type chips.
  - "No conflicts" toggle (exclude overlapping with booked).
- Cruise cards:
  - For each cruise, show:
    - Ship, dates, nights, itinerary, cabin type.
    - Tag for whether it is comped or discounted.
    - An indicator if it matches a high-value offer.

**Interactions**:
- Tap cruise card → /cruise/[id].
- Filter chips & view mode toggles recompute the list.
- Pull-to-refresh to refetch from backend.

### 6.6 Calendar tab (app/(tabs)/(calendar)/index.tsx)

**Purpose**: Year view showing availability vs events vs cruises.

**Data**:
- calendarEvents from AppState (imported ICS / TripIt).
- Booked cruises with departure + return dates.
- Uses trpc.calendar to import and sync events when needed.

**UI**:
- Month navigation:
  - Buttons with ChevronLeft and ChevronRight to move across months.
- Week grid:
  - For each week row, shows 7 days.
  - Each day is:
    - Marked if today.
    - Shows icons if there are events or a cruise in progress.
    - isAvailable when no events/cruises (for planning).
- "View alerts" / "Settings" icons in header (Bell, Settings).

**Interactions**:
- Tap day cell → shows details for that day (events + cruises).
- Tap "Settings" icon → go to Settings tab.
- Tap "+" (if present) → navigate to event creation or import screens.

### 6.7 Events tab (app/(tabs)/(events)/index.tsx)

**Purpose**: calendar-like list of ALL events (TripIt, personal, cruise-linked).

**Data**:
- events from memory store via trpc (calendar router).
- Derived metrics:
  - Counts per event type.
  - Events by date.
  - Summary by month/week.

**UI**:
- Toggle of view mode:
  - Week vs Month view, each with its own layout.
- Calendar header with:
  - Current month, ChevronLeft, ChevronRight.
- Events list:
  - Displayed in FlatList or ScrollView.
  - Each event shows:
    - Title, date & time, location.
    - Tags for "Cruise", "TripIt", "Personal".

**Interactions**:
- Tap event → open event details or associated cruise.
- Filter chip "Only cruise events" or similar (via state toggles).
- Refresh control to re-pull events from backend.

### 6.8 Analytics tab

#### 6.8.1 Analytics main (app/(tabs)/(analytics)/index.tsx)

**Purpose**: Core ROI and performance dashboard.

**Data**:
- From useSimpleAnalytics():
  - ROI per cruise.
  - Points vs spend.
  - Value score per cruise (0–100).
- From AppState & CruiseStore:
  - Mapping cruises to offers.
- From TRPC:
  - Additional advanced analytics data if backend available.

**UI**:
- Hero header with ClubRoyalePoints.
- Filters:
  - Search by ship or itinerary.
  - Sorting options (ROI descending, points per day, etc.).
- List of top cruises (via CruiseUnifiedCard):
  - Each card shows:
    - ROI%.
    - Points earned.
    - Retail vs comped value.
- Inline editing for winnings:
  - For each cruise, you can enter winnings and recompute ROI inline.
  - Buttons: "Save" and "Cancel" per row.

**Interactions**:
- Tap cruise card → open detail.
- Tap "Inline edit" button → shows input for winnings, Save/Cancel.
- Search box for filtering.

#### 6.8.2 Analytics charts (app/(tabs)/(analytics)/charts.tsx)
- Uses useSimpleAnalytics() to build time series of ROI.
- Renders multiple simple charts using pure View/Style approximations (bar/line style).
- Shows:
  - ROI per month.
  - Legend and details listing.

**Interactions**:
- Back button in header (ArrowLeft) returns to Analytics main.
- Tapping chart elements is purely visual (no extra interactions).

#### 6.8.3 Analytics intelligence (app/(tabs)/(analytics)/intelligence.tsx)

**Purpose**: "Smart insights" over cruises & points.

**Data**:
- useCruiseEstimator() from lib/cruise-estimator.
- useSimpleAnalytics() to get ROI and anomalies.
- TRPC analytics & intelligence:
  - Offer alerts.
  - Booking predictor information.
- OfferValueInsights component to show best offers.

**UI sections**:
- Points & tier performance:
  - Current points vs target (e.g., 25,000).
  - How many nights and average points per night you achieved.
  - How many points you "should" have based on pattern.
- Anomalies:
  - Cruises with surprising ROI or spend patterns.
- Offer insights:
  - List of top offers with value scores and recommendations.

**Interactions**:
- Text inputs for customizing assumptions (points per night, etc.).
- Buttons to run estimations (internal triggers for provider functions).

### 6.9 Settings tab (app/(tabs)/(settings)/index.tsx)

**Purpose**: Control panel for data, backend, and advanced operations.

**Data & helpers**:
- Uses:
  - useAppState() to clear/refresh local data.
  - useCruiseStore() to access cruises.
  - useUser() to adjust user profile.
  - TRPC for backend diagnostics, backup, and pricing fetch.
  - useQueryClient() to invalidate React Query caches.

**UI sections**:
- Club Royale profile & points:
  - Shows tier and points.
  - May allow editing of points or email.
- Backend & diagnostics:
  - Buttons:
    - "Test Backend" – call a health endpoint.
    - "Run Import Startup" – re-pull data into memory.
    - "Run Pricing Fetch for All Cruises" – triggers cruises.fetch-pricing.
    - "Verify Data" – calls cruises.verify-data.
- Data management:
  - Buttons:
    - "Reset Local Data" – clears AsyncStorage snapshot.
    - "Reload from DATA folder" – merges or replaces local data from DATA/*.xlsx.
    - "Sync with Backend" – ensures memory store is aligned with local.
- Pricing fetch progress:
  - Shows progress bar and counters (current/total/verified).
  - Buttons to cancel or retry.
- WebView embed (for debugging):
  - WebView may show backend responses or external doc in a modal.

**Interactions**:
- Each button triggers an Alert on success/failure.
- Several operations are asynchronous and display ActivityIndicator while running.

### 6.10 Non-tab screens (root app/*.tsx)

#### 6.10.1 Data import & processing

**import.tsx**
- Central UI to load & save:
  - Cruises, Booked, Offers, Offers.CSV (raw), TripIt ICS, Calendar ICS, Financials, User Profile.
- For each row (Cruises/Booked/Offers/…):
  - Buttons: Load, Save.
- Bottom actions:
  - "Save Locally (Offline)" – writes snapshot to AsyncStorage.
  - "Reset / Start Over" – clears.
- Uses Document Picker (web/native) to read file contents and parse into localData.
- Optionally calls trpc.import.importAllData to push into backend.

**process-data-folder.tsx**
- Automation to scan DATA/ and process known files:
  - Build combined master data set.
  - Fill financials.database.csv.
- Buttons: "Process Files", "Show Summary".

**process-financials.tsx, process-receipts.tsx, process-statements.tsx, process-retail-pricing.tsx**
- Specialized workflows to:
  - Parse receipts & statements via OCR.
  - Normalize categories and merge to analytics dataset.
  - Parse PRICEMASTER.csv for pricing & itineraries.

**fix-dates.tsx**
- Utility to standardize date formats across cruises and offers.

**load-date-range.tsx**
- Screen to select date range and load subset of data into local state.

#### 6.10.2 Offers & alerts

**offers.tsx**
- Dedicated list of all offers (similar to Overview but focused).
- Supports filtering by expiration, ship, or category.
- Tapping an offer card → offer/[id].

**offer-alerts.tsx**
- Interface for intelligence.offerAlerts:
  - Shows expiring offers.
  - Suggests auto-matches between offers and cruises.

**alerts.tsx**
- Aggregated alerts view:
  - Price drop alerts.
  - Data anomalies.
  - Expiring offers.
- Each alert is clickable to open the relevant cruise/offer detail.

**top-comp-value.tsx**
- Ranks cruises by comp value for all offers.
- Pulls from casinoOffersRouter and analytics router.

**casino-offers-web.tsx, royal-caribbean-scraper.tsx, club-royale-scraper.tsx, data-scraping.tsx**
- UIs to:
  - Run the Chrome extension / scraper integration.
  - Confirm imported offers from web.
  - Display raw scraped grids and logs.

#### 6.10.3 Cruises detail & booking

**add-cruise.tsx**
- Form to manually create a new cruise record.
- Inputs:
  - Ship, Sail Date, Nights, Itinerary, Cabin type, Offer code.
- On save, inserts into AppState.localData.cruises and memory store.

**book-cruise.tsx**
- Wizard to mark a cruise as booked:
  - Select cruise.
  - Enter bookingId / reservationNumber.
  - Mark status as upcoming/in-progress/completed.

**booking-predictor.tsx & booking-window-predictor.tsx**
- UI for intelligence.bookingPredictor:
  - Show predicted best booking windows, watchlist for price drops.
  - Visual timeline showing when to book vs when prices spike.

**cruise-value-scores.tsx**
- Ranking of cruises by value score (derived from analytics).
- Shows:
  - Score, ROI, risk level.

**smart-recommendations.tsx**
- Suggests a set of cruises to sail to hit a tier/ROI strategy.
- Draws from portfolio analytics and CasinoStrategyProvider.

**ship-info.tsx**
- List of ships with details (from constants/shipInfo.ts).
- Tapping a ship shows capacity, class, and typical itineraries.

**points-status.tsx**
- Detailed view of Club Royale points and tiers:
  - Shows current tier.
  - Points gap to next tier.
  - Cruise-by-cruise contributions.

#### 6.10.4 Financials & receipts

**process-financials.tsx** (already above) – ingestion pipeline.

**financials-related test screens** (see test section).

**receipts-admin.tsx**
- UI to manage parsed receipts:
  - Show list of receipts.
  - Re-run OCR.
  - Fix mis-categorized lines.

**cash-flow-planner.tsx**
- Visualizes out-of-pocket cash flow across cruises and months.
- Uses financials router data.

**roi-calculator.tsx**
- Interactive calculator:
  - Input retail value, comped value, actual spend, winnings.
  - Outputs ROI, cost per point.

#### 6.10.5 AI & Intelligence

**ai-search.tsx**
- Title: "AI-Powered Cruise Search".
- UI:
  - Big text input for natural-language query.
  - "Search" button.
  - Example prompts list ("Try asking: …").
- On search:
  - Calls searchRouter.aiSearch.
  - Displays:
    - AI insights summary text.
    - Data overview: counts of cruises/booked/offers.
    - Result groups by type: Cruise, Booked Cruise, Casino Offer.
    - Each entry shows key fields: ship, itinerary, dates, codes.

**ai-insights.tsx**
- Gets high-level textual insights from analytics:
  - "Which offers are most valuable?"
  - "Which cruises were best/worst ROI?"
- Uses @rork-ai/toolkit-sdk to generate natural language copy.

**agent-x.tsx**
- Composite "control center" for the AGENT X system.
- Buttons/sections to:
  - Run multi-source scraping.
  - Trigger backend intelligence pipelines.
  - View logs and results.

**fve and test-fve.tsx** (see test section)
- FVE: "Full Value Engine".
- Evaluates offer + cruise + pricing data to produce robust value numbers.

#### 6.10.6 Backup & debug

**backup-manager.tsx**
- UI for backup router:
  - List backups.
  - Create new backup.
  - Restore from backup.
  - Show details (timestamp, counts).

**create-full-snapshot.tsx**
- Button to create a comprehensive snapshot:
  - Cruises, offers, booked, financials, calendar.

**download-snapshot.tsx**
- Lets user download snapshot file to their device.

**backend-diagnostic.tsx, backend-test.tsx, connection-diagnostic.tsx, connection-status.tsx, debug-files.tsx**
- Tools to:
  - Hit /health and print diagnostics.
  - Check DATA directory visibility.
  - Confirm TRPC path correctness.
  - Show existence of key files (cruises.xlsx, etc).

**calendar-debug.tsx**
- Debug UI for calendar, tests ICS import and event mapping.

**settings.tsx**
- Additional or earlier version of Settings; likely thin wrapper around the tabbed Settings.

#### 6.10.7 Celebrity / Blue Chip

**blue-chip-club.tsx**
- Focused view for Celebrity Blue Chip Club:
  - Shows Celebrity offers, ships, and rules.
  - Uses CelebrityProvider and constants/celebrity* files.

**connect-club-royale.tsx**
- Guides user on connecting to Club Royale accounts / scraping flows.

#### 6.10.8 Misc / entry

**index.tsx** – redirects to /(tabs)/(overview).

**+not-found.tsx** – standard 404 for unknown routes.

**unlinked.tsx** – inspection page for data that is not yet linked (e.g., cruises with no offers, offers with no cruises).

### 6.11 Test & QA screens (app/test-*.tsx)

All of these are developer/QA utilities:
- **test-backend.tsx**: hit multiple backend routes to confirm they respond.
- **test-startup.tsx**: simulate startup logic, import startup data, and show logs.
- **test-persistence.tsx**: verify AsyncStorage save/load.
- **test-calendar.tsx and test-calendar-debug.tsx**: quickly exercise calendar router and UI.
- **test-events-backend.tsx, test-events-debug.tsx, test-events-flow.tsx, test-events-status.tsx**:
  - Step through event import, status updates, and linking with cruises.
- **test-financials.tsx, test-financials-backend.tsx, test-financials-simple.tsx**:
  - Validate financials normalization, merging, and analytics.
- **test-web-pricing.tsx, test-real-pricing.tsx, test-fetch-pricing-button.tsx**:
  - Exercise retail pricing lookups, PRICEMASTER usage, and UI buttons.
- **test-casino-strategy.tsx**: confirm CasinoStrategyProvider logic and UI.
- **test-data.tsx**: generic test loader for sample data.
- **test-multi-source-scraper.tsx**: integrates multiple scraping sources and shows merged results.
- **test-points-system.tsx**: verify points tracking and ROI calculations.
- **test-fve.tsx**: unit-like tests for FVE router.

Each test page typically:
- Has a simple header.
- A few buttons like "Run Test", "Load Data", "Dump State".
- Renders raw JSON or simple textual output.

---

## 7. Library Modules (lib/)

**lib/trpc.ts**
- Configures TRPC client with base URL /api/trpc.
- Exposes trpc hooks (useQuery, useMutation) used across screens.
- isBackendEnabled flag to gracefully fall back to pure local mode.

**lib/date.ts**
- Helpers like createDateFromString to parse flexible date formats.
- Used widely in AppState and Booked/Cruises screens.

**lib/unifiedCruise.ts**
- detectAndMapUnified merges:
  - Cruise row, booked entry, offer row, and pricing row into a unified view.
- Used in Booked screen, Cruises screen, and analytics.

**lib/analytics.ts**
- Combines data from SimpleAnalyticsProvider and backend analytics router.
- useMergedAnalytics hook for screens like Analytics main and dashboard.

**lib/import.ts**
- Parsing logic for CSV/XLSX imports.
- Infers column names, normalizes header rows.

**lib/sheets.ts**
- Utility for reading/writing sheets using xlsx.

**lib/storage.ts**
- Storage config for Hono backend (discussed above).

**lib/cruise-estimator.ts**
- Estimates expected points, ROI, and comp values based on:
  - Nights.
  - Past earning patterns.
  - Room category and offer type.

**lib/offerMatching.ts**
- Match logic between offers and cruises.
- Used by intelligence and UI to show how many cruises match a given offer.

**lib/retailEstimator.ts**
- Estimates retail value and cabin costs; integrated into ROI calculators.

**lib/fveEvents.ts, lib/fveUtils.ts**
- Helpers for FVE (Full Value Engine) logic, centralizing value calculations and event logging.

**lib/webOffers**
- Helper to integrate with web-scraped offers from your Chrome extension.

**lib/scraper/***
- excel.ts, extract.ts, injection.js, injection-enhanced.js:
  - Provide the scaffolding for injecting scripts into Club Royale pages, then extracting offers into structured data.

---

## 8. Constants (constants/)

- **theme.ts**: colors, typography, border radius, shadows.
- **shipInfo.ts**: data on ships and classes.
- **offers.ts**: static offer sample definitions.
- **cruiseData.ts**: sample cruise data for fallback.
- **clubRoyaleTiers.ts**: Club Royale tier ladder, thresholds.
- **crownAnchor.ts**: Crown & Anchor levels and rules.
- **financials.ts**: category names, grouping sets.
- **blueChipClub.ts, celebrity***: Celebrity Blue Chip Club constants.

These constants are used throughout headers, analytics summaries, and UI labels.

---

## 9. How to Rebuild the App Piece by Piece

If you handed this spec to a new engineer, the rebuild sequence would look like:

### 1. Foundation
- Create a new Expo app with Expo Router.
- Install core deps: React Native, Expo, React Query, TRPC, lucide-react-native, AsyncStorage.
- Recreate constants/theme and basic ThemedCard, GradientButton, HeroHeaderCompact, and ClubRoyalePoints.

### 2. Models & State
- Implement the models described in types/models.ts.
- Implement AppStateProvider with:
  - localData snapshot structure.
  - AsyncStorage load/save.
- Implement CruiseStoreProvider, SimpleAnalyticsProvider, FinancialsProvider, CasinoStrategyProvider, UserProvider, FiltersProvider, CelebrityProvider.

### 3. Backend
- Create Hono app:
  - Storage initialization, /health endpoint.
  - TRPC server bound to /trpc/*.
- Implement memoryStore and fsSupport utils.
- Recreate TRPC routers:
  - importRouter (import data).
  - cruisesRouter, casinoOffersRouter, analyticsRouter, financialsRouter.
  - calendarRouter, ocrRouter, intelligenceRouter, searchRouter, backupRouter, retailPricingRouter.
- Wire them into appRouter.

### 4. Front-end infrastructure
- Implement lib/trpc client.
- Implement lib/date, lib/unifiedCruise, lib/analytics, lib/cruise-estimator, lib/offerMatching.

### 5. Navigation
- Implement app/_layout.tsx:
  - Wrap providers.
  - Configure Stack screens: (tabs), import, cruise/[id], offer/[id], alerts, settings, ocr, points-status, blue-chip-club.
- Implement tab layout in app/(tabs)/_layout.tsx:
  - Tabs: (overview), (booked), (events), (analytics), (settings).

### 6. Core screens
- Build Overview screen using OfferCard and StatCards.
- Build Booked screen using CruiseCard and unified cruises.
- Build Cruises screen with filtering and availability logic.
- Build Events screen using calendar events.
- Build Calendar screen with year/week grid.
- Build Analytics main, AnalyticsCharts, and AnalyticsIntelligence.
- Build Settings with buttons wired to TRPC and AppState helpers.
- Build Import screen with file picker and localData wiring.

### 7. Secondary and advanced screens
- Implement:
  - Offers list, Offer Alerts, Top Comp Value.
  - Booking predictor and Smart Recommendations.
  - Financials processing and ROI calculator.
  - Blue Chip and ship info.
- Each uses the previously built providers and routers.

### 8. Testing & QA screens
- Recreate test-* screens as thin wrappers around TRPC calls and provider actions, so you can validate each module in isolation.

### 9. Data integration
- Reintroduce the DATA directory and make sure:
  - importStartupData loads from DATA/cruises.xlsx, offers.xlsx, and most importantly, Offers.csv.
  - Financials pipelines use offers.csv (Interior Price, Oceanview Price, Balcony Price, Suite Price, Port Taxes & fees)
  - Pricing pipelines use offers.csv.

---

## 10. UI/UX Reference Screenshots

The following screenshots from the original Easy Seas app serve as design reference:

### Settings Tab
1. **Settings Form** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/cv5pxs5yl6mrf9zkv563v
   - Form fields: Name, Crown & Anchor #, Club Royale Points, Loyalty Points
   - Action buttons grid: Save, Load, Pricing, Backend, Status, Clear

2. **User Management Section** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/z0ar3jm336uxxgwzfkbj1
   - Reset Account button (orange)
   - User Profile display showing current values (Name, C&A #, Club Royale Points/Tier, Loyalty Points, Crown & Anchor Level)
   - Form inputs below

3. **Settings with Branding Header** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4a86w85g6kgf91gdfkcg0
   - Easy Seas logo and branding card with PRIME and DIAMOND PLUS badges
   - Data Overview stats (cruises, booked, offers, events)
   - Data Actions: Import, CR Points, Verify

### Analytics Tab
4. **Portfolio Performance** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/qiahdmc9x28zrq7yw75lf
   - Top metrics: Coin-In ($103,600), Actual Risk ($1,619.61), Risk Multiplier (64.0x)
   - Cruise Portfolio with filter tabs (All, High ROI, Medium ROI, Low ROI)
   - Filter dropdowns: Ship, Date, Sort
   - Cruise cards showing ROI% (2570%, 1976%), Points, Paid, Retail, $/Pt

5. **Progress & Agent X Analysis** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/ugvybjq2m4ie5s5s6230x
   - Progress to Pinnacle (61.1% complete, ETA: Apr 26, 2026)
   - Progress to Signature Tier (82.9% complete, ETA: Jan 14, 2026)
   - Quick action buttons: Agent X, Intelligence, Charts
   - Agent X Analysis card with AI-generated cruise assessment

6. **Analytics Overview** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/2tu2ikfu7m9lec0guob10
   - Easy Seas branding header with PRIME and DIAMOND PLUS badges
   - Stats grid: Total Cruises (14), Total Points (20,720), Portfolio ROI (0%), Total Savings (26,715)
   - Total $ Spent on Cruises (1,620), Total $ Spent in Port Taxes (1,610)
   - Player and Loyalty Status section with PRIME/DIAMOND PLUS buttons
   - Nights to Pinnacle (136), Nights to Signature (17)

### Events Tab
7. **Calendar Month View** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/fkfd2yiwpxe5x4w0wg21n
   - Easy Seas header with branding
   - View toggle: Events, Week, Month, 90 Days
   - November 2025 calendar grid with color-coded event indicators
   - Legend: Cruise (23), Travel (255), Personal (357)
   - Days highlighted in different colors based on event type

### Booked Tab
8. **Booked Cruises List** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/59k7eq1vn4cjuvvl48mqa
   - Easy Seas header
   - Stats: Upcoming (10), Completed (12), With Data (9), Total (22)
   - Action buttons: Refresh, Hide, Clear Filters, Sort
   - Search input
   - Sort chip: "Oldest First"
   - Cruise card showing ship image, dates, ports, reservation number

### Scheduling Tab
9. **Available Cruises** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0xpnyakdwjly89il97e7r
   - Easy Seas header with badges
   - Tab toggle: Available, All, Booked, For You
   - Action buttons: Filter, Clear Filters, CR Points, Alerts (with badge)
   - Search input
   - Stats: showing, total, booked counts
   - Empty state with ship icon and "No Cruises Found" message

### Offers Tab
10. **Progress & Certificates** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/5wrpebh8dz37u7cg7zm9u
    - Progress to Pinnacle with progress bar and ETA
    - Progress to Signature Tier with progress bar and ETA
    - Current total points and available cruises
    - Total Certificates section
    - Casino & Certificates card with Manage button
    - CASINO OFFERS section with empty state

11. **Player and Loyalty Status** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/kun6oybofao7pudju7tb7
    - Easy Seas branding header
    - Player and Loyalty Status with PRIME/DIAMOND PLUS toggle
    - Nights to Pinnacle (136), Nights to Signature (17)
    - Progress bars with ETA dates
    - Current total and available cruises
    - Total Certificates section

### Splash Screen
12. **Welcome Splash** - https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/mivgqqfhiza3odg09vjtk
    - Blue gradient background
    - Easy Seas mascot logo (ship character with "COMPS" sail)
    - Tagline: "Manage your Nautical Lifestyle"
    - Copyright: "© 2025 Royal Computer Consulting, LLC"

### Design System Notes from Screenshots

**Color Palette:**
- Primary Blue: Royal Caribbean blue (#003366 / #1a365d range)
- Accent Teal: #14B8A6 (for positive metrics like ROI%)
- Warning Orange: For reset/destructive actions
- Light backgrounds: Cream/off-white (#FFF8DC / #FFFEF0 range)
- Card backgrounds: Light blue tints

**Typography:**
- Bold headers for section titles
- Large numbers for key metrics
- Smaller labels below metrics

**Components:**
- Rounded cards with shadows
- Progress bars with percentage and ETA
- Toggle button groups (tabs)
- Icon + label action buttons
- Badge pills (PRIME, DIAMOND PLUS)
- Stats grids (2x2 or 3x1 layouts)

**Tab Bar:**
- 6 tabs: Offers, Scheduling, Booked, Events, Analytics, Settings
- Icons from lucide-react-native
- Navy blue background with white icons

---

## 11. Clean & Modern UX Roadmap (Updated Nov 27 2025)

### Audit Highlights
- Visual language is inconsistent (Overview dark navy, Booked teal, Scheduling blue-green) which erodes brand recognition and creates contrast problems on light text backgrounds.
- Data-dense cards (OfferCard vs CruiseCard) diverge in spacing, typography, and affordances even though they present similar information, making the flow feel fragmented.
- Filter systems differ per tab, so users relearn controls when switching between Overview, Booked, and Scheduling.
- Analytics loads heavy content at once, causing long scrolls and no prioritization of insights, while Predictive sections are buried behind manual toggles.
- Events tab mixes four view modes without progressive disclosure, so first paint feels overwhelming on small screens.
- Settings tries to be command center + vault; destructive actions are too close to routine import/export tasks, and data persistence expectations are unclear.

### Phase 1 · Foundation & Persistence (Week 1)
1. **Persisted session restore**: extend `AppStateProvider` snapshot to include cruises, booked, offers, events, and last-import metadata so cold starts restore prior state without user action.
2. **Theme contract**: formalize light + deep-sea palette in `constants/theme.ts` (surface, card, accent, warning) and refactor shared components to consume tokens.
3. **Layout primitives**: introduce spacing + typography helpers (stack, grid, label/value) so OfferCard, CruiseCard, StatCard, and Settings rows share the same rhythm.
4. **Action system**: convert primary CTAs to `AnimatedActionButton` with consistent iconography and add haptic/tint fallback for web vs native behavior.

### Phase 2 · Tab Modernization (Weeks 2‑3)
#### Overview
- Rebuild header into split layout: left = loyalty stack (player status, certificates), right = carousel for key KPIs (Active Offers, Upcoming Sailings, Alerts).
- Replace stacked CollapsibleSection usage with masonry cards so Agent X, Certificates, and Offers feel part of one dashboard.
- Promote “Next Sailings” micro-list to highlight top three upcoming cruises with conflict badges.

#### Booked
- Unify background with Overview, switching to parchment gradient, and surface timeline/list toggle as segmented control with animated indicator.
- Add contextual chips (Cabin, ROI, Offer Code) inside CruiseCard to reduce reliance on modal navigation.
- Surface predictive completion stats (points, cash, nights) above filter bar to encourage analytics tie-in.

#### Scheduling
- Move advanced filters into slide-up sheet triggered by Filters button; keep only search + tab toggle inline.
- Introduce “conflict heatmap” ribbon summarizing booked overlaps and convert recommendations list into swipeable cards with quick actions (hold, book, compare).
- Align OfferCard visuals with CruiseCard (shared gradient + iconography) per previous request.

#### Analytics
- Split into three accordion buckets: “Snapshot” (top KPIs + CasinoMetricsCard), “Predictive” (What-If + ROI Projection), “Portfolio” (filterable list).
- Lazy-load charts using Suspense-friendly placeholders; add mini tabs for ROI filter that mirror Scheduling chips.
- Highlight data verification status (coin-in totals vs inputs) to tackle earlier casino performance accuracy concerns.

#### Events
- Default to “Week” view with hero summary; tuck Month/90-day heatmap behind tabs.
- Add floating “Add/Import” button with contextual icon (calendar vs TripIt) and show occupancy bars on day cells instead of dots for better density comprehension.
- Introduce empty-state narratives tailored per view.

#### Settings
- Reorder into “Profile”, “Data Hub”, “Automation”, “Danger Zone”; fence destructive actions with confirmation sheet that reiterates persistence impact.
- Clarify onboarding by surfacing last import timestamps and syncing AppState snapshot to show when data will auto-restore.
- Offer quick links to Agent X configuration and predictive scoring settings.

### Phase 3 · Motion, Testing, and Rollout (Week 4)
1. Add subtle animations (fade/scale) to card mounts and tab transitions using React Native Animated (web-safe) with `useReducedMotion` fallback.
2. Implement automated visual regression via story-driven screenshots for core cards (Offer, Cruise, Stat) to prevent future drift.
3. Run usability smoke tests: ensure nav from dashboard to detail takes ≤2 taps, verify filters persist per tab, and confirm cold-start loads previous data snapshot.
4. Document component guidelines (no-code) in ROADMAP to keep future contributions aligned.

### Success Criteria
- 90% of reusable components consume the unified theme tokens.
- Returning users see previously imported cruises/offers/events without re-importing.
- Offer and Cruise cards share identical spacing, typography, and iconography, satisfying the “match visuals” directive.
- Analytics tab renders first meaningful paint in <1.5s on modern devices thanks to progressive loading.
- Events tab toggles stay under 2 rows of UI chrome, eliminating scroll-before-content on small phones.
- Settings clearly distinguishes safe actions from destructive ones, reducing accidental wipes.
