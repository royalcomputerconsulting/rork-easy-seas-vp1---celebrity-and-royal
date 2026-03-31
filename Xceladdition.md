# Celebrity Cruises Integration Plan (Xceladdition)

## Overview
Add full Celebrity Cruises support to the app, enabling users to track both Royal Caribbean and Celebrity loyalty programs with a seamless toggle experience.

---

## Background

Celebrity Cruises operates two parallel loyalty programs:

### 1. Celebrity Captain's Club (Cruising Loyalty)
Rewards cruise history with points for sailing and booking with Celebrity.

**Tiers:**
- **Preview**: 0 points (Enrollment before first cruise)
- **Classic**: 2-149 points
- **Select**: 150-299 points
- **Elite**: 300-749 points
- **Elite Plus**: 750-2,999 points
- **Zenith**: 3,000+ points

### 2. Celebrity Blue Chip Club (Casino Loyalty)
Rewards play in the onboard casino with Tier Credits and Reward Points.

**Tiers:**
- **Pearl** (Base Tier)
- **Onyx**
- **Amethyst**
- **Sapphire**
- **Sapphire Plus**
- **Ruby** (Top Tier)

### Website Structure
Celebrity's website at `https://www.celebritycruises.com/blue-chip-club/offers` functions identically to Royal Caribbean's Club Royale website, meaning:
- Same offer structure
- Same scraping capabilities
- Same Chrome extension compatibility
- Same data formats (with brand differentiation)

---

## Implementation Requirements

### 1. Dual Profile System
Users can maintain separate profiles for Royal Caribbean and Celebrity Cruises with:
- Independent tracking of loyalty points and tiers
- Separate account credentials (email, member numbers)
- Unified data backup and sync

### 2. UI Toggle System
Implement a brand toggle (Royal ↔ Celebrity) in all user profile displays:
- **Toggle Style**: Same as "All/Upcoming/Completed" toggle on My Cruises (Booked) page
- **Toggle Location**: Top of "User Profile" section
- **Behavior**: Switch between Royal and Celebrity data views
- **State Persistence**: Remember user's last selected brand per session

### 3. Profile Display Locations
Update user profile sections in the following screens:
1. **Settings Page** - Main profile configuration
2. **Casino Pages** - Casino metrics and loyalty tracking
3. **Overview Pages** - Dashboard summary
4. **My Cruises Page (Top)** - Quick profile view

### 4. Settings Page Data Entry
Add Celebrity-specific input fields:
- **Celebrity Captain's Club Number** (equivalent to Crown & Anchor #)
- **Celebrity Email Address**
- **Celebrity Captain's Club Points** (cruising loyalty)
- **Blue Chip Club Points** (casino loyalty)

Maintain existing Royal Caribbean fields:
- Crown & Anchor Number
- Royal Caribbean Email
- Crown & Anchor Points
- Club Royale Points

### 5. Data Persistence
All Celebrity data must be:
- Stored in AsyncStorage alongside Royal data
- Included in data bundle exports/imports
- Backed up with regular user profile data
- Synced with backend (when AutoSync is implemented)

---

## Technical Implementation Plan

### Phase 1: Data Layer & Constants

#### 1.1 Create Celebrity Tier Constants
**File**: `constants/celebrityCaptainsClub.ts`

```typescript
export const CELEBRITY_CAPTAINS_CLUB_TIERS = [
  { name: 'Preview', min: 0, max: 1, color: '#708090' },
  { name: 'Classic', min: 2, max: 149, color: '#CD7F32' },
  { name: 'Select', min: 150, max: 299, color: '#C0C0C0' },
  { name: 'Elite', min: 300, max: 749, color: '#FFD700' },
  { name: 'Elite Plus', min: 750, max: 2999, color: '#E5E4E2' },
  { name: 'Zenith', min: 3000, max: Infinity, color: '#4169E1' },
];

export function getCaptainsClubTier(points: number) {
  return CELEBRITY_CAPTAINS_CLUB_TIERS.find(
    tier => points >= tier.min && points <= tier.max
  ) || CELEBRITY_CAPTAINS_CLUB_TIERS[0];
}

export function getPointsToNextCaptainsClubTier(points: number) {
  const currentTier = getCaptainsClubTier(points);
  const currentIndex = CELEBRITY_CAPTAINS_CLUB_TIERS.findIndex(
    t => t.name === currentTier.name
  );
  
  if (currentIndex === CELEBRITY_CAPTAINS_CLUB_TIERS.length - 1) {
    return 0; // Already at top tier
  }
  
  const nextTier = CELEBRITY_CAPTAINS_CLUB_TIERS[currentIndex + 1];
  return nextTier.min - points;
}
```

