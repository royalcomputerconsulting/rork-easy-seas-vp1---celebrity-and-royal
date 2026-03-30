# Easy Seas App Rebuild Spec

## 1. Product Summary

Easy Seas is a cross-platform Expo app for cruise casino players. It combines:

- cruise offer tracking
- booked cruise management
- cruise calendar + agenda views
- casino analytics and ROI/value calculations
- slot machine atlas + machine encyclopedia
- loyalty/tier tracking
- browser-assisted sync flows for Royal Caribbean, Celebrity, and Carnival
- crew recognition tracking
- import/export and cloud backup flows
- RevenueCat-based subscription paywalls

The app is designed as a single authenticated experience around one user identity, with most data scoped by authenticated email and persisted locally with optional cloud sync.

Primary project root for the mobile app: `expo/`

## 2. Tech Stack

### Core

- Expo Router for file-based navigation
- React Native + Expo SDK 54
- TypeScript
- React Query + tRPC for network layer
- AsyncStorage for local persistence
- RevenueCat (`react-native-purchases`) for monetization
- Expo Linear Gradient, Expo Haptics, Expo File System, Expo Sharing, Expo Web Browser
- `lucide-react-native` for icons

### Key architecture files

- App shell: `expo/app/_layout.tsx`
- Tab shell: `expo/app/(tabs)/_layout.tsx`
- Nested offers stack: `expo/app/(tabs)/(overview)/_layout.tsx`
- Main data store: `expo/state/CoreDataProvider.tsx`
- Auth: `expo/state/AuthProvider.tsx`
- Cloud sync: `expo/state/UserDataSyncProvider.tsx`
- Entitlements: `expo/state/EntitlementProvider.tsx`
- tRPC client: `expo/lib/trpc.ts`
- tRPC server router: `expo/backend/trpc/app-router.ts`
- Design tokens: `expo/constants/theme.ts`
- Core models: `expo/types/models.ts`

## 3. App Shell and Boot Sequence

Source: `expo/app/_layout.tsx`

Boot order and global behavior:

1. Prevent splash auto-hide.
2. Load Lobster font.
3. Create a single React Query client.
4. Compose providers.
5. Run auth/bootstrap/fresh-start/cloud-restore logic.
6. Mount `RootLayoutNav` inside the provider tree.
7. Wrap app with `GestureHandlerRootView` and custom `ErrorBoundary`.
8. On web, use a responsive phone-frame wrapper when viewport is wide.

### Root stack routes registered in `_layout.tsx`

- `(tabs)`
- `paywall`
- `paywall-monthly`
- `modal`
- `day-agenda`
- `offer-details`
- `add-machine-wizard`
- `add-machines-to-ship`
- `deck-plan`
- `global-library`
- `machine-detail/[id]`
- `edit-machine/[id]`
- `pricing-summary`
- `import-cruises`
- `royal-caribbean-sync`
- `carnival-sync`

Presentation styles:

- paywalls and many tools open as bottom-sheet/modal style screens
- `offer-details` is a modal
- `machine-detail/[id]` is a full page outside tabs
- `(tabs)` owns the main application experience

## 4. Navigation Map

### Bottom tabs

Source: `expo/app/(tabs)/_layout.tsx`

Tabs in order:

1. Offers → `/(tabs)/(overview)`
2. Cruises → `/(tabs)/scheduling`
3. Booked → `/(tabs)/booked`
4. Calendar → `/(tabs)/events`
5. Casino → `/(tabs)/analytics`
6. Slots → `/(tabs)/machines`
7. Settings → `/(tabs)/settings`

Behavior:

- tabs trigger haptic feedback on native
- labels and icons are always shown
- header is hidden at tab level
- bottom tab bar is custom styled but still Expo Tabs based

### Nested overview stack

Source: `expo/app/(tabs)/(overview)/_layout.tsx`

Routes:

- `index` (Offers overview tab root)
- `cruise-details` (push screen inside overview stack)

### Important navigation flows

#### Offers flow

- Offers tab root: `expo/app/(tabs)/(overview)/index.tsx`
- Tap grouped offer → `expo/app/offer-details.tsx`
- Tap cruise inside offer detail → `expo/app/(tabs)/(overview)/cruise-details.tsx`

#### Cruise browsing flow

- Cruises tab: `expo/app/(tabs)/scheduling.tsx`
- Tap cruise card → `cruise-details`
- Back-to-back suggestions exist inside Cruises tab

#### Booked flow

- Booked tab: `expo/app/(tabs)/booked.tsx`
- Tap booked cruise → `cruise-details`
- Can add booked cruise manually via modal

