# Plan Q: Royal Caribbean Sync Feature

## Overview
Build an in-app Royal Caribbean Sync feature that uses WebView + JavaScript injection to extract data from Royal Caribbean's website and sync it directly into the app's existing data structures.

## Architecture

### Components
1. **Screen**: `app/royal-caribbean-sync.tsx` - Main sync UI
2. **Provider**: `state/RoyalCaribbeanSyncProvider.tsx` - State management
3. **Library**: `lib/royalCaribbean/` - Injection scripts and orchestration
4. **Types**: Extend `types/models.ts` with sync-specific types

### Data Flow
```
User Login (Manual) 
  → WebView Session 
  → Run Ingestion Button 
  → Orchestrator 
  → Step 1-4 Scripts 
  → Extract Data 
  → Parse & Validate 
  → Sync to CoreDataProvider 
  → Display Success + Export CSV Options
```

## Implementation Steps

### Step 1: Create Base Screen UI
**File**: `app/royal-caribbean-sync.tsx`

**Components**:
- WebView (react-native-webview) - collapsible, takes most of screen
- Status pill showing current state
- Action buttons (conditionally enabled)
- Log viewer (collapsible)

**Status States**:
- `not_logged_in` - Initial state
- `logged_in` - Auth detected
- `running_step_1` - Extracting Club Royale Offers
- `running_step_2` - Extracting Upcoming Cruises
- `running_step_3` - Extracting Courtesy Holds
- `running_step_4` - Extracting Loyalty Status
- `complete` - All steps done
- `login_expired` - Re-auth needed
- `error` - Failed

**Buttons**:
- "Open Royal Caribbean Login" - Always enabled
- "Run Ingestion" - Enabled when logged_in
- "Export offers.csv" - Enabled when complete
- "Export Booked_Cruises.csv" - Enabled when complete
- "Sync to App" - Enabled when complete
- "View Log" / "Export Log" - Always enabled

### Step 2: Authentication Detection
**File**: `lib/royalCaribbean/authDetection.ts`

**Logic**:
- Inject script to check for logged-in indicators
- Look for user profile elements, account menu, or specific cookies
- Poll every 2 seconds when on login pages
- Emit `authStatusChanged` message to app

**Detection Strategy**:
```javascript
// Check for common logged-in indicators
- Presence of account menu
- User name displayed
- Session cookies present
- Redirect from login to account page
```

### Step 3: Ingestion Scripts

#### 3A: Club Royale Offers Script
**File**: `lib/royalCaribbean/step1_offers.ts`

**URL**: `https://www.royalcaribbean.com/club-royale/offers`

**Logic**:
1. Wait for page load (detect key selectors)
2. Click "Show All Offers" if present
3. For each offer card:
   - Extract offer metadata
   - Click "VIEW SAILINGS"
   - Wait for sailings panel
   - Scroll until all sailings loaded
   - Extract each sailing
4. Return JSON array of offer-sailing rows

**Scroll Logic**:
```javascript
async function scrollUntilComplete(containerSelector) {
  let previousHeight = 0;
  let stableCount = 0;
  
  while (stableCount < 3) {
    const currentHeight = container.scrollHeight;
    if (currentHeight === previousHeight) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    previousHeight = currentHeight;
    
    container.scrollBy(0, 500);
    await wait(1000);
  }
}
```

**Extraction**:
- Never invent data
- Use `textContent.trim()` for visible text
- Leave empty string if not found
- One row per offer-sailing combination

#### 3B: Upcoming Cruises Script
**File**: `lib/royalCaribbean/step2_upcoming.ts`

**URL**: `https://www.royalcaribbean.com/account/upcoming-cruises`

**Logic**:
1. Scroll until all cruise cards loaded
2. For each card:
   - Click "VIEW ADDITIONAL DETAILS"
   - Wait for expansion
   - Extract all visible details
3. Return JSON array of cruise rows

**Status**: Always "Upcoming"

#### 3C: Courtesy Holds Script
**File**: `lib/royalCaribbean/step3_holds.ts`

**URL**: `https://www.royalcaribbean.com/account/courtesy-holds`

