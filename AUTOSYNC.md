# AutoSync Implementation Plan

## Overview

AutoSync enables automatic synchronization of Royal Caribbean offers, cruises, holds, and loyalty data directly from the user's account. This eliminates manual CSV exports while maintaining the Chrome extension fallback.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Native  │────▶│   Backend API   │────▶│   Playwright    │
│   (WebView +    │     │   (Hono/tRPC)   │     │   Scraper       │
│   Cookie Capture)     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                      │
         │                      ▼                      │
         │              ┌─────────────────┐            │
         │              │  Encrypted      │            │
         └─────────────▶│  Session Store  │◀───────────┘
                        │  (Database)     │
                        └─────────────────┘
```

---

## Phase 1: Client - Connect Royal Caribbean Flow

### 1.1 UI Components

**Location:** `app/rc-connect.tsx` (new modal screen)

**Components needed:**
- `RCConnectButton` - Main "Connect Royal Caribbean" button in Settings
- `RCWebViewModal` - WebView for login flow
- `RCSyncStatus` - Connection status display
- `RCSyncActions` - Sync Now / Disconnect buttons

### 1.2 WebView Login Flow

```typescript
// Pseudo-code for WebView login
const RC_LOGIN_URL = 'https://www.royalcaribbean.com/club-royale';

const SUCCESS_URL_PATTERNS = [
  '/clubroyale/offers',
  '/account/',
  '/my-account',
];

function isLoginSuccessful(url: string): boolean {
  return SUCCESS_URL_PATTERNS.some(pattern => url.includes(pattern));
}
```

### 1.3 Cookie Capture Strategy

**iOS/Android:** Use `react-native-webview` with cookie extraction:

```typescript
// Inject JS to capture cookies and storage
const CAPTURE_SCRIPT = `
  (function() {
    const data = {
      cookies: document.cookie,
      localStorage: JSON.stringify(localStorage),
      sessionStorage: JSON.stringify(sessionStorage),
      timestamp: Date.now()
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(data));
  })();
`;
```

### 1.4 Session Transmission

**Endpoint:** `POST /api/rc/session`

**Payload:**
```typescript
interface RCSessionPayload {
  userId: string;
  cookies: string;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  capturedAt: number;
  deviceId: string;
}
```

### 1.5 Security Requirements

- [ ] Never store user password
- [ ] Encrypt cookies/tokens at rest (AES-256)
- [ ] Session data expires after 7 days
- [ ] "Disconnect" completely removes all session data
- [ ] Rate limit connection attempts (5 per hour)

---

## Phase 2: Backend - Session Management

### 2.1 Database Schema

```sql
CREATE TABLE rc_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_cookies TEXT NOT NULL,
  encrypted_storage TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  last_sync_at TIMESTAMP,
  sync_status TEXT DEFAULT 'idle',
  is_valid BOOLEAN DEFAULT true,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE rc_sync_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT,
  offers_count INTEGER,
  cruises_count INTEGER,
  holds_count INTEGER,
  error_message TEXT,
  screenshot_url TEXT,
  FOREIGN KEY (session_id) REFERENCES rc_sessions(id)
);
```

### 2.2 API Endpoints

**File:** `backend/trpc/routes/rc-sync.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rc/session` | POST | Store encrypted session |
| `/api/rc/session` | DELETE | Disconnect (delete session) |
| `/api/rc/status` | GET | Get sync status |
| `/api/rc/sync` | POST | Trigger sync |
| `/api/rc/sync/results` | GET | Get last sync results |

### 2.3 Session Validation

Before each sync, validate session:

```typescript
async function validateSession(sessionId: string): Promise<boolean> {
  const session = await getDecryptedSession(sessionId);
  
  // Try lightweight request
  const response = await fetch('https://www.royalcaribbean.com/clubroyale/offers', {
    headers: { Cookie: session.cookies },
    redirect: 'manual'
  });
  
  // If redirected to login, session invalid
  if (response.status === 302) {
    await markSessionInvalid(sessionId);
    return false;
  }
  
  return response.status === 200;
}
```

---

## Phase 3: Backend - Playwright Scraper

### 3.1 Scraper Architecture

**File:** `backend/scraper/rc-scraper.ts`

```typescript
interface RCScrapeResult {
  success: boolean;
  data: {
    offers: RCOffer[];
    offerSailings: RCOfferSailing[];
    bookedCruises: RCBookedCruise[];
    courtesyHolds: RCCourtesyHold[];
    pastCruises: RCPastCruise[];
    loyalty: RCLoyalty;
  };
  csvFiles: {
    offers: string;      // Base64 CSV
    booked: string;      // Base64 CSV
    holds: string;       // Base64 CSV
  };
  timestamp: number;
  screenshots?: string[];
  errors?: string[];
}
```

### 3.2 Target Pages

#### Page 1: Offers + Sailings
**URL:** `https://www.royalcaribbean.com/clubroyale/offers`

