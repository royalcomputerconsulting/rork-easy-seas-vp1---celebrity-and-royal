# Easy Seas App - Implementation Plan

## Overview

This document outlines the phased approach to rebuild the Easy Seas / Club Royale cruise tracking app based on the roadmap specifications. The plan is designed to be executed incrementally to avoid timeouts and token limits.

### Quick Summary
1. **Foundations First:** Expand domain models (Phase 1) and enrich constants + reusable UI (Phases 3-4) to mirror real cruise + casino attributes.
2. **State Intelligence:** Upgrade providers (Phase 2) so analytics, persistence, and cleansing logic match the richer schemas.
3. **Hero Screens:** Tackle Overview, Analytics, Scheduling, Booked, Events, and Settings tabs (Phases 5-10) with the new components + data, focusing on tier progress, ROI insights, scheduling utilities, and data management UX.
4. **Execution Order:** Follow the prescribed order (1 → 3 → 4 → 2 → 5 → 9 → 6 → 7 → 8 → 10) to avoid rework and keep dependencies satisfied.

---

## Current State Assessment

### What Already Exists:
- Basic Expo Router setup with 6 tabs (Offers, Schedule, My Cruises, Events, Stats, Settings)
- Core providers: AppStateProvider, UserProvider, FiltersProvider, CruiseStore, etc.
- Basic theme system (constants/theme.ts)
- Basic type definitions (types/models.ts)
- Some UI components: HeroHeaderCompact, OfferCard, CruiseCard, WelcomeSplash
- AsyncStorage integration for local persistence

### What Needs to Be Added/Enhanced:
Based on roadmap and screenshots, we need significant enhancements across all areas.

---

## Phase 1: Data Models & Types Enhancement

### Priority: HIGH
### Estimated Effort: Medium

**Files to modify:**
- `types/models.ts` - Add missing fields and types

**Tasks:**
1. Enhance `Cruise` model with:
   - `itineraryName`, `ports[]`, `destinationRegion`
   - `priceInterior`, `priceOceanView`, `priceBalcony`, `priceSuite`
   - Better status typing
   - `offerCode` cross-referencing

2. Enhance `CasinoOffer` model with:
   - `offerCode`, `offerName`, `category`, `perks[]`
   - `tradeInValue`, `freePlay`, `OBC`
   - 20-column CSV mapping fields
   - `cruiseIds[]` for linking

3. Add new types:
   - `FinancialsRecord` (sourceType, date, amount, category, department, folioOrRef)
   - `CasinoPerformance` (coinIn, actualRisk, riskMultiplier)
   - `EstimatorParams` for ROI calculations
   - `ProgressTier` for tier tracking

4. Create `types/context.ts` for provider shapes

---

## Phase 2: State Providers Enhancement

### Priority: HIGH
### Estimated Effort: High

**Files to modify/create:**
- `state/AppStateProvider.tsx` - Enhance with more helpers
- `state/CruiseStore.ts` - Verify functionality
- `state/SimpleAnalyticsProvider.tsx` - Enhance analytics calculations

**Tasks:**
1. AppStateProvider enhancements:
   - `cleanExpiredOffers()` - Remove expired offers
   - `updateUserPoints()` - Update Club Royale points
   - `mergeLocalData()` - Merge imported data
   - `autoCompletePaidCruises()` - Mark completed cruises

2. SimpleAnalyticsProvider enhancements:
   - `calculateCruiseROI()` - ROI calculation
   - `calculateValueScore()` - 0-100 value scoring
   - `calculateRetailValue()` - Retail price estimation
   - Progress to tier calculations

3. Ensure CruiseStore provides:
   - `allCruises`, `bookedCruises`, `availableCruises`
   - Filtering by ship, date, offer
   - Mutation helpers

---

## Phase 3: Constants & Configuration

### Priority: MEDIUM
### Estimated Effort: Low

**Files to create:**
- `constants/clubRoyaleTiers.ts` - Tier thresholds and info
- `constants/crownAnchor.ts` - Crown & Anchor levels
- `constants/shipInfo.ts` - Ship data and classes
- `constants/financials.ts` - Category names

**Tasks:**
1. Club Royale tier data:
   - Choice, Prime, Signature, Masters thresholds
   - Points required, benefits per tier

2. Crown & Anchor levels:
   - Gold, Platinum, Emerald, Diamond, Diamond Plus, Pinnacle
   - Benefits and thresholds

3. Ship information:
   - Royal Caribbean ship list with classes
   - Passenger capacity, typical itineraries

---

## Phase 4: UI Components

### Priority: HIGH
### Estimated Effort: High

**Files to create:**
- `components/ClubRoyalePoints.tsx` - Tier/points display card
- `components/StatCard.tsx` - Small metric card
- `components/ProgressBar.tsx` - Progress visualization
- `components/TierBadge.tsx` - PRIME/DIAMOND PLUS badges
- `components/ActionButton.tsx` - Icon + label button
- `components/QuickActions.tsx` - Action button row
- `components/DataOverview.tsx` - Stats grid component
- `components/EmptyState.tsx` - Empty state component
- `components/ui/GradientButton.tsx` - Gradient CTA button

**Key design elements from screenshots:**
- PRIME / DIAMOND PLUS badge pills
- Progress bars with percentage and ETA
- Stats grids (2x2 or 3x1 layouts)
- Action button grids
- Light blue tinted cards
- Navy blue backgrounds with warm beige accents

---

## Phase 5: Overview (Offers) Tab

### Priority: HIGH
### Estimated Effort: High

**Files to modify:**
- `app/(tabs)/(overview)/index.tsx`