**File**: `constants/celebrityBlueChipClub.ts`

```typescript
export const CELEBRITY_BLUE_CHIP_TIERS = [
  { name: 'Pearl', level: 1, color: '#F0EAD6', benefits: [] },
  { name: 'Onyx', level: 2, color: '#353839', benefits: [] },
  { name: 'Amethyst', level: 3, color: '#9966CC', benefits: [] },
  { name: 'Sapphire', level: 4, color: '#0F52BA', benefits: [] },
  { name: 'Sapphire Plus', level: 5, color: '#0067A5', benefits: [] },
  { name: 'Ruby', level: 6, color: '#E0115F', benefits: [] },
];

export function getBlueChipTier(level: number) {
  return CELEBRITY_BLUE_CHIP_TIERS.find(tier => tier.level === level) 
    || CELEBRITY_BLUE_CHIP_TIERS[0];
}
```

#### 1.2 Update User Type Definition
**File**: `types/models.ts`

Add Celebrity profile fields to user type:

```typescript
export interface UserProfile {
  // Existing Royal Caribbean fields
  name: string;
  email: string;
  crownAndAnchorNumber?: string;
  crownAndAnchorPoints: number;
  clubRoyalePoints: number;
  
  // NEW: Celebrity Cruises fields
  celebrityEmail?: string;
  celebrityCaptainsClubNumber?: string;
  celebrityCaptainsClubPoints: number;
  celebrityBlueChipPoints: number;
  
  // NEW: Brand preference
  preferredBrand: 'royal' | 'celebrity';
}
```

#### 1.3 Update Storage Keys
**File**: `lib/storage/storageKeys.ts`

Add Celebrity-specific keys:

```typescript
export const STORAGE_KEYS = {
  // ... existing keys
  CELEBRITY_EMAIL: 'celebrity_email',
  CELEBRITY_CAPTAINS_CLUB_NUMBER: 'celebrity_captains_club_number',
  CELEBRITY_CAPTAINS_CLUB_POINTS: 'celebrity_captains_club_points',
  CELEBRITY_BLUE_CHIP_POINTS: 'celebrity_blue_chip_points',
  PREFERRED_BRAND: 'preferred_brand',
};
```

---

### Phase 2: State Management

#### 2.1 Update UserProvider
**File**: `state/UserProvider.tsx`

Extend state to include Celebrity data:

```typescript
interface UserState {
  // Royal Caribbean
  royalProfile: {
    name: string;
    email: string;
    crownAndAnchorNumber?: string;
    crownAndAnchorPoints: number;
    clubRoyalePoints: number;
  };
  
  // Celebrity Cruises
  celebrityProfile: {
    name: string; // Can share with Royal or be separate
    email: string;
    captainsClubNumber?: string;
    captainsClubPoints: number;
    blueChipPoints: number;
  };
  
  // UI State
  activeBrand: 'royal' | 'celebrity';
}
```

Add methods:
- `setCelebrityEmail(email: string)`
- `setCelebrityCaptainsClubNumber(number: string)`
- `setCelebrityCaptainsClubPoints(points: number)`
- `setCelebrityBlueChipPoints(points: number)`
- `setActiveBrand(brand: 'royal' | 'celebrity')`
- `getActiveProfile()` - returns current profile based on activeBrand

Load/save both profiles from AsyncStorage.

#### 2.2 Update CelebrityProvider
**File**: `state/CelebrityProvider.tsx`

Currently minimal, expand to:
- Track Celebrity-specific cruise data
- Manage Celebrity offers
- Handle Celebrity sync sessions (future AutoSync)

---

### Phase 3: UI Components

#### 3.1 Create Brand Toggle Component
**File**: `components/ui/BrandToggle.tsx`

Create a toggle component matching the style of the "All/Upcoming/Completed" toggle:

```typescript
interface BrandToggleProps {
  activeBrand: 'royal' | 'celebrity';
  onToggle: (brand: 'royal' | 'celebrity') => void;
}
```

Visual style:
- Two-option segmented control
- "Royal Caribbean" | "Celebrity Cruises"
- Smooth animation on switch
- Brand colors (Royal: navy blue, Celebrity: modern blue)

#### 3.2 Update UserProfileCard
**File**: `components/ui/UserProfileCard.tsx`

