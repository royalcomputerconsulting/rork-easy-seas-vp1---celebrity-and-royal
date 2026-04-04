# Last 14 Days Change Log

This list is compiled from the available request/history files in this workspace and summarizes the main implementations and changes completed during the recent work window.

## 1. Day Agenda header cleanup
- Removed the Day Agenda runtime fingerprint display.
- Removed the timed-block count line.
- Removed the “strong luck day” label.
- Kept only the date and `Luck #` chip at the top of the screen.
- Main file: `expo/app/day-agenda.tsx`
- History snapshot: `ik57o7imsfy6lfobavh6d`

## 2. Duplicate-key warning fix on booked cruise cards
- Fixed duplicate React keys when the same itinerary port appeared more than once.
- Updated port chip keys to include an index so repeated destinations no longer collide.
- Main file: `expo/components/CruiseCard.tsx`
- History snapshot: `uuals2euqw94oiaskgzzh`

## 3. Offer Command Center redesign
- Reworked the Offer Command Center into one cleaner summary block.
- Kept total value, cruises, offers, and the two sort buttons.
- Merged the “1 expiring soon” pill information into the main card instead of showing it as a separate duplicate pill.
- Main files:
  - `expo/components/CasinoOfferCard.tsx`
  - `expo/app/(tabs)/(overview)/index.tsx`
- History snapshot: `otosb3z6mwa2ueqb5pgon`

## 4. Subscription system moved to monthly-only
- Removed annual subscription positioning/copy.
- Standardized the product messaging to `$9.99/month`.
- Added a 3-day grace period for non-admin users.
- Kept admins exempt from subscription enforcement.
- Cleaned related settings/profile/help/paywall copy.
- Updated RevenueCat-facing configuration during that change window.
- Main files included:
  - `expo/state/EntitlementProvider.tsx`
  - `expo/app/paywall.tsx`
  - `expo/app/paywall-monthly.tsx`
  - `expo/app/(tabs)/settings.tsx`
  - `expo/components/ui/UserProfileCard.tsx`
  - `expo/components/UserManualModal.tsx`
  - `expo/app/_layout.tsx`
- History snapshot: `1j6p8tga2337n79hguje5`

## 5. Settings page cleanup
- Removed the runtime fingerprint block from below the subscription section.
- Simplified the subscription/support copy by removing the runtime-fingerprint explanation.
- Main file: `expo/app/(tabs)/settings.tsx`
- History snapshot: `78uq8562lhdcairsqikkf`

## 6. Cruise, offer, and cruise-detail visual redesign pass
- Redesigned cruise cards to be cleaner and more compact.
- Redesigned offer cards and cruise detail cards while keeping the existing visible data.
- Reduced the Offer Command Center footprint and fixed contrast/visibility issues.
- Applied the visual clean-up requested across offers/cruises screens.
- Main files:
  - `expo/components/CasinoOfferCard.tsx`
  - `expo/components/CruiseCard.tsx`
  - `expo/components/OfferCard.tsx`
  - `expo/app/(tabs)/(overview)/cruise-details.tsx`
- History snapshot: `njhrvhe8irlruxos37fbd`

## 7. Club Royale / Royal Caribbean sync window recovery
- Fixed missing sync/browser window behavior in the Club Royale sync flow.
- Restored browser visibility/default access on the sync page.
- Added guarded sync confirmation handling.
- Forced popup/login links back into the in-app sync browser so sign-in would remain accessible.
- Added recovery behavior if the WebView/browser was interrupted.
- Main file: `expo/app/royal-caribbean-sync.tsx`
- Related history snapshots:
  - `xciqtovczecxeggl5s5qf`
  - `5lr4d9vf1y6eop75rqdb5`

## 8. Cruise card content/data correction pass
- Replaced the nights badge treatment with cruise-related imagery on the card.
- Adjusted layout so the full ship name and itinerary stay visible.
- Added cruise/beach/ship background imagery treatment.
- Fixed itinerary/nights rendering so the number of nights was not repeated incorrectly.
- Main file: `expo/components/CruiseCard.tsx`
- History snapshot: `0urd4f3fnuhkejnfqfwca`

## 9. Root-level SeaPass Generator rebuild pack created
- Created the `SEAPASSGENERATOR` folder at project root.
- Added source snapshots, architecture notes, rebuild guide, manifest, notes, route snippets, backend proxy snippet, and package/tsconfig snapshots.
- Main history snapshot: `vqkz08myp00zozrsge6ti`

## 10. Day Agenda + Daily Luck documentation added to the rebuild pack
- Added documentation describing:
  - how Day Agenda pages are generated
  - how daily luck is calculated, stored, retrieved, and displayed
  - how the 2026 Earth Rooster override works
  - which files are required to rebuild the day-agenda/luck pipeline
- Added supporting source snapshots for the Day Agenda + Daily Luck system into `SEAPASSGENERATOR/code/expo/...`
- Main files added this session:
  - `SEAPASSGENERATOR/DAY_AGENDA_DAILY_LUCK_SYSTEM.md`
  - `SEAPASSGENERATOR/code/expo/app/day-agenda.tsx`
  - `SEAPASSGENERATOR/code/expo/lib/dailyLuck.ts`
  - `SEAPASSGENERATOR/code/expo/lib/date.ts`
  - `SEAPASSGENERATOR/code/expo/lib/dailyLuck/signs.ts`
  - `SEAPASSGENERATOR/code/expo/types/daily-luck.ts`
  - `SEAPASSGENERATOR/code/expo/state/UserProvider.tsx`
  - `SEAPASSGENERATOR/code/expo/components/DailyLuckReport.tsx`
  - `SEAPASSGENERATOR/code/expo/components/daily-luck/DailyLuckExpandedCard.tsx`
  - `SEAPASSGENERATOR/code/expo/constants/earthRoosterLuck2026.ts`

## Compact summary by area
### Agenda / luck
- Day Agenda top section simplified
- Daily Luck documentation archived
- Day Agenda/luck source snapshots archived

### Offers / cruises
- Offer Command Center redesigned
- Cruise cards, offer cards, and cruise detail cards cleaned up
- Duplicate-key warning fixed
- Cruise itinerary/nights rendering corrected

### Subscription / settings
- Monthly-only subscription model
- 3-day grace period for non-admins
- annual subscription language removed
- settings runtime fingerprint removed

### Sync / auth
- Club Royale sync window/browser restored and hardened

### Backup / rebuild assets
- SeaPass Generator rebuild pack created and expanded