#### Calendar flow

- Calendar tab: `expo/app/(tabs)/events.tsx`
- Tap day → `expo/app/day-agenda.tsx`
- Cruise events in calendar are composed from booked cruises + imported calendar events

#### Slots flow

- Slots tab: `expo/app/(tabs)/machines.tsx`
- Tap atlas card → `expo/app/machine-detail/[id].tsx`
- Can edit notes via `expo/app/edit-machine/[id].tsx`
- Can open global library, add-machine wizard, add-machines-to-ship, deck plan

#### Sync/import flow

- Settings can import CSV/ICS and manage feed publishing
- `import-cruises` supports pricing sync and feed publishing
- `royal-caribbean-sync` and `carnival-sync` manage browser-assisted sync workflows

#### Monetization flow

- gated screens/features can launch `paywall` or `paywall-monthly`
- RevenueCat restore/manage links available from paywalls

## 5. Screen-by-Screen Spec

## 5.1 Offers Tab

File: `expo/app/(tabs)/(overview)/index.tsx`

Purpose:

- dashboard/home for active casino offers
- groups offers by `offerCode`
- merges cruise and offer data
- highlights expiring offers, total value, certificate status, AI analysis, alerts, and machine strategy content

Primary data dependencies:

- `useCoreData()` for cruises, booked cruises, offers, club royale profile
- `useUser()` current user
- `useAuth()` logout
- `useAgentX()` AI/chat analysis state
- `useAlerts()` alert summary
- `useCertificates()` certificate inventory

Major UI sections:

- branded dashboard header (`CompactDashboardHeader`)
- grouped casino offer cards (`CasinoOfferCard`, `OfferSummaryCard`)
- certificate section (`CasinoCertificatesCard`)
- AI analysis cards (`AgentXAnalysisCard`, `AgentXChat`)
- alerts modal (`AlertsManagerModal`)
- machine strategy section (`MachineStrategyCard`)
- floating quick actions button (`QuickActionsFAB`)

Main logic:

- deduplicate and group offers
- ignore expired / used / booked offers in overview list
- attach cruises to grouped offer buckets
- calculate portfolio-style total value summary using `valueCalculator`
- route to `offer-details` or `cruise-details`

## 5.2 Offer Detail Modal

File: `expo/app/offer-details.tsx`

Purpose:

- deep detail for a grouped casino offer
- display aggregate offer value, perks, expiry, cruises, pricing bands, and status actions

Primary data:

- `useLocalSearchParams()` → `offerCode`
- `useAppState()` local merged data fallback
- `useCoreData()` cruises, booked cruises, offers, update/remove offer methods
- `useUser()` playing-hours personalization
- casino availability + personalized play estimate helpers

Major UI sections:

- premium offer header shell with offer name, code, total value, expiry, cruise count
- free play / OBC badges
- sort controls
- list of cruises attached to the offer
- per-cruise casino days / estimated points / golden hours / retail value snapshots
- offer status actions:
  - mark in progress
  - mark as used

Key behaviors:

- enrich cruises with pricing copied from linked offer if cruise pricing is missing
- calculates aggregate total value across all cruises under the offer
- marks offer as booked or used in core data store
- tapping a cruise navigates to `cruise-details`

## 5.3 Cruise Details

File: `expo/app/(tabs)/(overview)/cruise-details.tsx`

Purpose:

- the main cruise deep-link detail page shared from Offers, Cruises, Booked, Calendar, and Analytics

Primary data:

- route param: `id`
- `useAppState()` local data fallback
- `useCoreData()` booked cruises, cruises, offers, mutation methods
- `useSimpleAnalytics()` value breakdown + casino availability
- `useUser()` for playing-hours personalization

Major UI sections:

- hero image header with action buttons
- cruise identity header (ship, itinerary, offer name/code, countdown)
- quick facts rows
- booked-only booking details shell
- pricing category cards for interior/oceanview/balcony/suite/taxes
- receipt/BWO/freeplay/OBC card
- booked-only casino results card (winnings + points)
- special offers & perks shell
- raw booking payload shell for imported booking data
- itinerary & casino shell
- value summary shell with net value and coverage bar
- edit casino stats modal
- full edit modal for cruise fields
- unbook confirmation modal

Key behaviors:

- merges booked + available cruise records and local/store sources
- enriches cruise pricing from linked offer if missing
- resolves itinerary from multiple possible sources in priority order
- computes accurate nights from sail/return dates
- lets user book an available cruise into booked store
- lets user unbook/delete a booked cruise
- edits imported or manual data directly in the main store

## 5.4 Cruises Tab

