# Easy Seas User Manual

**App Version:** 9.11.34  
**Manual Version:** v1042 Casino Intelligence Phase 5 QA and Regression Protection  
**Last Updated:** June 2026  
**Build Lineage:** v1038 Phase 1 engines, v1039 Phase 2 components, v1040 Phase 3 screens, v1041 Phase 4 AgentX context, and v1042 Phase 5 regression QA  

Easy Seas is a local-first cruise, casino-offer, loyalty, itinerary, weather, and slot-machine planning app for managing Royal Caribbean, Celebrity, Silversea, Carnival, and related cruise data. It is designed to help organize offers, available cruises, booked cruises, completed cruise history, casino sessions, certificates, crew notes, calendar events, maritime weather alerts, SeaPass mockups, and backups in one place.

This manual reflects the latest app changes through the SeaPass Generator release-candidate fixes, Maritime Weather accordion behavior, Star of the Seas itinerary weather correction, dashboard count fixes, the Casino Intelligence Phase 1 engines, Phase 2 reusable intelligence UI components, Phase 3 screen integration, Phase 4 AgentX context integration, Phase 5 full regression testing/protection, and the 9.11.26+ versioning rule.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Navigation](#navigation)
3. [Settings and Data Overview](#settings-and-data-overview)
4. [Sync, Import, Export, and Backups](#sync-import-export-and-backups)
5. [Offers Dashboard](#offers-dashboard)
6. [Cruises / Available Cruises](#cruises--available-cruises)
7. [Booked Cruises](#booked-cruises)
8. [Cruise Details and Cruise Itinerary Booklet](#cruise-details-and-cruise-itinerary-booklet)
9. [Maritime Weather and Rough-Seas Alerts](#maritime-weather-and-rough-seas-alerts)
10. [Calendar, Day Agenda, and Events](#calendar-day-agenda-and-events)
11. [Casino Analytics](#casino-analytics)
12. [Slots and Machine Atlas](#slots-and-machine-atlas)
13. [Certificates](#certificates)
14. [SeaPass Generator](#seapass-generator)
15. [AgentX, Ask My Data, and Advisor Tools](#agentx-ask-my-data-and-advisor-tools)
16. [Crew Recognition](#crew-recognition)
17. [Subscription, Access, and Admin Tools](#subscription-access-and-admin-tools)
18. [Data Accuracy Rules](#data-accuracy-rules)
19. [Versioning Rule](#versioning-rule)
20. [Troubleshooting](#troubleshooting)
21. [Legal and Disclaimer](#legal-and-disclaimer)

---

## Core Concepts

Easy Seas separates cruise data into different lanes so counts and screens stay accurate.

### Available Cruises

Available Cruises are eligible cruise sailings imported from casino offers or certificate/offer data. They are not necessarily booked. The Cruises tab and dashboard count should label this clearly as **Available Cruises**, not simply “Cruises.”

### Booked Cruises

Booked Cruises are confirmed reservations or manually entered upcoming cruises. Booked counts should be based on actual active booked/upcoming cruise records, not all available cruise rows.

### Completed Cruises

Completed Cruises are historical sailings used for loyalty, points, casino performance, value, and travel history. Completed cruises should not inflate active booked counts.

### Casino Offers

Casino Offers represent actual offer codes and offer records in the app. The Offers count must reflect the real total number of offer records in the system, not only alert cards or visible active offers.

### Certificates

Certificates are individual casino certificate records with offer code, expiration, redemption, trade-in/free-play/OBC info, and linked sailing context where available.

### Cruise Itinerary Booklet

The Cruise Itinerary Booklet is an editable booked-cruise detail packet. It is meant to present clean itinerary, travel, casino, hotel, flight, transfer, notes, and export data for each booked cruise.

### Maritime Weather

Weather and rough-seas cards are grouped under **Maritime Weather** accordions. These accordions should default to closed, but when alerts exist, the closed tab must show an alert count so the user knows to open it.

---

## Navigation

Easy Seas uses bottom tabs and supporting screens.

### Bottom Tabs

- **Offers** — casino offers, certificates, featured offers, alerts, and offer opportunities.
- **Cruises** — available sailings, filters, scheduling, back-to-back planning, and cruise opportunity review.
- **Booked** — confirmed cruises, upcoming/completed history, portfolio stats, weather alerts, and details.
- **Calendar** — events, cruise days, port days, sea days, day agenda, and travel planning.
- **Casino** — casino sessions, PPH, win/loss, calculators, W2-G tracking, and performance analytics.
- **Slots** — machine atlas, favorites, ship filters, AP notes, machine sessions, and exports.
- **Settings** — profile, sync, imports, exports, backups, subscription, user manual, and admin tools.

### Supporting Screens

- **Cruise Details** — detailed available/booked cruise record.
- **Offer Details** — offer-specific sailing and value detail.
- **Royal / Celebrity Sync** — embedded casino sync and review workflow.
- **Carnival Sync** — Carnival cruise sync area where enabled.
- **Pricing Summary** — price and history tools.
- **Import Cruises** — import booked/completed cruise data.
- **Import Review** — review staged imports before applying.
- **Day Agenda** — day-by-day cruise/event planning.
- **Passenger Calendar** — passenger-focused cruise calendar.
- **War Room** — planning/control-room view.
- **Port History** — historical port and itinerary lookup.
- **Ask My Data / Learn the System** — data Q&A and education tools.
- **SeaPass Generator** — creates the accurate SeaPass-style card preview/export.

---

## Settings and Data Overview

The Settings screen includes app totals, quick actions, profile filters, sync tools, imports, exports, backups, support, and admin features.

### Data Overview Counts

The top data card should show accurate totals:

- **Available Cruises** — imported eligible/available cruise sailing records.
- **Booked** — active booked/upcoming cruise records, with completed count separately where shown.
- **Offers** — real total casino offer records in the app.
- **Events** — imported and generated calendar events.
- **Machines** — machine atlas records.
- **Crew** — crew recognition entries.

### Profile / Account Filtering

Settings and main screens may include filters for:

- All users
- User
- Second User
- Brand filters such as Royal Caribbean, Celebrity, Silversea, or Carnival
- Program filters such as Club Royale, Blue Chip, Venetian Society, or other supported programs

Profile filtering should never leak another user’s private records into the current user’s filtered view.

### Quick Actions

Common actions include:

- **Sync Royal / Celebrity Casino**
- **Sync Carnival Cruises**
- **Pricing Summary & History**
- **Load Import Offers.CSV**
- **Review Import Assignments**
- **Save All**
- **Load Backup**
- **Export Log / Diagnostic Export** where available

---

## Sync, Import, Export, and Backups

### Royal / Celebrity Sync

The Royal/Celebrity sync flow is designed to collect casino offers, eligible sailings, booked cruises, completed cruises, and loyalty data. The intended pattern is:

1. Open sync from Settings.
2. Log into the supported cruise/casino site when prompted.
3. Let the app scrape or detect available data.
4. Review staged data/counts.
5. Apply only after reviewing the results.
6. Export logs if there is a mismatch or failed section.

The sync system should not blindly overwrite manually corrected data without review.

### Import Workflows

Supported import areas include:

- Offers CSV
- Booked cruise CSV
- Completed cruise spreadsheet/data
- Machines JSON
- Calendar / ICS data
- Full Easy Seas backup JSON

### Export Workflows

Supported export areas include:

- Full app data backup
- Offers CSV
- Booked cruises CSV
- Calendar / ICS output
- Machines JSON or strategy exports
- Logs / diagnostic exports
- SeaPass PNG/PDF export
- Cruise Itinerary Booklet PNG export

### Backup Best Practice

Before every new TestFlight build or major data operation:

1. Go to Settings.
2. Export All App Data.
3. Save the backup somewhere outside the app.
4. Only then import, sync, reset, or install a new build.

---

## Offers Dashboard

The Offers tab is the command center for casino offers, certificates, alerts, and offer opportunities.

### Main Offer Cards

Offer cards may show:

- Offer code
- Offer name
- Redeem-by date
- Expiration date
- Cabin eligibility
- Guests covered
- Trade-in value
- Free play
- Onboard credit
- Perks
- Eligible cruises
- Value calculations
- Used/expired/booked status

### Offer Count Rule

The displayed **Offers** count must use actual offer records in app data. It should not be based only on alerts, only active cards, or only one subset of offers. If Settings shows 4 offers, dashboard/summary areas should not show 1 offer unless the label clearly means a filtered subset.

### Offer CSV Schema

The supported offer export/import schema is the 20-column Easy Seas offer schema:

1. Ship Name
2. Sailing Date
3. Itinerary
4. Offer Code
5. Offer Name
6. Room Type
7. Guests Info
8. Perks
9. Ship Class
10. Trade-In Value
11. Offer Expiry Date
12. Price Interior
13. Price Ocean View
14. Price Balcony
15. Price Suite
16. Taxes & Fees
17. Ports & Times
18. Offer Type/Category
19. Nights
20. Departure Port

Do not add stray columns such as “Itinerary Data Last Updated” to this export. Do not parse “Multiple Offers” as a separate fake offer unless specifically supported by data.

---

## Cruises / Available Cruises

The Cruises tab is for evaluating eligible sailings before booking.

### Filters and Views

Typical controls include:

- All / Available / Booked-linked views
- Brand
- Program
- Ship
- Destination
- Date range
- Cabin class
- Nights
- Offer code
- No-conflict filter
- Back-to-back finder
- Sort by date, value, nights, or ship

### Available Cruises Label

The app should label the main imported sailing count as **Available Cruises** so it is clear these are not all booked cruises.

### Back-to-Back Planning

The app can help identify consecutive cruises and schedule fits. The user must still confirm eligibility, certificate rules, offer stacking, cabin continuity, and cruise-line policy before booking.

---

## Booked Cruises

The Booked tab tracks confirmed cruise records and completed cruise history.

### Booked Count Rule

Booked count should show active booked/upcoming cruises. Completed cruises may be shown separately as “done,” “completed,” or historical, but should not inflate upcoming booked totals.

### Booked Cruise Fields

Booked records may include:

- Ship
- Sailing date
- Return date
- Nights
- Itinerary
- Departure port
- Cabin / stateroom
- Cabin category
- Reservation number
- Booking ID
- Guest names
- Offer/certificate applied
- Taxes and fees
- Amount paid
- Balance
- Casino points
- C&A points
- Captain’s Club / Celebrity values where relevant
- Notes
- Crew recognition

### Statuses

- Upcoming
- Current / In progress
- Completed
- Cancelled / inactive
- Manual record
- Imported record

---

## Cruise Details and Cruise Itinerary Booklet

The Cruise Details screen can open or show detailed booked-cruise context. The Cruise Itinerary Booklet is an editable, clean-format booklet view for a booked cruise.

### Booklet Purpose

The booklet is meant to act as a neat cruise packet, including:

- Cruise summary
- Ship and itinerary
- Guests
- Reservation details
- Cabin details
- Offer/casino value
- Taxes/fees and paid/balance info
- Flight/hotel/transfer notes
- Important travel notes
- Port schedule
- Current cruise badge when applicable
- Needs Review / Ready status
- Exportable PNG of the exact booklet layout

### Editing Rule

Manual booklet fields should be saved to the cruise record and protected from being overwritten by later sync data unless the user intentionally updates them.

---

## Maritime Weather and Rough-Seas Alerts

Weather sections throughout Easy Seas should be organized under an accordion titled **Maritime Weather**.

### Default State

Maritime Weather should default to **closed** so the app stays clean and avoids overwhelming the user.

### Alert Badge Rule

Even while closed, the Maritime Weather accordion must scan the weather/alert data. If any rough-seas, storm, squall, rain-risk, high-wind, swell, or marine alert exists, the closed accordion should visibly show an alert count such as:

- **1 Alert**
- **2 Alerts**
- **Watch**
- **Needs attention**

This warns the user to open the section.

### Accurate Port Weather Rule

Weather must be based on the actual itinerary location for each card. The app should not invent a generic port just because the cruise is in a region.

For example, Star of the Seas July 5–12, 2026 must use:

- Port Canaveral / Orlando embarkation
- Perfect Day at CocoCay
- Cruising / appropriate marine zone
- Charlotte Amalie, St. Thomas
- **Basseterre, St. Kitts & Nevis**
- Cruising / appropriate return marine zones
- Port Canaveral / Orlando return

It must not label Day 5 as Philipsburg when the itinerary says Basseterre, St. Kitts & Nevis.

### Sea Days

For sea days, the app should use a relevant marine zone or midpoint estimate instead of pretending the ship is docked at a named port.

---

## Calendar, Day Agenda, and Events

The Calendar tab combines imported events, cruise-generated events, and user-created events.

### Calendar Views

- Events list
- Week view
- Month view
- 90-day view
- Day Agenda
- Passenger Calendar

### Generated Cruise Events

The app may generate:

- Embarkation
- Disembarkation
- Port days
- Sea days
- Casino open/closed windows
- Offer deadlines
- Certificate deadlines
- Final payment reminders where available

### Day Agenda

Day Agenda shows a focused date view with cruise timing, events, port/casino context, and Maritime Weather sections. Weather cards in Day Agenda should also live under the Maritime Weather accordion and default to closed unless opened.

---

## Casino Analytics

The Casino tab helps track casino play and performance.

### Casino Session Tracker

Session fields may include:

- Ship
- Casino / location
- Machine
- Denomination
- Bet size
- Coin-in
- Coin-out
- Win/loss
- Points earned
- Session duration
- Notes
- Taxable win / W2-G info

### Analytics Areas

- Intelligence summary
- Charts
- Session history
- PPH / points per hour
- ROI projections
- Risk charts
- W2-G tracker
- Comp value calculator
- What-if simulator

Easy Seas is a tracking and planning tool only. It is not gambling advice.

---

## Slots and Machine Atlas

The Slots tab manages slot-machine data, strategy notes, favorites, and sessions.

### Machine Data

Machine records may include:

- Name
- Manufacturer
- Cabinet/family
- Denomination
- Ship availability
- AP notes
- Trigger notes
- Walk-away rules
- Personal sessions
- Favorites
- Photos or notes where supported

### Exports

Machine data can be exported for backup or strategy review. Large machine sets may require incremental export behavior.

---

## Certificates

Certificates may come from imported PDFs, manual entry, or sync/import data.

### Certificate Fields

- Offer code
- Certificate name
- Issue date
- Redeem-by date
- Expiration date
- Cabin eligibility
- Guests covered
- Trade-in value
- Free play
- Onboard credit
- Perks
- Linked cruise
- Status
- Notes

### Certificate Warnings

The app may show warnings for:

- Expired certificates
- Expiring soon
- Missing PDF match
- Missing offer match
- Already used/booked certificates
- Conflicting cruise dates

---

## SeaPass Generator

The SeaPass Generator creates a Royal Caribbean-style SeaPass card preview and export.

### Current Design Rule

The generator should use the approved accurate SeaPass shell and make only the required overlays. It should not rebuild the whole pass from scratch.

### Current Defaults

The latest intended default mockup values are:

- Boarding time: **10:30 am**
- Sailing date: **Jul 5**
- Deck: **10**
- Stateroom: **10134**
- Muster station: **A4**
- Reservation number: **182213**
- Ship / ST Code: **ST**
- Port: **ORLANDO (PORT CANAVERAL),...**

### Shell vs Editable Defaults

The underlying approved shell may contain baked-in values such as `QN`, `Apr 07`, and older port text. The editable defaults are the values the generator should show to the user.

These must remain separate:

- **Shell baseline values** = what is physically baked into the approved screenshot.
- **Editable defaults** = what the user sees and resets to.

The renderer must compare edited values against the shell baseline when deciding whether to paint an overlay. This is what allows **ST** to replace a baked-in **QN**.

### Key Symbol Rule

The Key symbol must appear exactly once.

- If the approved shell already includes the Key, do not draw a second Key.
- Do not draw a purple box behind the Key.
- Do not stack multiple Key symbols.
- The final PNG/PDF should match the live preview.

### Date Alignment Rule

The `Jul 5` date must match the original SeaPass date geometry as closely as possible:

- same general right alignment
- same visual size as the original shell date
- same top-right date position relative to boarding time
- no extra low/right drift

### Ship Code Rule

The ship code should render as **ST** for Star of the Seas by default. It should match the original SeaPass font size and weight as closely as possible and should not look oversized compared with the baked-in shell text.

### Port Text Rule

The port is intentionally shortened to:

`ORLANDO (PORT CANAVERAL),...`

This prevents the long Orlando / Port Canaveral text from overflowing or being cut off in an ugly way.

### Export Rule

PNG and PDF exports should capture only the clean SeaPass card, not:

- the keyboard
- app chrome
- crop controls
- blank backgrounds
- overlay-only graphics
- duplicate symbols

---

## AgentX, Ask My Data, and Advisor Tools

Easy Seas includes assistant-style planning and analysis tools.

### AgentX / Advisor

These tools help summarize and evaluate:

- best value offers
- available cruises that fit a schedule
- certificate opportunities
- point/tier impact
- casino planning context
- booking conflicts
- back-to-back opportunities

### Ask My Data

Ask My Data is intended to answer questions from the app’s local data, such as which cruises are booked, which offers are active, or how many machines/events/crew records exist.

Assistant output should be treated as planning support and should be verified against source records before booking or spending money.

---

## Crew Recognition

Crew tools help track employee names, departments, ships, roles, recognition notes, and future shout-outs.

Typical fields include:

- Name
- Department
- Ship
- Sailing
- Role
- Notes
- Favorite/priority status
- Recognition/export readiness

---

## Subscription, Access, and Admin Tools

### Subscription

Settings may include subscription status, purchase/restore controls, and app-store management links.

### Admin Tools

Admin-only tools may include:

- email whitelist management
- machine imports/exports
- completed cruise imports
- SeaPass generator utilities
- certificate/import tools
- reset/destructive tools

Admin actions should be used carefully and only after export/backup.

---

## Data Accuracy Rules

Use these rules when checking whether the app is correct:

1. **Available Cruises** are not the same as booked cruises.
2. **Booked** count should reflect active booked/upcoming records.
3. **Offers** count should reflect actual offer records.
4. **Completed** cruises should be separate from upcoming bookings.
5. Weather should be tied to actual itinerary ports, not guessed generic ports.
6. Manual booklet edits should be preserved.
7. SeaPass should use the approved shell and only minimal overlays.
8. Exports should match live previews.
9. Sync should stage/review before commit where possible.
10. Backups should be made before destructive actions or new TestFlight builds.

---


## Casino Intelligence Phase 5 Testing and Regression Protection (v1042 / 9.11.34)

Version 9.11.34 completes the Casino Intelligence implementation plan with a full regression and QA protection pass. This phase does not add new visible intelligence cards; it validates the Phase 1 engines, Phase 2 components, Phase 3 screen integrations, and Phase 4 AgentX context.

Phase 5 adds:

- `scripts/testPhase5FullRegression.ts` — a full regression harness covering date utilities, certificate expiration, Casino Opportunity Score, Best Play Today, Host View, static UI integration checks, AgentX context checks, and protected-system file hashes.
- `scripts/protectedSystemsManifest.json` — a locked SHA-256 manifest for protected SeaPass, sync, extension, Maritime Weather, certificate PDF, and backup/restore files.
- `npm run test:phase1`, `npm run test:phase3`, `npm run test:phase4`, and `npm run test:phase5` script entries for repeatable engine and integration checks.

The Phase 5 guardrails are:

- SeaPass rendering/export and Key behavior remain unchanged.
- Royal/Celebrity sync and Chrome extension scraping remain unchanged.
- Certificate PDF scraping remains unchanged.
- Maritime Weather remains unchanged.
- Backup/restore remains unchanged.
- Expired certificates remain visible and are not auto-deleted.
- Incomplete itineraries must show warnings instead of fake precision.

Phase 5 source-level QA confirms the Star of the Seas July 5–12, 2026 hard-map still uses **Basseterre, St. Kitts & Nevis** and does not fabricate Philipsburg. Physical TestFlight/device QA is still required before App Store submission because native image export, device storage, and Expo runtime behavior cannot be fully proven from source-level tests alone.

## Versioning Rule

Current app version after this Phase 5 QA/regression build: **9.11.34**.

The versioning rule is:

- v1035 metadata build was **9.11.26**.
- v1038 Phase 1 engine build was **9.11.29**.
- v1039 Phase 2 reusable UI component build is **9.11.30**.
- v1040 Phase 3 screen-integration build is **9.11.31**.
- v1041 Phase 4 AgentX context-integration build is **9.11.32**.
- v1042 Phase 5 QA/regression build is **9.11.34**.
- Every future build must increment the patch version by one:
  - 9.11.34
  - 9.11.35
  - 9.11.36
  - and so on.

Version metadata should be updated consistently in:

- `app.json` → `expo.version`
- `app.json` → `ios.buildNumber`
- `app.json` → `android.versionCode`
- `package.json` → `version`
- Settings diagnostic export version
- User manual version text

---

## Casino Tab Data Rules — Actual vs Derived

The Casino tab must clearly distinguish between real saved cruise totals and derived session-level estimates.

### Source Priority

Easy Seas always uses the strongest available source first:

1. **Actual saved cruise results**: points earned, win/loss or winnings brought home, amount paid, taxes/fees, retail value, coin-in, hours played, certificates, and notes saved on a completed cruise row.
2. **Tracked sessions**: manually entered or live-tracked sessions with start/end time, duration, points, buy-in, cash-out, win/loss, machine, denomination, and notes.
3. **Derived sessions**: calculated session splits created only when cruise-level points and/or win/loss exist but individual sessions are missing.
4. **Estimated fallback**: used only when a value is absent and the app must calculate a planning estimate. Estimated values must be labeled as estimated/mixed.

### Sessions Page

The Sessions page may show manually tracked sessions and auto-calculated historical sessions. Auto-calculated sessions must not invent new totals. They distribute the real cruise total across reasonable session blocks:

- Total points across generated sessions must equal the cruise’s saved points.
- Total win/loss across generated sessions must equal the cruise’s saved win/loss where available.
- Coin-in is calculated from points at the Royal/Celebrity casino rule of **$5 coin-in per point**.
- If actual play hours are not saved, play hours are estimated from points using the app’s default points-per-hour setting.
- Auto-calculated sessions are marked as derived from cruise totals.

### Calcs Page

The Calcs page has two modes:

- **Per-session mode** uses tracked sessions when they exist. If no tracked sessions exist, it can fall back to current-season cruise totals.
- **Historical mode** uses completed cruise economics rows first. It may divide cruise totals into tracked/derived sessions only for per-session averages.

Important formulas:

- Coin-in = points × $5.
- Theoretical loss = coin-in × assumed hold percentage.
- Cash result = winnings brought home minus amount paid.
- Cruise value captured = retail value minus effective paid amount.
- Total economic value = retail value + winnings brought home minus effective paid amount.
- Coin-in is gaming volume only and is not counted as profit/value.

### Charts Page

Charts must be grounded in the same casino economics summary used by the rest of the Casino tab. ROI, risk, value, cash result, paid amount, retail value, points, and coin-in should come from real cruise rows when present. Simulation projections are allowed, but they must be fed by the real historical/current player context instead of arbitrary demo data.

### Data Source Card

The Charts, Sessions, and Calcs pages include a data-source card showing whether the page is using actual cruise totals, mixed actual/derived totals, tracked sessions, or estimates. This card helps confirm whether the screen is showing real app data or calculated support values.


---

## Troubleshooting

### SeaPass still shows QN instead of ST

Confirm the generator is using the latest build and reset the SeaPass fields to defaults. The correct default ship/ST code is **ST**. The renderer must compare against the shell baseline value, not the editable default.

### SeaPass shows two Keys

The approved shell should provide the Key. The renderer should not draw a second Key over it. If duplicate Keys appear, disable any extra Key overlay logic.

### SeaPass PNG export is blank or overlay-only

The export view must wait for the SeaPass shell image to load before capture. Try reopening the generator and exporting again. If it persists, export logs and report the exact device/build.

### Date does not line up

The `Jul 5` overlay should use the original SeaPass date geometry from the accurate shell baseline. Do not apply generic small text styling to the date.

### Weather shows the wrong port

Check the itinerary source for that day. Weather must use actual port names and known coordinates. If the exact itinerary is unavailable, the app should use a broad marine zone rather than inventing a named port.

### Maritime Weather is closed but there are alerts

The closed accordion should still show an alert badge/count. Open Maritime Weather to review the rough-seas watchouts.

### Dashboard counts look wrong

Compare Settings → Data Overview against the dashboard header:

- Available Cruises should match available cruise records.
- Booked should match active booked/upcoming records.
- Offers should match actual offer records.

### Sync/import mismatch

Before re-importing or clearing data:

1. Export All App Data.
2. Export logs if available.
3. Confirm the source CSV/backup contains the expected rows.
4. Use Import Review when available.
5. Avoid destructive resets unless intentionally starting over.

---

## Legal and Disclaimer

Easy Seas is provided for informational, planning, entertainment, and personal data-organization purposes only.

### Not Gambling Advice

Easy Seas does not provide gambling advice, does not guarantee casino outcomes, and should not be used as a gambling manual. Any casino play is entirely at the user’s own risk.

### Not Cruise-Line Policy Advice

Offer availability, certificate rules, pricing, fees, itineraries, ship schedules, port calls, and loyalty benefits may change. Always verify final details with the cruise line or official source before booking, changing, redeeming, or traveling.

### Weather Disclaimer

Maritime Weather features are planning aids only. Marine forecasts and ship routing can change quickly. Always follow official cruise-line, captain, port authority, NOAA/NWS/local maritime, and safety instructions.

### Financial / Tax Disclaimer

Casino tracking, W2-G logging, ROI estimates, comp values, taxes/fees, and pricing tools are organizational aids only and are not financial, tax, legal, or accounting advice.

### Trademarks

Royal Caribbean, Club Royale, Celebrity Cruises, Blue Chip Club, Silversea, Carnival, ship names, logos, program names, and other marks belong to their respective owners. Easy Seas is an independent app and is not endorsed by or affiliated with those companies unless explicitly stated by the official owner.

### User Responsibility

Users are responsible for verifying their own data, maintaining backups, protecting personal information, and making their own travel, casino, financial, and booking decisions.

---

© 2026 Royal Computer Consulting, LLC. All rights reserved.

---

## Casino Intelligence Phase 1 Engines (v1038 / 9.11.29)

Version 9.11.29 adds the first engine-only layer for the EasySeas Casino Intelligence upgrade. This release intentionally does not change SeaPass rendering, sync, certificate PDF scraping, Maritime Weather behavior, or backup/restore logic.

### Engine-only additions

The app now includes reusable calculation engines for:

- **Date-only utilities** for certificate expiration and cruise-day calculations without timezone drift.
- **Certificate Expiration Intelligence** for expiration date, days remaining, status, severity, badge label, user message, warnings, and urgency sorting.
- **Casino Opportunity Score** for cruise-level casino-play opportunity, including sea-day/private-island/port-day classification, estimated casino hours, reasons, warnings, and the known Star of the Seas July 5–12, 2026 itinerary with Basseterre, St. Kitts & Nevis.
- **Best Play Today** for active-sailing recommendations, target points, estimated coin-in, bankroll cap, bet range, recommended action, and warnings.
- **Host View Profile** for a host-style summary of cruise activity, casino play, points, coin-in, win/loss, favorite ships, favorite machines, strengths, risks, talking points, and copyable summary.

### Real data first

These engines are designed to use actual saved EasySeas data first. Estimated or derived values are used only when the underlying data is incomplete, and warnings are returned when a result depends on incomplete itinerary or casino-session data.

### Protected systems

This version does not intentionally modify:

- SeaPass live preview or export behavior
- Key symbol rendering
- Royal/Celebrity sync
- Chrome extension scraping
- Certificate PDF scraping
- Maritime Weather accordion behavior
- Local-first backup/restore
- Existing itinerary trust guard behavior

### Future UI integration

The Phase 1 engines are ready for later UI components and AgentX integration. Future phases may add Best Play Today cards, Casino Opportunity badges, Certificate Expiration badges, and Host View cards, but this release focuses on reusable logic and test harness coverage.

---

## Casino Intelligence Phase 2 Reusable UI Components (v1039 / 9.11.30)

Version 9.11.30 adds the reusable display components for the Casino Intelligence upgrade. This is still a controlled, non-integrated phase: the components exist and can be imported by future screens, but Phase 2 does not place them into Overview, Certificates, Cruise Cards, Scheduling, Analytics, or AgentX yet.

### New reusable components

- `CertificateExpirationBadge` displays certificate expiration status, days remaining, severity, expiration date, and warnings from the Phase 1 expiration engine.
- `CasinoOpportunityBadge` displays cruise casino opportunity score, label, casino-open day count, estimated casino hours, and incomplete-data warnings from the Phase 1 opportunity engine.
- `BestPlayTodayCard` displays the active-sailing casino play recommendation, target points, estimated coin-in, bankroll cap, bet range, session length, reason, warnings, and recommended machines when available.
- `HostViewCard` displays a host-style loyalty, casino-play, cruise-value, player-pattern, talking-points, strengths, risks, and copy-summary profile.

### Component rules

These components are display-only. They do not duplicate business logic inside JSX. Calculations remain in the Phase 1 engine files under `lib/`. Future screen integration should pass precomputed engine outputs into these components.

### Protected systems

This Phase 2 component build does not intentionally modify SeaPass rendering/export, Key rendering, sync, certificate PDF scraping, Maritime Weather, backup/restore, or itinerary trust guard behavior.


---

## Casino Intelligence Phase 3 Screen Integration (v1040 / 9.11.31)

Version 9.11.31 integrates the Casino Intelligence engines and reusable Phase 2 cards into the visible Easy Seas app screens. This phase remains non-destructive and does not intentionally change SeaPass, sync, weather, certificate PDF scraping, or backup/restore behavior.

### Overview

The Overview tab now includes **Best Play Today**, powered by the Phase 1 `buildBestPlayTodayPlan()` engine. It detects an active cruise when possible and shows:

- recommended play action
- target points
- estimated coin-in using the $5-per-point rule
- bankroll cap
- suggested bet range
- session length
- warnings when the active sailing or itinerary data is incomplete

Overview certificate summaries can also show the most urgent certificate expiration badges.

### Certificates

The certificate manager now uses the Phase 1 expiration engine to sort and display certificate urgency. Certificates may show:

- valid
- expiring soon
- urgent
- expires today
- expired
- unknown expiration

Expired certificates remain visible for recordkeeping. The app does not auto-delete expired certificates and does not add certificate move-risk logic.

### Cruise Opportunity Score

Available cruise cards, grouped offer cards, Booked cruise cards, Scheduling results, and Cruise Detail now display **Casino Opportunity** badges where appropriate. These badges come from `calculateCasinoOpportunityScore()` and show score, label, casino-day count, estimated casino hours, and warnings when itinerary details are incomplete.

The score must not fabricate a day-by-day itinerary from a vague itinerary label. If exact itinerary data is unavailable, the badge should show an estimated or warning state rather than pretending a guessed port schedule is exact.

### Cruise Detail

Cruise Detail now includes a Casino Opportunity section near the top of the page, beneath the compact cruise facts. This makes it easier to evaluate how casino-friendly a specific booked or available cruise is before making booking or replacement decisions.

### Analytics → Intelligence

The Analytics Intelligence tab now includes **Host View**, powered by the Phase 1 `buildHostViewProfile()` engine. Host View summarizes:

- loyalty snapshot
- casino play history
- total points
- estimated coin-in
- win/loss
- cruise activity
- favorite ships
- favorite machines
- strengths
- risks/watchouts
- host talking points
- copyable host-style summary

Host View uses local Easy Seas data and labels incomplete data honestly.

### Protected systems

This Phase 3 integration does not intentionally modify:

- SeaPass live preview or export
- SeaPass Key rendering
- Royal/Celebrity sync
- Chrome extension scraping
- certificate PDF scraping
- Maritime Weather
- local-first backup/restore
- itinerary trust guard behavior

## Casino Intelligence Phase 4 AgentX Context Integration (v1041 / 9.11.32)

Version 9.11.32 connects the Casino Intelligence engines to AgentX / Ask My Data context. AgentX can now see structured engine outputs for:

- **Best Play Today** — current sailing, cruise day, day type, casino availability, recommended action, target points, estimated coin-in, bankroll cap, and warnings.
- **Certificate Expiration Intelligence** — expiration-only status, days remaining, urgency, messages, severity, and sorting context.
- **Casino Opportunity Scores** — scores, labels, casino-open day counts, estimated casino hours, reasons, and incomplete-itinerary warnings for available and booked cruises.
- **Host View / Player Profile Summary** — loyalty snapshot, tracked cruises, sessions, points, coin-in, win/loss, favorite ships/machines, strengths, risks, and host talking points.

AgentX should use these engine outputs instead of inventing fresh calculations. If itinerary data is incomplete, AgentX must repeat the score warning instead of fabricating exact ports. Certificate intelligence remains expiration-only: the app does not implement certificate move-risk scoring, late-redemption predictions, host override odds, auto-redemption, or automatic deletion of expired certificates.

Phase 4 adds these outputs to the app-wide Ask My Data context block and extends AgentX prompt guidance and quick actions. It does not intentionally modify SeaPass, Key rendering, Royal/Celebrity sync, Chrome extension scraping, certificate PDF scraping, Maritime Weather, backup/restore, or the itinerary trust guard.