Add brand toggle at the top:
```
┌─────────────────────────────────────┐
│  [Royal Caribbean | Celebrity]      │ ← Toggle
├─────────────────────────────────────┤
│  Profile content (dynamic)          │
│  - Tier progress bars               │
│  - Points display                   │
│  - Member number                    │
└─────────────────────────────────────┘
```

When Royal is active:
- Show Crown & Anchor tier progress
- Show Club Royale points
- Display Crown & Anchor number

When Celebrity is active:
- Show Captain's Club tier progress
- Show Blue Chip Club points
- Display Captain's Club number

#### 3.3 Create Celebrity Tier Progress Components

**File**: `components/ui/CelebrityCaptainsClubProgress.tsx`
- Visual progress bar for Captain's Club tiers
- Similar to Crown & Anchor progress bar
- Shows current tier, points, and points to next tier

**File**: `components/ui/CelebrityBlueChipProgress.tsx`
- Visual progress bar for Blue Chip Club tiers
- Similar to Club Royale tier display

---

### Phase 4: Settings Page Updates

#### 4.1 Add Celebrity Section
**File**: `app/(tabs)/settings.tsx`

Add new section after Royal Caribbean profile section:

```
┌─────────────────────────────────────┐
│  CELEBRITY CRUISES PROFILE          │
├─────────────────────────────────────┤
│  Captain's Club Number              │
│  [________________]                 │
│                                     │
│  Celebrity Email                    │
│  [________________]                 │
│                                     │
│  Captain's Club Points              │
│  [________________]                 │
│                                     │
│  Blue Chip Club Points              │
│  [________________]                 │
└─────────────────────────────────────┘
```

All inputs should:
- Save to UserProvider on change
- Persist to AsyncStorage
- Validate input (numbers for points)

---

### Phase 5: Update All Profile Displays

#### 5.1 Settings Page
- Add brand toggle to user profile section
- Show active brand's data in progress bars
- Display appropriate tier badges

#### 5.2 Casino Pages (analytics.tsx, etc.)
- Add brand toggle at top
- Filter casino sessions by brand (future enhancement)
- Show appropriate loyalty tier

#### 5.3 Overview Page (index.tsx)
- Add brand toggle to user profile display
- Show active brand's upcoming cruises
- Display brand-specific tier progress

#### 5.4 My Cruises Page (booked.tsx)
- Add brand toggle at top of page
- Filter cruises by brand
- Show brand-specific offers

---

### Phase 6: Data Backup & Import/Export

#### 6.1 Update Bundle Operations
**File**: `lib/dataBundle/bundleOperations.ts`

Include Celebrity data in bundles:
```typescript
interface DataBundle {
  // ... existing fields
  celebrityProfile: {
    email: string;
    captainsClubNumber?: string;
    captainsClubPoints: number;
    blueChipPoints: number;
  };
  celebrityCruises: Cruise[];
  celebrityOffers: Offer[];
}
```

#### 6.2 Update Import/Export Functions
**File**: `lib/importExport.ts`

Ensure Celebrity data is included in:
- JSON exports
- CSV imports (separate Celebrity CSV schema)
- Bundle downloads
- AutoSync operations (future)

---

### Phase 7: Future AutoSync Integration

When AutoSync is implemented, add Celebrity endpoints:

**Backend Routes:**
- `POST /api/celebrity/session` - Store Celebrity login session
- `POST /api/celebrity/sync` - Scrape Celebrity website
- `GET /api/celebrity/status` - Check sync status
- `DELETE /api/celebrity/session` - Disconnect

**Scraping Targets:**
- `https://www.celebritycruises.com/blue-chip-club/offers`
- `https://www.celebritycruises.com/account/upcoming-cruises`
- `https://www.celebritycruises.com/account/courtesy-holds`
- `https://www.celebritycruises.com/account/past-cruises`
- `https://www.celebrityccruises.com/account/loyalty`

---

## Chrome Extension Updates

### Extension 1: "Show All Offers" Button
**No changes required** - Already works with Celebrity website structure

### Extension 2: "Scrape Website" Button
**File**: `assets/cext/scraper.content.js`

Add Celebrity domain detection:
```javascript
const isCelebrity = window.location.hostname.includes('celebritycruises.com');
const isRoyal = window.location.hostname.includes('royalcaribbean.com');

// Set brand flag in scraped data
data.brand = isCelebrity ? 'celebrity' : 'royal';
```

Update CSV exports to include brand column:
```csv
Brand,Offer Code,Offer Name,...
Celebrity,CELEB123,Premium Balcony Offer,...
```