**Logic**:
1. Scroll/paginate until all holds loaded
2. Extract each hold
3. Return JSON array

**Status**: Always "Courtesy Hold"

#### 3D: Loyalty Status Script
**File**: `lib/royalCaribbean/step4_loyalty.ts`

**URL**: `https://www.royalcaribbean.com/account/loyalty-status`

**Logic**:
1. Extract Crown & Anchor level + points
2. Extract Club Royale tier + points
3. Return single JSON object with loyalty data

### Step 4: Orchestrator
**File**: `lib/royalCaribbean/orchestrator.ts`

**Function**: `runFullIngestion(webViewRef)`

**Flow**:
1. Emit log: "Starting ingestion..."
2. Navigate to Step 4 (loyalty) first to get metadata
3. Navigate to Step 1 → execute → collect results
4. Navigate to Step 2 → execute → collect results
5. Navigate to Step 3 → execute → collect results
6. Combine all results with loyalty metadata
7. Generate CSV files
8. Sync to CoreDataProvider
9. Emit completion

**Error Handling**:
- Retry failed navigation once
- Detect auth failures (redirect to login)
- Stop immediately on auth failure
- Log all errors

### Step 5: Large List Handling
**File**: `lib/royalCaribbean/scrollHandler.ts`

**Requirements**:
- Handle infinite scroll
- Handle virtualized lists
- Track processed items to avoid duplicates
- Resilient to DOM recycling

**Strategy**:
```javascript
async function processAllItems(itemSelector, processFn) {
  const processed = new Set();
  
  while (true) {
    const items = document.querySelectorAll(itemSelector);
    let newItemsFound = false;
    
    for (const item of items) {
      const id = getUniqueId(item);
      if (!processed.has(id)) {
        await processFn(item);
        processed.add(id);
        newItemsFound = true;
      }
    }
    
    // Scroll and check for new items
    const scrolled = await scrollDown();
    if (!scrolled && !newItemsFound) break;
    
    await wait(1000);
  }
  
  // Scroll back up to re-process collapsed items
  await scrollToTop();
  // ... repeat processing
}
```

### Step 6: CSV Generation
**File**: `lib/royalCaribbean/csvGenerator.ts`

**Functions**:
- `generateOffersCSV(data, loyaltyData)` → string
- `generateBookedCruisesCSV(data, loyaltyData)` → string

**offers.csv Columns**:
```
Source Page,Offer Name,Offer Code,Offer Expiration Date,Offer Type,Ship Name,Sailing Date,Itinerary,Departure Port,Cabin Type,Number of Guests,Perks,Loyalty Level,Loyalty Points
```

**Booked_Cruises.csv Columns**:
```
Source Page,Ship Name,Sailing Start Date,Sailing End Date,Sailing Date(s),Itinerary,Departure Port,Cabin Type,Cabin Number/GTY,Booking ID,Status,Loyalty Level,Loyalty Points
```

**Rules**:
- Use proper CSV escaping (quotes for commas/newlines)
- No invented data
- Empty strings for missing data
- Loyalty metadata repeated in every row

### Step 7: Logging System
**File**: `lib/royalCaribbean/logger.ts`

**Functions**:
- `log(message)` - Add timestamped log entry
- `getLogs()` - Get all logs
- `exportLogs()` - Generate log file for sharing

**Log Entries**:
```
[2026-01-05 14:32:01] Starting ingestion...
[2026-01-05 14:32:03] Navigating to loyalty status page
[2026-01-05 14:32:07] Extracted loyalty: Diamond Plus, 485 nights
[2026-01-05 14:32:08] Navigating to offers page
[2026-01-05 14:32:12] Clicking "Show All Offers"
[2026-01-05 14:32:15] Found 47 offers
[2026-01-05 14:32:16] Processing offer 1/47: "Black Friday Sale"
[2026-01-05 14:32:18] Clicking "View Sailings" for offer 1
[2026-01-05 14:32:20] Scrolling sailings (found 12 so far)
[2026-01-05 14:32:25] Sailings complete: 23 total
...
```

### Step 8: Data Sync to App
**File**: `lib/royalCaribbean/syncToApp.ts`