File: `expo/app/(tabs)/scheduling.tsx`

Purpose:

- browse available cruises and booked cruises
- filter by cabin type, ship, conflicts, search
- show special “Back 2 Back” recommendation view

Primary data:

- `useAppState()` local cruises/offers/profile
- `useCoreData()` booked cruises
- `useAgentX()` AI assistant
- recommendation engine + back-to-back finder

Tabs inside screen:

- available
- all
- foryou (Back 2 Back)
- booked

Key behaviors:

- conflict detection by comparing date spans against booked cruise spans
- enriches cruise records from matching offers
- supports ship filter modal and advanced filters modal
- opens cruise details on selection
- includes favorite staterooms section

## 5.5 Booked Tab

File: `expo/app/(tabs)/booked.tsx`

Purpose:

- manage booked and completed cruises
- provide portfolio and loyalty-centric booked experience

Views and controls:

- filter: all / upcoming / completed / celebrity
- sort: next, newest, oldest, ship, nights
- view mode: list / timeline / points
- manual add booked cruise modal

Primary data:

- `useAppState()` local booked data and refresh
- `useCoreData()` booked store + add method
- `useSimpleAnalytics()` casino analytics
- `useLoyalty()` loyalty balances/tier
- `calculatePortfolioValue()`

Major UI sections:

- metrics cards (upcoming, completed, totals, spend)
- casino stats / profit summary
- next cruise highlight
- booked cruise list cards
- crown & anchor timeline component

## 5.6 Calendar Tab

File: `expo/app/(tabs)/events.tsx`

Purpose:

- month/week/events/90-day calendar view
- combines imported calendar events with booked cruise spans
- overlays “luck” scoring and personalized luck indicators

Primary data:

- `useAppState()` calendar and tripit events
- `useCoreData()` booked cruises
- `useLoyalty()` current tiers
- `useUser()` birthdate and personal profile
- `getLuckForDate()` and `getPersonalizedLuckForDate()`

Major UI features:

- month navigation
- event counting by type: cruise, travel, personal
- color-coded day cells
- calendar event aggregation by day
- day agenda deep link
- crew recognition section
- time zone converter

Important rule:

- booked cruises are treated as calendar spans even if no explicit calendar event exists

## 5.7 Day Agenda Screen

File: `expo/app/day-agenda.tsx`

Purpose:

- detailed day timeline for a single date
- merges cruise-day context with regular calendar events and casino opportunities

Primary data:

- route param: `date`
- booked cruises + local calendar events
- current user playing hours
- casino sessions for the day
- luck calculator and casino day context helpers

Major UI sections:

- selected day header
- merged cruise booking cards for same ship/date
- agenda/timeline entries
- casino opening opportunities and day-type context
- casino session tracker + add session modal
- crew recognition and time zone widgets

## 5.8 Casino Analytics Tab

File: `expo/app/(tabs)/analytics.tsx`

Purpose:

- advanced casino intelligence, ROI, session, tax, and goal tracking hub

Primary data:

- `useSimpleAnalytics()` analytics + casino analytics
- `useAlerts()` alerts and insights
- `useCoreData()` booked cruises
- `useLoyalty()` tier/points balances
- `useCasinoSessions()` session logging
- `useGamification()` streaks/achievements
- `usePPHAlerts()` points-per-hour alerts
- `useTax()` W2G + comp items
- `whatIfSimulator` helpers

Internal sub-tabs:

- intelligence
- charts
- session
- calcs

Major UI modules:

- alerts card
- casino metrics card
- casino session tracker
- casino intelligence card
- gamification card
- PPH cards/charts/leaderboard/comparison/history
- W2G tracker
- comp value calculator
- sessions summary
- tier progression / ROI / risk charts

Key behaviors:

- computes ROI for completed cruises only
- supports adding/removing sessions and generating historical sessions
- can celebrate achievements via overlay
- exports/visualizes price and value intelligence

## 5.9 Slots Tab

File: `expo/app/(tabs)/machines.tsx`

Purpose:

- slot machine atlas for the user
- search, favorites, quick exports, alphabet rail navigation, session rollup

Primary data:

- `useSlotMachineLibrary()` atlas machines, favorites, index load, reload
- `useCasinoSessions()` session history

Major UI sections:

- branded logo header
- atlas title card
- collapsible slot play sessions summary
- search bar
- filter chips (all, favorites, clear)
- grid of `AtlasCard`
- custom alphabet rail + draggable scroll thumb
- edit session modal and quick session modal

Key behaviors:

- supports favorites export and full atlas DOCX export
- scroll-to-letter behavior using `PanResponder`
- opens machine detail page on card tap

