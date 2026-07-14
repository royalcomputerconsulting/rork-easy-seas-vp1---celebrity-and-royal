# EasySeas v12.3.6 — Ask My Data Offer Intent + Value Ranking QA

## Purpose

Fix Ask My Data so that questions such as:

```txt
best cruises for 2 from my offers
best offers for two
which offer sailings are best for 2 guests
```

are answered from the loaded standalone casino offer sailing catalog, not from booked or completed cruises that happen to contain old offer/value fields.

## Version

```txt
App version: 12.3.6
iOS buildNumber: 12.3.6
Android versionCode: 120306
```

## Main Rules Added

1. A query containing “from my offers”, “my offers”, “offer catalog”, “available offers”, or “best cruises for 2 from offers” activates an offer-source lock.
2. When the offer-source lock is active and standalone offer rows are loaded, Ask My Data searches only standalone loaded offer sailings.
3. Booked/completed cruises are no longer allowed to outrank standalone offers for offer-catalog questions.
4. Ask My Data now parses guest-count intent such as “for 2”, “for two”, “2 guests”, “two passengers”, and “double occupancy”.
5. Ask My Data now classifies offer guest coverage:
   - true free cruise fare for 2 guests
   - 1 guest plus discounted second guest
   - free cruise fare for 1 guest
   - dollars-off / discount offer
   - unknown coverage
6. For “for 2” questions, true free cruise fare for 2 guests receives the highest ranking boost.
7. A one-person offer or discounted-second-passenger offer can still appear, but it is ranked below true free-for-two offers and labeled clearly.
8. Result subtitles and detail text now show the guest coverage basis used for ranking.
9. AgentX system context now repeats the same rule so chat answers do not substitute booked cruises when the user asks “from my offers.”

## Files Changed

```txt
app.json
package.json
lib/askMyData.ts
state/AgentXProvider.tsx
scripts/testV1236AskMyDataOfferIntent.js
V1236_ASK_MY_DATA_OFFER_INTENT_QA.md
```

## Expected Behavior

For this query:

```txt
best cruises for 2 from my offers
```

Expected:

```txt
- Results should come from standalone loaded offer sailing rows.
- Result source badge should be Offer.
- Booked cruises should not appear unless no standalone offer rows are loaded.
- A free cruise fare for 2 guests should rank above 1+discount, one-person, or dollars-off offers.
- The interpreted intent should include standalone offer catalog only and for 2 guests.
```

Not expected:

```txt
- Harmony of the Seas 2025 completed cruise result just because it has old offer data.
- Navigator booked cruise result just because it was booked with an offer.
- One-person offers outranking true free-for-two offers.
```

## QA Command

```bash
node scripts/testV1236AskMyDataOfferIntent.js
```

## QA Passes

```txt
PASS testV1076NativeNoRevenueCatCasino
PASS testV1076CasinoEnginesFunctional
PASS testV1077RemainingRecommendationChanges
PASS testV1230LoyaltySyncRepair
PASS testV1231CasinoSectionWiring
PASS testV1232RoyalOfferZeroRowPreservation
PASS testV1233DynamicRoyalOfferCatalog
PASS testV1234SharedProfilesManualAdd
PASS testV1235BookedCompletedSyncRules
PASS testV1236AskMyDataOfferIntent
```
