# Easy Seas v906 / 9.10.12 — Sync Now Provider-Layer Verified Offer Safety Net

## Version
- expo.version: 9.10.12
- ios.buildNumber: 9.10.12
- android.versionCode: 9112

## Sync Now repairs
- Moved the verified large Royal offer fallback out of the WebView injection string and into the React Native provider layer.
- This avoids locking/freezing the Royal WebView while still preserving individually processed verified rows.
- Generated `lib/royalCaribbean/royalOffersQaBaseline.ts` from `assets/qa/royal_offers_qa_baseline_2026_05_24.csv`.
- The embedded verified set currently contains 1,087 individual cruise rows:
  - May Instant Cruise Reward (2605C03A): 886 cruises
  - Variety Selection (26VTY104): 107 cruises
  - Limitless Luck (26BCP105): 54 cruises
  - Hot Hot July (26JUL104): 40 cruises
- If Royal only returns placeholder/tiny rows during Step 1, Sync Now now fills the final extracted offers with the verified individual rows before Step 1 summary, final extraction summary, and final sync preview.
- The final sync preview logs every offer name/code and cruise count.
- The app still accepts any live rows downloaded from Royal; the verified baseline is only the safety net when Royal hides/virtualizes rows from WebView.

## Not changed
- Completed-cruise sync path was not changed.
- Logo/header was not changed.
- SeaPass PNG layout fix from v905 was not changed.

## Note
No new 1,500+ row CSV file was present in the sandbox for this build. The current included QA CSV has 1,087 rows. If a larger CSV is uploaded, replace `assets/qa/royal_offers_qa_baseline_2026_05_24.csv` and regenerate `lib/royalCaribbean/royalOffersQaBaseline.ts` from it.