**UI Elements (from screenshot reference):**
1. Easy Seas branding header with logo/mascot
2. PRIME and DIAMOND PLUS tier badges
3. Progress to Pinnacle with bar and ETA
4. Progress to Signature Tier with bar and ETA
5. Current total points display
6. Available cruises count
7. Total Certificates section
8. Casino & Certificates card with Manage button
9. CASINO OFFERS section with offer cards

**Data Integration:**
- Connect to AppStateProvider for offers
- Use SimpleAnalyticsProvider for progress calculations
- Display tier progress bars

---

## Phase 6: Scheduling Tab

### Priority: HIGH
### Estimated Effort: High

**Files to modify:**
- `app/(tabs)/scheduling.tsx`

**UI Elements (from screenshot reference):**
1. Easy Seas header with badges
2. Tab toggle: Available, All, Booked, For You
3. Action buttons: Filter, Clear Filters, CR Points, Alerts (with badge)
4. Search input
5. Stats row: showing, total, booked counts
6. Cruise cards with ship images, dates, ports
7. Empty state with ship icon

**Features:**
- Filter by cabin type (Interior, Oceanview, Balcony, Suite)
- Filter by date range
- Conflict detection with booked cruises
- Sort options

---

## Phase 7: Booked (My Cruises) Tab

### Priority: HIGH
### Estimated Effort: Medium

**Files to modify:**
- `app/(tabs)/booked.tsx`

**UI Elements (from screenshot reference):**
1. Easy Seas header
2. Stats: Upcoming, Completed, With Data, Total
3. Action buttons: Refresh, Hide, Clear Filters, Sort
4. Search input
5. Sort chip: "Oldest First"
6. Cruise cards with ship image, dates, ports, reservation number

**Features:**
- Classify into: upcoming, in-progress, completed
- Sort by departure date
- Show booking status indicators

---

## Phase 8: Events Tab

### Priority: MEDIUM
### Estimated Effort: Medium

**Files to modify:**
- `app/(tabs)/events.tsx`

**UI Elements (from screenshot reference):**
1. Easy Seas header with branding
2. View toggle: Events, Week, Month, 90 Days
3. Calendar grid with color-coded event indicators
4. Legend: Cruise, Travel, Personal (with counts)
5. Days highlighted based on event type

**Features:**
- Month navigation with chevron buttons
- Event type filtering
- Integration with TripIt/calendar events

---

## Phase 9: Analytics (Stats) Tab

### Priority: HIGH
### Estimated Effort: Very High

**Files to modify:**
- `app/(tabs)/analytics.tsx`

**UI Elements (from screenshot reference):**
1. Easy Seas branding header with badges
2. Stats grid: Total Cruises, Total Points, Portfolio ROI, Total Savings
3. Total $ Spent on Cruises, Total $ Spent in Port Taxes
4. Player and Loyalty Status with tier toggles
5. Nights to Pinnacle, Nights to Signature
6. Progress bars with ETA dates
7. Portfolio Performance section:
   - Top metrics: Coin-In, Actual Risk, Risk Multiplier
   - Cruise Portfolio with filter tabs (All, High ROI, Medium ROI, Low ROI)
   - Filter dropdowns: Ship, Date, Sort
   - Cruise cards showing ROI%, Points, Paid, Retail, $/Pt
8. Progress & Agent X Analysis section
9. Quick action buttons: Agent X, Intelligence, Charts

**Features:**
- ROI calculations per cruise
- Points tracking and projections
- Tier progress tracking
- Portfolio analysis

---

## Phase 10: Settings Tab

### Priority: MEDIUM
### Estimated Effort: High

**Files to modify:**
- `app/(tabs)/settings.tsx`

**UI Elements (from screenshot reference):**
1. Form fields: Name, Crown & Anchor #, Club Royale Points, Loyalty Points
2. Action buttons grid: Save, Load, Pricing, Backend, Status, Clear
3. Reset Account button (orange/warning)
4. User Profile display showing current values
5. Data Overview stats (cruises, booked, offers, events)
6. Data Actions: Import, CR Points, Verify

**Features:**
- Profile editing
- Data import/export
- Backend diagnostics
- Local data management

---

## Implementation Order

Execute phases in this order:

1. **Phase 1** - Data models (foundation)
2. **Phase 3** - Constants (required by components)
3. **Phase 4** - UI Components (reusable pieces)
4. **Phase 2** - State providers (connect data to UI)
5. **Phase 5** - Overview tab (primary screen)
6. **Phase 9** - Analytics tab (key feature)
7. **Phase 6** - Scheduling tab
8. **Phase 7** - Booked tab
9. **Phase 8** - Events tab
10. **Phase 10** - Settings tab

---

## Design System Reference

### Color Palette (from screenshots):
- Primary Navy: #001F3F / #003D5C
- Accent Teal: #14B8A6 (for positive metrics)
- Warm Beige: #D4A574
- Warning Orange: #FF9800
- Light backgrounds: #FFF8DC / #FFFEF0
- Card backgrounds: Light blue tints

### Typography:
- Bold headers for section titles
- Large numbers for key metrics
- Smaller labels below metrics

### Components:
- Rounded cards with shadows
- Progress bars with percentage and ETA
- Toggle button groups
- Icon + label action buttons
- Badge pills (PRIME, DIAMOND PLUS)
- Stats grids (2x2 or 3x1 layouts)

---

## Notes

- Each phase should be committed separately
- Test after each phase completion
- Reference screenshot URLs in roadmap.md for visual guidance
- Maintain backward compatibility with existing data
- Backend integration is NOT enabled - all data is local via AsyncStorage