## 5.10 Machine Detail

File: `expo/app/machine-detail/[id].tsx`

Purpose:

- deep detail for one slot machine
- lazy-enriches machine with global full details if needed

Primary data:

- `useSlotMachineLibrary()` get machine by id, fetch full details, update machine, add from global
- `useCasinoSessions()` sessions by machine + quick win logging

Major UI sections:

- title/manufacturer header
- basic info, RTP, mechanics, jackpot, denomination, AP sections
- recent wins and session intelligence
- quick win modal
- export machine to DOCX

Key behaviors:

- caches fetched full machine detail into local atlas entry
- can add machine from global to user atlas

## 5.11 Edit Machine

File: `expo/app/edit-machine/[id].tsx`

Purpose:

- edit user notes only for a machine

Fields:

- multi-line notes text area

## 5.12 Global Library

File: `expo/app/global-library.tsx`

Purpose:

- browse global machine encyclopedia
- search, filter, sort, and add machines into the user atlas

Key behaviors:

- uses `useSlotMachineFilters()`
- lets user inspect machine or add to atlas directly

## 5.13 Add Machine Wizard

File: `expo/app/add-machine-wizard.tsx`

Purpose:

- 3-step machine add flow

Steps:

1. choose source (global/manual)
2. select global machine or enter manual fields
3. finalize and navigate to machine detail

Uses `wizardData` in `SlotMachineLibraryProvider`.

## 5.14 Add Machines to Ship

File: `expo/app/add-machines-to-ship.tsx`

Purpose:

- bulk map machines to a selected ship/deck plan

Key behaviors:

- pick ship from booked cruise ships
- filter machine library
- multi-select machines
- create `MachineDeckMapping` records in `DeckPlanProvider`

## 5.15 Deck Plan

File: `expo/app/deck-plan.tsx`

Purpose:

- visualize casino deck plans for a selected ship
- jump from a slot location to machine detail

Primary data:

- `useDeckPlan()` for ship plan, zones, mappings, occupancy
- `useSlotMachineLibrary()` for machine lookup

## 5.16 Settings Tab

File: `expo/app/(tabs)/settings.tsx`

Purpose:

- central operations hub
- profile editing, display preferences, notifications, data import/export, sync utilities, feed publishing, admin tools

Primary data and services:

- `useAppState()` settings and local data façade
- `useCoreData()` full domain store
- `useUser()` profile + playing hours
- `useLoyalty()` loyalty values and manual overrides
- `useAuth()` whitelist/admin/email management
- `useSlotMachineLibrary()` import/export atlas JSON
- `useCasinoSessions()` reload session state
- `useCrewRecognition()` stats
- import/export helpers from `lib/importExport`
- calendar feed generation
- browser extension download

Major feature groups:

- profile card
- playing hours editor
- import offers CSV
- import booked cruises CSV
- import calendar ICS
- export offers/booked/calendar files
- export/import full app bundle
- download browser extension/template files
- publish personal calendar feed URL
- copy and manage calendar feed URL
- machine atlas import/export
- mock/sample data generation
- whitelist management (admin)
- account/user manual support
- carnival sync entry point visibility based on admin/email

## 5.17 Import Cruises Tool

File: `expo/app/import-cruises.tsx`

Purpose:

- import pasted or synced cruise data
- run pricing sync
- publish/feed ICS calendar URL
- export ICS calendar

Network features:

- `trpc.calendar.saveCalendarFeed`
- pricing sync helper `syncCruisePricing`

## 5.18 Royal Caribbean / Celebrity Sync

File: `expo/app/royal-caribbean-sync.tsx`

Purpose:

- browser-assisted ingestion for Royal Caribbean or Celebrity

Primary pieces:

- `RoyalCaribbeanSyncProvider`
- in-app `WebView`
- web credentials modal
- cookie sync modal
- sync logs, step state, confirmation flow
- optional price sync after ingestion

Server-side status:

- direct backend login/cookie sync procedures currently return “not available on this deployment” style responses
- mobile/browser-assisted sync is the intended path

## 5.19 Carnival Sync

File: `expo/app/carnival-sync.tsx`

Purpose:

- Carnival-specific browser-assisted sync UI
- similar to Royal Caribbean sync but brand-specific content and guidance

Key differences:

- Carnival branding/colors
- extension-first guidance
- sync procedures still depend on backend availability

## 5.20 Paywalls

Files:

- `expo/app/paywall.tsx`
- `expo/app/paywall-monthly.tsx`

Purpose:

- annual and monthly subscription purchase flows
- restore purchases, manage subscription, privacy, terms

## 5.21 Pricing Summary

File: `expo/app/pricing-summary.tsx`

Purpose:

- summarize price completeness, price drops, and tracked savings across upcoming cruises

Primary data:

- `usePriceTracking()` history + drops + completeness helpers
- `useCoreData()` booked cruises

## 5.22 Other utility/system screens

- `expo/app/modal.tsx` → sample modal template
- `expo/app/+not-found.tsx` → fallback 404 screen
- `expo/app/+native-intent.tsx` → Expo native intent integration file

## 6. Component Inventory

### App/dashboard components

- `CompactDashboardHeader`
- `EasySeasHero`
- `HeroHeaderCompact`
- `LandingPage`
- `WelcomeSplash`
- `LoginScreen`
- `ContextualPaywall`

### Offer/cruise components

- `OfferCard`
- `CasinoOfferCard`
- `CruiseCard`
- `CruiseValueReport`
- `CrownAnchorTimeline`
- `FavoriteStateroomsSection`

### AI/analysis components

- `AgentXAnalysisCard`
- `AgentXChat`
- `AlertsCard`
- `CasinoIntelligenceCard`
- `MachineStrategyCard`
- `WhatIfSimulator`

### Casino metrics + session components

- `CasinoMetricsCard`
- `CasinoSessionTracker`
- `AddSessionModal`
- `EditMachineSessionModal`
- `QuickMachineSessionModal`
- `QuickMachineWinModal`
- `MachineSessionStats`
- `MachineSessionsList`
- `SessionsSummaryCard`
- `PointsPerHourCard`
- `LivePPHTracker`
- `PPHGoalsCard`
- `WeeklyGoalsCard`
- `PPHHistoryChart`
- `PPHSessionComparison`
- `PPHLeaderboard`
- `PPHAlertNotification`
- `W2GTracker`
- `CompValueCalculator`

### Loyalty / value / certificate components

- `ClubRoyalePoints`
- `CasinoCertificatesCard`
- `CertificateManagerModal`
- `TierBadge`
- `TierProgressBar`
- `TierProgressionChart`
- `ROIProjectionChart`
- `RiskAnalysisChart`

### Crew / utility components

- `CrewRecognitionSection`
- `AddCrewMemberModal`
- `RecognitionEntryDetailModal`
- `SurveyListModal`
- `TimeZoneConverter`
- `UserManualModal`
- `WebCookieSyncModal`
- `WebSyncCredentialsModal`
- `AddBookedCruiseModal`

### Reusable UI primitives

- `ActionButton`
- `AnimatedActionButton`
- `AnimatedProgressBar`
- `BrandToggle`
- `CelebrationOverlay`
- `CleanActionButtons`
- `CleanDataStats`
- `CleanFilterTabs`
- `CleanSearchBar`
- `CollapsibleSection`
- `EnhancedTabs`
- `MinimalistFilterBar`
- `PressableCard`
- `ProgressBar`
- `QuickActionsFAB`
- `StatCard`
- `UserProfileCard`
- `PlayingHoursCard`

## 7. State Management Inventory

### Core domain / persistence

- `CoreDataProvider.tsx`
  - source of truth for cruises, booked cruises, offers, calendar events, filters, settings, points, club profile
  - local persistence + cloud sync hooks
  - CRUD for major domain entities
- `AppStateProvider.tsx`
  - thin façade over CoreData for legacy-friendly consumer API
- `UserDataSyncProvider.tsx`
  - cloud backup/restore via `trpc.data.*`
  - tracks cloud presence, sync timing, restore timing, retry rules

### Identity / access / monetization

- `AuthProvider.tsx`
  - email-based login
  - admin password for admin email
  - whitelist storage and management
  - fresh-start and account-switch flags
- `EntitlementProvider.tsx`
  - RevenueCat integration
  - trial/grandfathering/basic/pro logic
  - purchase, restore, manage-subscription, privacy/terms links
- `UserProvider.tsx`
  - current user profile, playing hours, loyalty-related profile fields, brand preferences

### Analytics / casino / value

- `SimpleAnalyticsProvider.tsx`
  - aggregate analytics, casino analytics, portfolio metrics, value breakdown helpers
- `CasinoSessionProvider.tsx`
  - session CRUD, daily summaries, machine analytics, historical session generation
- `FinancialsProvider.tsx`
- `BankrollProvider.tsx`
- `TaxProvider.tsx`
- `PriceTrackingProvider.tsx`
- `PriceHistoryProvider.tsx`
- `HistoricalPerformanceProvider.tsx`