**Extract:**
- Offer cards: name, code, expiration, type, perks
- For each offer: expand sailings grid
- Cruise details: sailing date, ship, nights, itinerary, cabin category, guests
- Pricing: inside/ocean/balcony/suite rates

**Selectors (example):**
```typescript
const OFFER_SELECTORS = {
  offerCard: '[data-testid="offer-card"]',
  offerName: '.offer-title',
  offerCode: '.offer-code',
  offerExpiry: '.offer-expiration',
  sailingGrid: '.sailing-results',
  sailingRow: '.sailing-row',
};
```

#### Page 2: Upcoming Cruises
**URL:** `https://www.royalcaribbean.com/account/upcoming-cruises`

**Extract:**
- Sailing date, ship, itinerary
- Booking ID, guests, cabin
- Status

#### Page 3: Courtesy Holds
**URL:** `https://www.royalcaribbean.com/account/courtesy-holds`

**Extract:**
- Hold sailings and deadlines
- Ship, dates, cabin category

#### Page 4: Past Cruises
**URL:** `https://www.royalcaribbean.com/account/past-cruises`

**Extract:**
- Completed sailings and dates
- Ship, itinerary

#### Page 5: Loyalty
**URL:** `https://www.royalcaribbean.com/account/loyalty`

**Extract:**
```typescript
interface RCLoyalty {
  crownAnchorPoints: number;
  currentTier: string;
  nextTier: string;
  nightsToNextTier: number;
  pointsToNextTier: number;
}
```

### 3.3 Playwright Implementation

```typescript
import { chromium, BrowserContext } from 'playwright';

async function scrapeRoyalCaribbean(
  encryptedCookies: string
): Promise<RCScrapeResult> {
  const cookies = decryptCookies(encryptedCookies);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Inject cookies
  await context.addCookies(parseCookies(cookies));
  
  const page = await context.newPage();
  const result: RCScrapeResult = { /* init */ };
  
  try {
    // Scrape each page
    result.data.offers = await scrapeOffersPage(page);
    result.data.bookedCruises = await scrapeUpcomingPage(page);
    result.data.courtesyHolds = await scrapeHoldsPage(page);
    result.data.pastCruises = await scrapePastCruisesPage(page);
    result.data.loyalty = await scrapeLoyaltyPage(page);
    
    // Generate CSVs
    result.csvFiles = generateCSVFiles(result.data);
    
    result.success = true;
  } catch (error) {
    result.success = false;
    result.errors = [error.message];
    
    // Capture debug screenshot
    result.screenshots = [await page.screenshot({ encoding: 'base64' })];
  } finally {
    await browser.close();
  }
  
  return result;
}
```

### 3.4 CSV Generation

Output CSVs must match existing verified schemas:

**Offers.csv columns:**
```
Offer Code,Offer Name,Offer Type,Expiration Date,Ship,Sail Date,Nights,Itinerary,Inside Rate,Ocean Rate,Balcony Rate,Suite Rate,Guests,Perks
```

