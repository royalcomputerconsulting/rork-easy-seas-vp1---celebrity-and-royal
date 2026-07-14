# V1238 Certificate Codes + Examine Offers QA

## Version
- App version: 12.3.8
- iOS buildNumber: 12.3.8
- Android versionCode: 120308
- Runtime marker: `v12.3.8-certificate-offer-catalog-chat`

## Purpose
Fix the certificate flow so **View Offers** no longer routes to the generic cruises list, and **Examine Offers** no longer immediately triggers a fragile certificate PDF parse. The user should first see a Royal-style certificate code bank similar to the official Casino Royale certificate PDF index, with C/A tabs, Download All, and an AI chat advisor for all A/C certificate offers.

## Changes
1. Added `app/certificate-codes.tsx`.
2. Added `lib/certificates/certificateCatalog.ts` with stable A/C certificate ladders and official Royal PDF URL generation.
3. Updated the dashboard certificate card:
   - View Offers -> `/certificate-codes`
   - Examine Offers -> `/certificate-codes?chat=1`
4. Added C/A certificate tabs with all codes and point levels.
5. Added Download All A/C to scan all A and C certificate PDFs for the selected month.
6. Added code-level download by tapping a certificate code.
7. Added long-press official PDF open on a certificate code.
8. Added Examine Offers chat modal using AgentX certificateAdvisor mode.
9. Hardened mobile tRPC certificate retry handling.
10. Backend certificate explorer now accepts `certificateCodes` to inspect one code directly.
11. Certificate search alerts now convert raw JSON parse messages into user-safe retry guidance.

## Expected behavior
- View Offers opens the Certificate Codes page, not the Cruises page.
- Certificate Codes page resembles the Casino Royale code bank screen: C/A tabs, code cards, points, Download All, Examine Offers.
- Download All A/C can parse A and C certificates, but a temporary failed response does not hide the code grid.
- Tapping a code downloads/examines that single certificate.
- Examine Offers opens a chat box where the user can discuss that month’s A/C certificate levels, values, and chase strategy.

## QA
Passed:
- testV1076NativeNoRevenueCatCasino
- testV1076CasinoEnginesFunctional
- testV1077RemainingRecommendationChanges
- testV1230LoyaltySyncRepair
- testV1231CasinoSectionWiring
- testV1232RoyalOfferZeroRowPreservation
- testV1233DynamicRoyalOfferCatalog
- testV1234SharedProfilesManualAdd
- testV1235BookedCompletedSyncRules
- testV1236AskMyDataOfferIntent
- testV1237CertificateBankRobustDownload
- testV1238CertificateOfferCodesChat