### Loyalty / alerts / AI / gamification

- `LoyaltyProvider.tsx`
- `AlertsProvider.tsx`
- `PPHAlertsProvider.tsx`
- `AgentXProvider.tsx`
- `GamificationProvider.tsx`
- `CertificatesProvider.tsx`

### Slots / deck plans / machine strategy

- `SlotMachineLibraryProvider.tsx`
- `SlotMachineProvider.tsx`
- `MachineStrategyProvider.tsx`
- `CasinoStrategyProvider.tsx`
- `DeckPlanProvider.tsx`

### Additional domain providers present in project

- `CelebrityProvider.tsx`
- `CrewRecognitionProvider.tsx`
- `FavoriteStateroomsProvider.tsx`
- `RoyalCaribbeanSyncProvider.tsx`
- `UserProvider.tsx`

## 8. Data Model Spec

Source: `expo/types/models.ts`

### 8.1 Cruise

Fields include:

- identity: `id`, `shipName`, `sailDate`, `returnDate`
- itinerary: `departurePort`, `destination`, `nights`, `itinerary`, `itineraryRaw`, `ports`, `portsAndTimes`, `itineraryName`
- pricing: `price`, `pricePerNight`, `interiorPrice`, `oceanviewPrice`, `balconyPrice`, `suitePrice`, `taxes`, `gratuities`, `totalPrice`, `originalPrice`, `priceDrop`
- offer linkage: `offerCode`, `offerName`, `offerExpiry`, `offerCategory`
- perks/value: `freeOBC`, `freePlay`, `tradeInValue`, `offerValue`, `retailValue`, `compValue`, `totalValue`, `roi`, `valueScore`
- casino meta: `casinoOpenDays`, `seaDays`, `portDays`
- misc: `status`, `notes`, `imageUrl`, `guests`, `received`, `cruiseSource`, timestamps

### 8.2 BookedCruise

Extends `Cruise` with booked/imported details such as:

- `reservationNumber`, `bookingId`, `bwoNumber`
- payment and due data
- stateroom and deck fields
- guest names
- excursions / dining / insurance / airfare
- casino play results (`casinoPoints`, `earnedPoints`, `winnings`, `totalSpend`, etc.)
- `completionState`
- next-cruise certificate usage
- `singleOccupancy`

### 8.3 CasinoOffer

Key fields:

- identity and linking: `id`, `cruiseId`, `cruiseIds`, `offerCode`, `offerName`
- classification: `offerType`, `classification`, `status`
- content: `title`, `description`, `category`, `perks`
- sailing context: `shipName`, `sailingDate`, `itineraryName`, `nights`, `ports`
- room/pricing: `roomType`, `guestsInfo`, `guests`, cabin-specific prices, `taxesFees`
- benefit amounts: `freePlay`, `freeplayAmount`, `OBC`, `obcAmount`, `tradeInValue`
- timing: `received`, `expires`, `expiryDate`, `offerExpiryDate`, `validFrom`, `validUntil`
- source: `offerSource`, `bookingLink`, timestamps

### 8.4 CalendarEvent

Fields:

- `id`, `title`, `startDate`, `endDate`
- `type` = cruise / travel / hotel / flight / personal / other
- `sourceType`, `location`, `description`, `cruiseId`, `color`, `allDay`, `reminder`, `notes`, `source`

### 8.5 ClubRoyaleProfile

Fields:

- member identity, tier, tier points, next tier, total points, lifetime cruises/nights
- preferred cabin/dining/home port
- birthday/anniversary months
- email/phone
- crown anchor number/level + loyalty points

### 8.6 Certificate

Fields:

- `id`, `type`, `value`, `expiryDate`, `used`, optional cruise linkage, reservation number, description, earned-on metadata

### 8.7 MachineEncyclopediaEntry

Fields:

- identity: `id`, `globalMachineId`, `machineName`, `manufacturer`, `gameSeries`
- technical: volatility, cabinet type, release year, RTP range, theme, mechanics, jackpots, denominations
- AP metadata and full profile fields
- summaries and instructional text
- jackpot reset bands
- images and ship assignments
- user state: `userNotes`, `isInMyAtlas`, `isFavorite`, timestamps

### 8.8 MachineDeckMapping

Source: `expo/state/DeckPlanProvider.tsx`

Fields:

- machine id
- ship/class/deck/zone identity
- slot id and slot number
- x/y plan coordinates
- notes, last seen, active flag, timestamps

### 8.9 CasinoSession

Source: `expo/state/CasinoSessionProvider.tsx`

Fields:

- timing: date, start/end, duration
- cruise/machine linkage
- machine type and denomination
- bankroll: buy-in, cash-out, win/loss
- points, jackpot flags, free play, comps, notes

## 9. Persistence Model

### Local persistence

Primary store: AsyncStorage

Key storage definitions: `expo/lib/storage/storageKeys.ts`

Major keys:

- cruises
n- booked cruises
- casino offers
- calendar events
- casino sessions
- settings
- club profile
- user points
- certificates
- alerts / alert rules
- machine encyclopedia / slot atlas
- loyalty data
- bankroll data
- crew recognition entries/sailings
- favorite staterooms
- celebrity-specific loyalty values

Most keys are email-scoped via `getUserScopedKey(baseKey, email)`.

Global/non-scoped keys include:

- users
- current user
- authenticated
- email whitelist
- has launched before
- machine encyclopedia

### Cloud persistence

Handled by `UserDataSyncProvider.tsx` and `CoreDataProvider.tsx`.

Cloud payload includes:

- cruises
- bookedCruises
- casinoOffers
- calendarEvents
- casinoSessions
- clubRoyaleProfile
- settings
- userPoints
- certificates
- alerts
- alertRules
- slotAtlas
- loyaltyData
- bankrollData
- celebrityData
- crew recognition data

## 10. Network / API Spec

Client transport: `expo/lib/trpc.ts`

Behavior:

- base URL comes from `EXPO_PUBLIC_RORK_API_BASE_URL`
- some procedures route to Render backend (`RENDER_BACKEND_URL`)
- backend health cache + timeout + retry logic
- app operates in offline-first mode when backend unreachable

### tRPC router groups

Source: `expo/backend/trpc/app-router.ts`

- `example`
- `data`
- `calendar`
- `royalCaribbeanSync`
- `cruiseDeals`
- `crewRecognition`

### `data` router

Source: `expo/backend/trpc/routes/data.ts`

Main procedures:

- `saveUserData`
- `getUserData`
- `saveAllUserData`
- `getAllUserData`
- `deleteUserData`
- `checkEmailExists`

Backed by SurrealDB user profile documents.

### `calendar` router

Source: `expo/backend/trpc/routes/calendar.ts`

Main procedures:

- `saveCalendarFeed`
- `getCalendarFeedByToken`
- `getCalendarFeedToken`
- `deleteCalendarFeed`
- `fetchICS`

Used for published ICS feeds and remote ICS fetch/import.

### `royalCaribbeanSync` router

Source: `expo/backend/trpc/routes/royal-caribbean-sync.ts`

Main procedures:

- `cookieSync`
- `webLogin`
- `checkStatus`

Current deployment behavior:

- direct cookie sync/web login return “not enabled / use browser extension or mobile WebView” responses

### `cruiseDeals` router

Source: `expo/backend/trpc/routes/cruise-deals.ts`

Purpose:

- pricing/deal scraping helpers
- ship slug normalization
- text price extraction
- safe fetch + web search helpers

### `crewRecognition` router

Source: `expo/backend/trpc/routes/crew-recognition.ts`

Main capabilities:

- fetch CSV asset content
- sync crew recognition data from CSV into DB
- CRUD/query around crew members and recognition data

## 11. Auth and Identity Rules

Source: `expo/state/AuthProvider.tsx`

- login is email-based
- admin email: `scott.merlis1@gmail.com`
- admin password: `a1`
- non-admin users do not require a password in current implementation
- whitelist stored in AsyncStorage and editable by admin
- logout clears AsyncStorage entirely
- first-ever login sets fresh-start flag
- account switch sets a pending-account-switch flag

## 12. Monetization and Access Control

Source: `expo/state/EntitlementProvider.tsx`

Rules:

- trial duration: 5 days
- grandfathered users before cutoff date can keep access
- tiers: trial / view / basic / pro
- display status: grace_period / monthly / annual / expired
- RevenueCat product ids:
  - `easyseas_pro_monthly`
  - `easyseas_pro_annual`
- paywalls support:
  - purchase monthly
  - purchase annual
  - restore purchases
  - open manage subscription
  - open privacy policy / terms

## 13. Import / Export Features

### CSV / ICS / files

Main files:

- `expo/lib/importExport.ts`
- `expo/lib/dataManager.ts`
- `expo/lib/calendar/feedGenerator.ts`
- `expo/lib/calendar/icsParser.ts`
- `expo/lib/csv/*.ts`
- `expo/lib/exportMachinesToDocx.ts`

Supported operations in app:

- import offers CSV
- import booked cruises CSV
- import calendar ICS
- export offers CSV
- export booked cruises CSV
- export calendar ICS
- export/import full app data bundle
- export favorite slot machines to DOCX
- export full slot atlas to DOCX
- export single machine to DOCX
- publish personal ICS feed URL
- copy/regenerate/subscribe to feed URL

## 14. Analytics / Calculation Rules

Key calculation helpers:

- `expo/lib/valueCalculator.ts`
- `expo/lib/casinoAvailability.ts`
- `expo/lib/luckCalculator.ts`
- `expo/lib/recommendationEngine.ts`
- `expo/lib/backToBackFinder.ts`
- `expo/lib/whatIfSimulator.ts`

Core concepts:

- cruise value = room value + taxes + perks + free play + OBC + trade-in value + points value
- casino points are normalized to coin-in using `$5 per point`
- ROI and portfolio value are shown across multiple screens
- cruise itinerary is also used to estimate casino-open days and sea-day play opportunities
- offers and cruises may enrich one another when one source lacks pricing or itinerary data

## 15. Sync Workflows

### Cloud backup/restore

- triggered through user data sync provider and core data provider
- keyed by normalized authenticated email
- merges/scopes data to current identity

### Browser-assisted cruise sync

- Royal/Celebrity/Carnival sync screens use in-app WebView and/or extension guidance
- credentials/cookie modals attempt backend mutations if available
- current deployment favors extension/mobile-browser ingestion over server-side login

### Calendar publication

- user email required
- generates ICS content from booked cruises + calendar events
- saves to backend by token
- exposes public feed URL and `webcal://` subscription flow

## 16. Design System and UI Rules

Primary token source: `expo/constants/theme.ts`

Current premium light system token set used by themed screens:

- page bg: `DS.bg.page` = white
- secondary bg: `DS.bg.secondary`
- marble shell gradients: `DS.bg.marble`, `DS.bg.marbleShell`
- text: `DS.text.primary`, `secondary`, `tertiary`
- borders: `DS.border.default`, `DS.border.divider`
- accents: success / warning / alert only
- decorative font: Lobster (`DS.font.lobster`)
- system font for functional UI
- radii: 10 / 14 / 18 / 22 / pill
- spacing: 8 / 12 / 16 / 20 / 24 / 32

## 17. Files Modified in This Pass

To finish the user request, the following files were updated:

- `expo/app/(tabs)/machines.tsx`
- `expo/components/AtlasCard.tsx`
- `expo/app/offer-details.tsx`
- `expo/app/(tabs)/(overview)/cruise-details.tsx`
- `expo/APP_REBUILD_SPEC.md`

Result:

- Slots page now uses the same premium light theme direction
- Offer detail page now matches the light premium shell system
- Cruise detail page now matches the light premium shell system
- A rebuild spec markdown file now exists in the Expo app directory

## 18. Rebuild Priorities if Starting From Scratch

1. Recreate models in `types/models.ts`
2. Recreate storage key strategy with per-email scoping
3. Rebuild providers in this order:
   - Auth
   - UserDataSync
   - CoreData
   - User
   - Loyalty
   - Entitlement
   - Analytics/session/alerts/AI/slots/deck plans
4. Rebuild root layout and tab router
5. Rebuild primary tabs in this order:
   - Offers
   - Cruises
   - Booked
   - Calendar
   - Casino Analytics
   - Slots
   - Settings
6. Add detail/modals screens
7. Add import/export + sync tools
8. Add paywalls and entitlement checks
9. Add charts, AI surfaces, and secondary tooling
10. Add cloud sync + published calendar feed support

## 19. Known Behavioral Notes

- Local data often acts as fallback when store arrays are empty
- Many flows merge data from both `CoreDataProvider` and `AppStateProvider` façade
- Sync routes are deployment-sensitive; UI must gracefully fall back when backend is unavailable
- The app is designed to work on web and native, so all rebuilt screens must avoid web-incompatible patterns
- Some files remain template-like (`modal`, `+not-found`) and can be rebuilt last

## 20. Minimal Rebuild Checklist

A rebuild is functionally complete only if it supports all of the following:

- email login + whitelist/admin behavior
- local persistence scoped by authenticated email
- cloud backup/restore
- offers tab with grouped offers and offer detail modal
- cruise browsing + back-to-back discovery
- booked cruise management + cruise detail editing
- calendar with booked-cruise overlays and day agenda
- casino analytics with sessions, charts, goals, and tax tools
- slot atlas, global library, machine detail, deck mapping
- CSV/ICS import/export and calendar feed publishing
- Royal/Celebrity/Carnival sync entry points
- RevenueCat monthly/annual paywalls
- premium light design system