---

## Testing Plan

### Test Scenarios

1. **Profile Toggle**
   - [ ] Toggle switches between Royal and Celebrity data
   - [ ] Progress bars update correctly
   - [ ] Tier badges display appropriate brand
   - [ ] Toggle state persists across app restarts

2. **Data Entry**
   - [ ] Celebrity fields save to AsyncStorage
   - [ ] Validation works for numeric fields
   - [ ] Data persists after app restart

3. **Data Backup**
   - [ ] Export includes both Royal and Celebrity data
   - [ ] Import restores both profiles correctly
   - [ ] Bundle operations preserve all fields

4. **UI Consistency**
   - [ ] Toggle appears in all required locations (settings, casino, overview, my cruises)
   - [ ] Brand colors consistent throughout
   - [ ] Progress bars animate smoothly

5. **Edge Cases**
   - [ ] Handle users with only Royal profile
   - [ ] Handle users with only Celebrity profile
   - [ ] Handle users with both profiles
   - [ ] Handle zero points (Preview tier)
   - [ ] Handle max tier (Zenith / Ruby)

---

## Migration Strategy

### Existing Users
Users upgrading to this version will have:
- Royal profile data preserved
- Celebrity fields initialized to zero/empty
- `activeBrand` defaulted to 'royal'
- No disruption to existing functionality

### Data Migration
```typescript
// On app load, check for Celebrity fields
// If missing, initialize with defaults
async function migrateToV2() {
  const celebrityEmail = await AsyncStorage.getItem(STORAGE_KEYS.CELEBRITY_EMAIL);
  if (celebrityEmail === null) {
    // First time with Celebrity support
    await AsyncStorage.setItem(STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_POINTS, '0');
    await AsyncStorage.setItem(STORAGE_KEYS.CELEBRITY_BLUE_CHIP_POINTS, '0');
    await AsyncStorage.setItem(STORAGE_KEYS.PREFERRED_BRAND, 'royal');
  }
}
```

---

## UI/UX Guidelines

### Brand Identity

**Royal Caribbean:**
- Primary Color: Navy Blue (#003580)
- Accent: Gold (#FFD700)
- Associated with "Crown & Anchor" and "Club Royale"

**Celebrity Cruises:**
- Primary Color: Modern Blue (#0077BE)
- Accent: Platinum/Silver (#E5E4E2)
- Associated with "Captain's Club" and "Blue Chip Club"

### Toggle Design
Match existing toggle from My Cruises page:
- Rounded corners
- Smooth animation (200ms)
- Active state clearly highlighted
- Inactive state dimmed but readable

### Progress Bars
- Match existing Crown & Anchor style
- Use brand-appropriate colors
- Show numeric progress (e.g., "1050 / 3000 to Zenith")
- Include tier name and icon

---

## Timeline Estimate

- **Phase 1** (Constants & Types): 30 minutes
- **Phase 2** (State Management): 45 minutes
- **Phase 3** (UI Components): 1.5 hours
- **Phase 4** (Settings Page): 45 minutes
- **Phase 5** (Update All Displays): 1 hour
- **Phase 6** (Backup & Export): 30 minutes
- **Phase 7** (Future AutoSync): TBD (requires backend)

**Total Core Implementation**: ~5 hours

---

## Success Criteria

✅ Users can maintain separate Royal and Celebrity profiles
✅ Toggle seamlessly switches between brands in all locations
✅ Celebrity tier progress displays correctly
✅ All data persists and backs up properly
✅ Chrome extensions work with Celebrity website
✅ No disruption to existing Royal Caribbean functionality
✅ Code is maintainable and follows existing patterns

---

## Future Enhancements

1. **Brand-Specific Cruise Filtering**
   - Filter cruise list by brand
   - Show only relevant offers per brand

2. **Cross-Brand Analytics**
   - Compare Royal vs Celebrity performance
   - Aggregate casino statistics

3. **Brand-Specific Notifications**
   - Separate alert rules per brand
   - Brand-aware PPH goals

4. **Multi-Brand Calendar**
   - Visual distinction for Royal vs Celebrity cruises
   - Brand color coding

---

## Notes

- Celebrity website structure is confirmed identical to Royal Caribbean
- Existing Chrome extensions require minimal updates (brand tagging)
- User has Elite Plus status (1050 points) on Celebrity
- Blue Chip Club uses tier credits (implementation may need refinement based on actual Celebrity API responses)

---

*Document Created: 2026-01-05*
*Status: Ready for Implementation*