**Booked.csv columns:**
```
Booking ID,Ship,Sail Date,Return Date,Nights,Itinerary,Cabin Category,Cabin Number,Guests,Status
```

**Holds.csv columns:**
```
Ship,Sail Date,Nights,Itinerary,Cabin Category,Hold Deadline,Status
```

---

## Phase 4: App - Sync UI & Import Pipeline

### 4.1 Settings Page Integration

**Location:** `app/(tabs)/settings.tsx`

Add new section: "Royal Caribbean Sync"

```typescript
// New section in Settings
<Section title="Royal Caribbean Sync">
  <RCConnectionStatus />
  
  {isConnected ? (
    <>
      <StatusRow 
        label="Last synced" 
        value={formatDate(lastSyncAt)} 
      />
      <Button title="Sync Now" onPress={handleSync} />
      <Button title="Download CSVs" onPress={handleDownloadCSVs} />
      <Button title="Import into App" onPress={handleImport} />
      <Button title="Disconnect" onPress={handleDisconnect} variant="danger" />
    </>
  ) : (
    <Button title="Connect Royal Caribbean" onPress={handleConnect} />
  )}
</Section>
```

### 4.2 Sync Flow

```typescript
async function handleSync() {
  setSyncing(true);
  
  try {
    // 1. Call backend sync
    const result = await trpc.rcSync.sync.mutate();
    
    if (!result.success) {
      if (result.sessionExpired) {
        // Prompt reconnect
        showReconnectModal();
      } else {
        Alert.alert('Sync Failed', result.error);
      }
      return;
    }
    
    // 2. Store results locally
    await storeLastSyncResult(result);
    
    // 3. Show success
    Alert.alert('Sync Complete', `
      ${result.data.offers.length} offers
      ${result.data.bookedCruises.length} booked cruises
      ${result.data.courtesyHolds.length} holds
    `);
    
  } finally {
    setSyncing(false);
  }
}
```

### 4.3 Import Pipeline

```typescript
async function handleImport() {
  const syncResult = await getLastSyncResult();
  
  // 1. Import offers
  await importOffers(syncResult.data.offers, syncResult.data.offerSailings);
  
  // 2. Merge cruises by dedupe key
  await mergeCruises(syncResult.data.bookedCruises);
  
  // 3. Import holds
  await importCourtesyHolds(syncResult.data.courtesyHolds);
  
  // 4. Update loyalty display
  await updateLoyaltyData(syncResult.data.loyalty);
  
  // 5. Refresh UI
  queryClient.invalidateQueries(['cruises']);
  queryClient.invalidateQueries(['offers']);
}
```

### 4.4 Dedupe Logic

```typescript
function generateCruiseDedupeKey(cruise: any): string {
  return `${cruise.ship}-${cruise.sailDate}-${cruise.nights}`.toLowerCase();
}

async function mergeCruises(newCruises: RCBookedCruise[]) {
  const existing = await getStoredCruises();
  const existingKeys = new Set(existing.map(generateCruiseDedupeKey));
  
  const toAdd = newCruises.filter(c => 
    !existingKeys.has(generateCruiseDedupeKey(c))
  );
  
  await addCruises(toAdd);
  console.log(`Added ${toAdd.length} new cruises, skipped ${newCruises.length - toAdd.length} duplicates`);
}
```

---

## Phase 5: Auto-Sync Rules

### 5.1 Configuration

```typescript
interface AutoSyncConfig {
  enabled: boolean;
  frequency: 'manual' | 'daily' | 'weekly' | 'on_launch';
  lastAutoSync: number;
  notifyOnComplete: boolean;
  autoImport: boolean;
}
```

### 5.2 Triggers

| Mode | Trigger |
|------|---------|
| Manual | User taps "Sync Now" |
| Daily | Backend scheduled job (every 24h) |
| Weekly | Backend scheduled job (every 7 days) |
| On Launch | App launch if >24h since last sync |