**Function**: `syncExtractedData(offersData, bookedData, coreDataProvider)`

**Logic**:
1. Parse extracted offers data
2. Transform to app's `CasinoOffer` format
3. Call `coreDataProvider.importOffers(offers)`

4. Parse extracted booked cruises data
5. Transform to app's `BookedCruise` format
6. Call `coreDataProvider.importBookedCruises(cruises)`

7. Update last sync timestamp
8. Show success notification

**Mapping**:
```typescript
// Offers
RoyalCaribbeanOffer → CasinoOffer
{
  source: 'Royal Caribbean',
  offerName: row['Offer Name'],
  offerCode: row['Offer Code'],
  expirationDate: parseDate(row['Offer Expiration Date']),
  shipName: row['Ship Name'],
  sailingDate: parseDate(row['Sailing Date']),
  // ... map all fields
}

// Booked Cruises
RoyalCaribbeanBooking → BookedCruise
{
  source: 'Royal Caribbean',
  shipName: row['Ship Name'],
  sailingStartDate: parseDate(row['Sailing Start Date']),
  sailingEndDate: parseDate(row['Sailing End Date']),
  // ... map all fields
}
```

### Step 9: State Management
**File**: `state/RoyalCaribbeanSyncProvider.tsx`

**State**:
```typescript
{
  status: SyncStatus;
  currentStep: string;
  progress: { current: number; total: number };
  logs: LogEntry[];
  extractedOffers: OfferRow[];
  extractedBookedCruises: BookedCruiseRow[];
  loyaltyData: LoyaltyData | null;
  error: string | null;
}
```

**Actions**:
- `openLogin()` - Navigate WebView to login
- `runIngestion()` - Start orchestrator
- `exportOffersCSV()` - Share offers.csv
- `exportBookedCSV()` - Share Booked_Cruises.csv
- `exportLog()` - Share last.log
- `syncToApp()` - Sync data to CoreDataProvider
- `resetState()` - Clear and start over

### Step 10: WebView Integration
**File**: `app/royal-caribbean-sync.tsx`

**Key Features**:
- Use `react-native-webview`
- `injectedJavaScriptBeforeContentLoaded` for early injection
- `onMessage` handler for postMessage from scripts
- `ref` to control navigation and injection

**Message Protocol**:
```typescript
type WebViewMessage = 
  | { type: 'auth_status', loggedIn: boolean }
  | { type: 'log', message: string }
  | { type: 'progress', current: number, total: number }
  | { type: 'step_complete', step: number, data: any[] }
  | { type: 'error', message: string }
  | { type: 'complete' };
```

## File Structure
```
lib/royalCaribbean/
  ├── authDetection.ts
  ├── orchestrator.ts
  ├── scrollHandler.ts
  ├── csvGenerator.ts
  ├── logger.ts
  ├── syncToApp.ts
  ├── steps/
  │   ├── step1_offers.ts
  │   ├── step2_upcoming.ts
  │   ├── step3_holds.ts
  │   └── step4_loyalty.ts
  └── types.ts

state/
  └── RoyalCaribbeanSyncProvider.tsx

app/
  └── royal-caribbean-sync.tsx
```

## Dependencies
- `react-native-webview` - WebView component
- `expo-sharing` - For sharing CSV/log files
- `expo-file-system` - For writing files

## Testing Strategy
1. Test with mock HTML pages first
2. Test scroll logic with long lists
3. Test auth detection
4. Test error handling (network failures, auth expiry)
5. Test CSV generation with edge cases
6. Test data sync to app

## Success Criteria
- [ ] User can log in manually in WebView
- [ ] Auth detection works reliably
- [ ] All 4 steps execute in sequence
- [ ] Handles large lists (100+ offers, 50+ cruises)
- [ ] Never invents data
- [ ] Generates valid CSV files
- [ ] Syncs data to app successfully
- [ ] Shows detailed logs
- [ ] Handles errors gracefully
- [ ] Works on both iOS and Android

## Future Enhancements
- Schedule automatic sync
- Background sync
- Diff detection (only sync changes)
- Multi-account support
- Sync history