### 5.3 Background Sync (Backend)

```typescript
// Scheduled job (e.g., cron)
async function runAutoSync() {
  const sessions = await getAutoSyncEnabledSessions();
  
  for (const session of sessions) {
    if (shouldSync(session)) {
      try {
        await performSync(session.id);
        await sendPushNotification(session.userId, 'Sync complete');
      } catch (error) {
        await sendPushNotification(session.userId, 'Sync failed - please reconnect');
      }
    }
  }
}
```

---

## Phase 6: Failover & Fallback

### 6.1 Extension Fallback

If backend scrape fails, maintain Chrome extension support:

```typescript
// In Settings, show fallback option
{syncError && (
  <Alert type="warning">
    <Text>Auto-sync failed. You can still use Chrome extensions:</Text>
    <Button title="Download Extension" onPress={downloadExtension} />
    <Button title="Import CSV Manually" onPress={openImportModal} />
  </Alert>
)}
```

### 6.2 Error Handling Matrix

| Error | Action |
|-------|--------|
| Session expired | Prompt "Please reconnect" |
| Site changed (selectors broken) | Alert + enable extension fallback |
| Rate limited | Wait + retry with backoff |
| Network error | Retry 3x then fail |
| Captcha detected | Alert + extension fallback |

---

## Deliverables Checklist

### Client (React Native)

- [ ] `app/rc-connect.tsx` - WebView login modal
- [ ] `components/RCConnectButton.tsx` - Connection trigger
- [ ] `components/RCSyncStatus.tsx` - Status display
- [ ] `components/RCSyncSection.tsx` - Settings section
- [ ] `state/RCSyncProvider.tsx` - Sync state management
- [ ] Cookie/token capture logic
- [ ] Import pipeline integration
- [ ] Auto-sync on launch option

### Backend

- [ ] `backend/trpc/routes/rc-sync.ts` - API endpoints
- [ ] `backend/scraper/rc-scraper.ts` - Playwright scraper
- [ ] `backend/scraper/csv-generator.ts` - CSV generation
- [ ] Database schema for sessions
- [ ] Encryption utilities
- [ ] Scheduled auto-sync job
- [ ] Debug screenshot storage

### Testing

- [ ] Unit tests for CSV generation
- [ ] Integration tests for scraper
- [ ] E2E test for full sync flow
- [ ] Session expiry handling tests

---

## User Experience Summary

1. **Connect:** Tap "Connect Royal Caribbean" → Log in via WebView → Done
2. **Sync:** Tap "Sync Now" → Wait ~30 seconds → See results
3. **Import:** Tap "Import into App" → Data populates automatically
4. **Auto:** Enable "Auto Sync" → App stays updated

---

## Security Considerations

1. **Data in Transit:** All API calls over HTTPS
2. **Data at Rest:** AES-256 encryption for cookies/tokens
3. **No Password Storage:** Only session cookies stored
4. **User Control:** "Disconnect" completely removes all session data
5. **Audit Log:** All sync attempts logged with timestamps
6. **Rate Limiting:** Prevent abuse of sync endpoint

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Client WebView | 2-3 days | None |
| Phase 2: Backend Sessions | 1-2 days | Database setup |
| Phase 3: Playwright Scraper | 3-5 days | Backend infrastructure |
| Phase 4: App Sync UI | 2-3 days | Phases 1-3 |
| Phase 5: Auto-Sync | 1-2 days | Phase 4 |
| Phase 6: Fallback | 1 day | Phase 4 |
| Testing & Polish | 2-3 days | All phases |

**Total:** 12-19 days

---

## Notes

- Royal Caribbean site structure may change; maintain selector flexibility
- Consider implementing a "test mode" using saved HTML snapshots
- Monitor for captcha/bot detection; may need proxy rotation
- Keep extension export as permanent fallback
