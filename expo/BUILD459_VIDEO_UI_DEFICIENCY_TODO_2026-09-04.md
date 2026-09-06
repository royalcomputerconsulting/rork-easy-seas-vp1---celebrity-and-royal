# Easy Seas Build 459 — Recorded iOS UI Deficiency Todo

Audit date: 2026-09-04  
Source recording: `/Users/rcg/Downloads/ScreenRecording_09-04-2026 18-35-38_1.MP4`  
Recording length: 2:09  
Target: native iPhone portrait UI  
Status: audit only; no functionality is to be removed or simplified

## Execution batches

- **Batch 1:** UI-001–UI-100 — complete; 258 maintained release tests passed, 43 optional-fixture tests skipped, 0 failed.
- **Batch 2:** UI-101–UI-200 — ready; begins at UI-101 in the next 100-item execution turn.
- A checked item means its implementation exists and its relevant maintained regression passed; native visual acceptance remains separately tracked where required.

## Non-negotiable visual contract

- Preserve the current product behavior and data density. Repair presentation, hierarchy, responsiveness, and interaction feedback without deleting features.
- Use one editorial typography system: the same serif family for display titles and the same sans-serif family for labels, body copy, controls, and numbers.
- Use ocean white/ivory page surfaces, navy primary text/actions, teal informational accents, and tier colors only when the color has a defined meaning.
- Each page has one page identity, each section has one section title, and each card has one clear purpose. Do not repeat the same title at page, section, and card level.
- Search and filter controls must share one compact anatomy everywhere: icon, short label, active state, count when useful, clear/reset action, and an immediately visible result.
- Cruise cards must share the same field order everywhere: brand/status, ship, itinerary, dates/nights, departure port, guests, stateroom/category, price/value, loyalty points, offer/certificate, then evidence/detail action.
- Changes of state must be visible where the user acted. A shortcut or filter may not silently alter content far below the viewport.
- Photorealistic imagery must be relevant to the ship, destination, cabin, offer, or section. Do not reuse one generic port or diver image across unrelated records.
- Missing data stays truthful, but it must use a compact missing-state treatment instead of consuming the space of a populated card.
- No content may be hidden under the seven-item bottom navigation or clipped at Dynamic Island/safe-area edges.

## Recording coverage

| Approx. time | Area observed |
| --- | --- |
| 00:00–00:08 | Launch and local sign-in |
| 00:08–00:20 | Home / Offers, loyalty, offer portfolio, expiration, filters, activity, Agent SEA, Learn |
| 00:20–00:31 | Explore cruise catalog and paging |
| 00:31–00:49 | My Voyages filters and cruise cards |
| 00:49–01:13 | Calendar transition, Day Agenda, weather, Apple Calendar, schedule and timeline |
| 01:13–01:29 | Casino metrics, evidence and reconciliation |
| 01:29–02:09 | Settings overview, shortcuts, selected panels, account, books/legal and data import |

The recording does not open every nested destination. Items marked **coverage** require a separate native walk-through; they are not claims that those unshown screens already pass.

## A. Cross-app shell and design system

- [x] **UI-001** Replace the visible mixture of serif and bold rounded/system headings with the approved two-family hierarchy.
- [x] **UI-002** Normalize display-title size, line height, weight, and letter spacing across all seven tabs.
- [x] **UI-003** Normalize section-heading size and eliminate sections that contain a second competing section title.
- [x] **UI-004** Normalize body, caption, metadata, button, badge, and numeric styles so the same information has the same visual weight everywhere.
- [x] **UI-005** Replace the current collection of slightly different cream, mint, gray, and white backgrounds with named design tokens and controlled nautical surface roles.
- [x] **UI-006** Reserve purple, gold, red, green, and casino tier colors for semantic states; remove decorative color changes that have no meaning.
- [x] **UI-007** Standardize card radius, border color, shadow, internal padding, and inter-card spacing.
- [x] **UI-008** Standardize section spacing; remove large blank areas after the last card and inconsistent gaps between adjacent sections.
- [x] **UI-009** Standardize every primary, secondary, tertiary, destructive, and icon-only button, including pressed, disabled, selected, loading, and focus states.
- [x] **UI-010** Give every icon-only button a visible or accessible purpose and a consistent minimum tap target without making the visual glyph oversized.
- [x] **UI-011** Replace decorative emoji/outline-icon mixing with one controlled rule: emoji may identify a section; line icons identify actions and metrics.
- [x] **UI-012** Keep one selected-state pattern for pills, tabs, filter chips, Settings shortcuts, and segmented controls.
- [x] **UI-013** Keep one compact search-field pattern throughout the app, matching Search Settings & Actions.
- [x] **UI-014** Keep one compact filter pattern throughout the app, with results changing immediately below the controlling row.
- [x] **UI-015** Prevent text truncation where the hidden words distinguish itinerary, cabin, status, or action; allow a controlled second line instead.
- [x] **UI-016** Add consistent bottom content inset so the final metadata/action row never sits behind the bottom navigation.
- [x] **UI-017** Correct the Quick Actions tab label so it does not render as a second dangling plus beneath the plus icon.
- [x] **UI-018** Rebalance bottom-navigation icon, label, active indicator, and safe-area spacing; “My Voyages” must remain legible without crowding adjacent tabs.
- [x] **UI-019** Use one transition language between tabs and nested screens; no partial previous screen or hard vertical seam may remain visible during navigation.
- [x] **UI-020** Add reduced-motion behavior that removes the problematic split-screen transition while preserving clear navigation feedback.
- [x] **UI-021** Confirm every page begins at a predictable scroll position when entered; retained scroll state must be intentional and clearly indicated.
- [x] **UI-022** Confirm loading, empty, partial, error, and populated states use the same shell and do not jump to a visually unrelated legacy layout.

## B. Launch and local sign-in (00:00–00:08 and wraparound)

- [x] **UI-023** Reduce the oversized artwork so the sign-in controls appear without requiring visual travel past a large promotional block.
- [x] **UI-024** Move the long trademark notice out of the primary sign-in path into a concise legal link or progressive disclosure.
- [x] **UI-025** Remove the duplicate Easy Seas identity between the artwork and the white sign-in card.
- [x] **UI-026** Restyle the stark saturated blue page background to the same nautical ivory/navy/teal family used after sign-in.
- [x] **UI-027** Restore a visible label on the primary PIN/sign-in button while loading; the recording shows a spinner without a clear action name.
- [x] **UI-028** Align email, PIN, biometric, loading, error, and validation states to the shared input/button system.
- [x] **UI-029** Tighten vertical spacing so email, PIN, primary action, and biometric action read as one authentication flow.
- [x] **UI-030** Keep account email readable but visually subordinate; do not let a prefilled personal address dominate the card.

## C. Home / Offers (00:08–00:20)

### Identity and loyalty

- [x] **UI-031** Ensure the Easy Seas/Scott Astin identity is the first visual element at the top and is not paired with a redundant marketing blurb.
- [x] **UI-032** Rebuild the compact loyalty card to match the supplied Pinnacle/Signature reference: status pills, retained-through message, crest/medallion, both progress bars, and three summary metrics.
- [x] **UI-033** Preserve all loyalty facts while reducing unused padding and preventing the card from becoming a full-screen panel.
- [x] **UI-034** Use the correct tier color on each progress bar and keep the same track, fill, endpoints, percentage, and explanatory-copy anatomy.
- [x] **UI-035** Keep Crown & Anchor and Club Royale visually related but clearly labeled as different programs.

### Offer portfolio

- [x] **UI-036** Rebalance “Your offer portfolio”; its three metrics currently have uneven visual weight and excess surrounding space.
- [x] **UI-037** Align estimated value, active offers, and eligible sailings on a shared baseline with consistent icons and labels.
- [x] **UI-038** Replace the large Soonest Expiring / Highest Value pills with the shared compact sort control.
- [x] **UI-039** Make the active sort state unmistakable without using a different control style from Explore or My Voyages.

### What needs attention / expiration command center

- [x] **UI-040** Reduce the command center height; it currently consumes too much of the first page before the user reaches actual offers.
- [x] **UI-041** Remove the conflicting purple full-width CTA and use the shared navy/teal primary action style.
- [x] **UI-042** Correct the hierarchy among “What needs attention,” “Urgent,” and “Expires in 7 days” so the same concept is not titled three times.
- [x] **UI-043** Standardize the urgency chips; “Urgent: 9,” “4 0–7 days,” and “5 8–14 days” currently mix count-first and label-first syntax.
- [x] **UI-044** Make 0–7, 8–14, and 15–30 day controls mutually clear and show their filtered result immediately beneath the chip row.
- [x] **UI-045** Ensure the selected urgency chip and the separate Filter Offers expiry chip remain synchronized rather than presenting two competing filter states.
- [x] **UI-046** Recompose the October Opener preview row so View, Decode, Compare, archive, skip, and Ask do not compete in one cramped horizontal strip.
- [x] **UI-047** Do not expose a tiny unlabeled trash/archive glyph beside large labeled buttons.
- [x] **UI-048** Keep score, rating, days remaining, and value aligned and legible without compressing the offer name.

### Offer filters and cards

- [x] **UI-049** Replace the oversized “🔎 Filter offers” heading/card with the shared compact search-and-filter component.
- [x] **UI-050** Keep expiry, owner/profile, offer detail, cabin, guest, source, and value filters in one coherent hierarchy.
- [x] **UI-051** Prevent the Household / Me / Companion / Unassigned row from clipping or requiring ambiguous horizontal interpretation.
- [x] **UI-052** Make the “10 of 10 offers” result count react beside the filters instead of floating after a large Offer Details button.
- [x] **UI-053** Show active filters as removable chips and keep Clear All in the same row.
- [x] **UI-054** Reduce offer-card height while preserving points, guests, categories, stateroom value, eligible sailing count, score, expiry, and actions.
- [x] **UI-055** Replace repeated generic cruise-port imagery with offer/destination imagery that varies meaningfully by record.
- [x] **UI-056** Keep the offer name/code/status above the image or within one consistent hero anatomy; do not alternate between layouts.
- [x] **UI-057** Present “Stateroom categories available by sailing” as a compact dynamic fact, not as a multi-line substitute for real category data.
- [x] **UI-058** Use a compact unavailable-value treatment for `$—`; an empty value may not occupy the same large tile as a populated value.
- [x] **UI-059** Keep View Eligible Sailings and Decode actions consistent across every offer card.

### Certificates, recent activity, Agent SEA, and education

- [x] **UI-060** Ensure Casino & Certificates has one section title and follows the same card anatomy as the surrounding offer sections.
- [x] **UI-061** Make certificate totals, code groups, class summaries, and per-sailing lines scannable without opening a visually unrelated screen.
- [x] **UI-062** Redesign Recent Activity rows; the recording shows plain text-heavy cards that do not match cruise cards or the casino visual system.
- [x] **UI-063** Give each recent activity row a consistent date, ship, itinerary, casino result, earned points, and evidence layout.
- [x] **UI-064** Correct duplicated content such as “7 nights to 7 Night …” before rendering it in Recent Activity.
- [x] **UI-065** Add a restrained relevant thumbnail or visual marker to Recent Activity without turning each row into an oversized hero card.
- [x] **UI-066** Restyle Agent SEA and Learn the System as compact, polished action cards with the same header, spacing, icon, and button rules.
- [x] **UI-067** Remove the excessive blank page area beneath Learn the System.

## D. Explore cruise catalog (00:20–00:31)

- [x] **UI-068** Make the Explore hero/search/filter area the visual anchor when the tab opens; retained deep-list position must not make the page feel contextless.
- [x] **UI-069** Use one brand control only; program must derive from brand and must not be shown as a redundant independent selector.
- [x] **UI-070** Repair the search field’s visual/result relationship so search matches appear immediately beneath the controls.
- [x] **UI-071** Consolidate Available, All, Back-to-Back, Booked, Soonest, Latest, Value, ship, nights, port, itinerary, cabin, and date controls into the shared compact filter system.
- [x] **UI-072** Keep active-filter chips and Clear All visible without creating another tall filter card.
- [x] **UI-073** Normalize cruise-card titles; remove mixed abbreviations and duplication such as “8 NT …” versus “7-Night 7 Night Cruise.”
- [x] **UI-074** Allow itinerary names to use a controlled second line instead of an ellipsis that hides the distinguishing destination.
- [x] **UI-075** Replace the repeated generic port photograph with a ship/destination-relevant image selected by stable rules.
- [x] **UI-076** Move the Available/Booked badge into the canonical cruise-card status position and keep tier/status badges from stacking awkwardly.
- [x] **UI-077** Give departure port, dates, nights, guests, stateroom, offer code, price/value, and points the canonical field order.
- [x] **UI-078** Replace unexplained abbreviations such as “ON,” “1G,” “2G,” and “7N” with accessible labels or labeled icon facts.
- [x] **UI-079** Separate offer/certificate code from stateroom status; the recording places a gold code beside “Stateroom not stated.”
- [x] **UI-080** Make “Voyage details” a clear consistent disclosure/action rather than a low-contrast empty bar.
- [x] **UI-081** Reduce the “Load next 75 cruises” control and integrate loaded/total progress without a large standalone block.
- [x] **UI-082** Remove the large blank area after paging controls and keep “Back to cruise discovery” attached to the catalog footer.
- [x] **UI-083** Preserve bounded paging for the 3,018-row catalog and show no more than a performant, reachable batch at a time.

## E. My Voyages (00:31–00:49)

- [x] **UI-084** Rebuild the filter header using the same compact search-and-filter system as Offers, Explore, Calendar, and Settings.
- [x] **UI-085** Remove the visual mismatch between the All Ships dropdown, status pills, brand chip, and action chips.
- [x] **UI-086** Place brand filters in a brand group; “Celebrity” must not appear as a stray status alongside All/Upcoming/Completed.
- [x] **UI-087** Replace ambiguous controls such as Countries, Hide Done, and Sort with clear icon/label actions and an immediately visible result.
- [x] **UI-088** Remove the duplicated list summary between the filter count and “My cruises — 83 cruises.”
- [x] **UI-089** Keep Favorite Staterooms immediately above Consecutive Voyage Blocks, with neither section interrupting the main filter/list relationship.
- [x] **UI-090** Render consecutive voyage blocks as actual canonical cruise cards inside a bounded set, not compact made-up summary rows.
- [x] **UI-091** Page or virtualize large booked/completed collections; 83 or more cruises may not become one unbounded visual column.
- [x] **UI-092** Use ship/destination-specific imagery; Harmony and Adventure must not reuse the same generic Nassau port photo or diver image.
- [x] **UI-093** Keep booked-card image height proportional and prevent it from crowding the facts below.
- [x] **UI-094** Apply one canonical title pattern: “5-night Bahamas & Perfect Day,” not mixed “5 Night”/uppercase/duplicate variants.
- [x] **UI-095** Make itinerary stops readable; the current small dotted route sentence is too dense and visually subordinate.
- [x] **UI-096** Keep ship, title, departure port, itinerary, dates, guests, nights, price, stateroom, loyalty points, status, and tier visible in the same positions on every card.
- [x] **UI-097** Prevent price/stateroom/points rows from being clipped by the fixed bottom navigation.
- [x] **UI-098** Correct malformed visible ship/title strings such as “BY of the Seas” and “7-Night 7 Night Cruise” before display.
- [x] **UI-099** Keep Oceanview/Ocean View/Balcony/Interior labels normalized and in the same field position.
- [x] **UI-100** Make the Voyage Details affordance visually consistent with Explore and Casino cruise cards.

## F. Calendar and Day Agenda (00:49–01:13)

- [x] **UI-101** Remove the phone-width split-screen transition that exposes the month calendar behind an offset Day Agenda pane.
- [x] **UI-102** Use a full-width iPhone transition with no hard vertical seam, clipped content, or simultaneous competing pages.
- [x] **UI-103** Reduce the duplicated Calendar/date navigation header; Back, Calendar, Refresh, previous day, next day, date, and event count consume too much fixed height.
- [x] **UI-104** Keep the monthly calendar at the top of the Calendar tab, then Voyage Timeline and Crew Recognition below it.
- [x] **UI-105** Use the shared compact filter/action pattern for Calendar profile, view, and date-range controls.
- [x] **UI-106** Keep Day Agenda identity artwork compact; it should introduce the day without creating another oversized page header.
- [x] **UI-107** Keep Time Zone Converter, Today’s Priorities, Weather, Apple Calendar, and 24-hour Agenda visually related instead of alternating unrelated card styles.
- [x] **UI-108** Reduce the Time Zone Converter height and use the same surface/radius system as the surrounding cards.
- [x] **UI-109** Give Today’s Priorities meaningful summary data on the card instead of generic explanatory copy alone.
- [x] **UI-110** Show weather exactly once on Day Agenda and exactly once on the upcoming My Voyages page.
- [x] **UI-111** Reduce the Weather section from a long technical dashboard to a concise forecast summary with progressive detail.
- [x] **UI-112** Remove repeated weather identity: section title, voyage header, image title, refresh title, alert title, and operational detail must not all compete.
- [x] **UI-113** Replace the full-width Refresh Complete Voyage button with one compact refresh action in the weather header.
- [x] **UI-114** Keep NOAA/NHC safety alerts prominent but compact; move raw source checks, radius, timestamp, and technical prose into detail disclosure.
- [x] **UI-115** Normalize weather metrics into the shared metric-card system; the current dark blue technical grid is visually disconnected from the app.
- [x] **UI-116** Keep wave, swell, gust, wind, rain, horizon, and snapshots available without displaying every technical field by default.
- [x] **UI-117** Display an actual visible itinerary map in the Day Agenda section; coordinates plus “Open map” are not the requested map.
- [x] **UI-118** Make the map clearly state that it is itinerary/weather location, not live AIS, in a compact caption.
- [x] **UI-119** Reduce the Apple Calendar connection card and place the Connect state/action on one balanced row.
- [x] **UI-120** After EventKit connection, place personal events directly into the day schedule with a clear source marker and without duplicating the connection card.
- [x] **UI-121** Rebalance the 24-hour Agenda summary chips; “12:00 AM–4:00 PM” and “6h 30m” currently wrap and align inconsistently.
- [x] **UI-122** Prevent all-caps location text from wrapping into a dense block inside a small metric tile.
- [x] **UI-123** Differentiate all-day items, port windows, casino windows, personal events, and Easy Seas events with the shared semantic-color rules.
- [x] **UI-124** Remove duplicate events such as same-time embarkation/departure rows unless their difference is explicitly meaningful.
- [x] **UI-125** Keep Opportune Playing Times and Day Timeline compact and avoid the large unused area visible after the final timeline card.
- [x] **UI-126** Keep Daily Luck and Casino Session content subordinate to the actual daily agenda; do not let secondary tools interrupt the day’s chronological flow.

## G. Casino (01:13–01:29)

- [x] **UI-127** Restore the Scott Astin identity/signature at the Casino page top without adding a redundant second hero title.
- [x] **UI-128** Keep Overview, Cruises, Play, Analytics, Calculator, and Slots visible as one compact local-navigation system.
- [x] **UI-129** Preserve the meaningful highlighted casino colors while mapping every accent to a defined metric/evidence/tier state.
- [x] **UI-130** Reduce the height of Estimated Play Hours, Modeled ADT, Casino Cash Result, Certificate-Created Value, and Theoretical Loss cards.
- [x] **UI-131** Use a denser two-column metric layout where labels and explanations remain readable; avoid one full-width card per number.
- [x] **UI-132** Move explanatory formulas and provenance behind “View contributing records” or an evidence disclosure.
- [x] **UI-133** Keep ACTUAL, DERIVED, ESTIMATED, RECONCILED, MISSING, and NEEDS REVIEW badges in one consistent position and style.
- [x] **UI-134** Render a compact missing-state row for Certificate-Created Value instead of a full metric card containing only a dash.
- [x] **UI-135** Normalize large-number typography and currency formatting across coin-in, cash result, ADT, theoretical loss, points, and value.
- [x] **UI-136** Rebalance the four Gaming Activity tiles; icon, number, badge, and evidence action must not compete.
- [x] **UI-137** Replace repeated “View contributing records” links with a consistent disclosure affordance inside each metric.
- [x] **UI-138** Reduce Host-Ready Annual Evidence and Points Reconciliation default height; show conclusions first and formulas only on expansion.
- [x] **UI-139** Keep the primary “Add or reconcile a cruise result” action compact and attached to the relevant section.
- [x] **UI-140** Ensure casino cruise cards use the same canonical cruise card anatomy as Explore and My Voyages.

## H. Settings (01:29–02:09)

### Identity and data overview

- [x] **UI-141** Reduce the Settings identity hero height and prevent decorative photography from taking space needed by controls.
- [x] **UI-142** Reduce Data Overview to roughly half its current height while retaining all counts.
- [x] **UI-143** Rebalance the seven Data Overview metrics into a deliberate grid rather than a four-column row plus unrelated three-column row.
- [x] **UI-144** Clarify the relationship among 3,031 cruises, 3,031 physical options, 19 booked, 82 Royal, and 10 offers.
- [x] **UI-145** Give every count a consistent icon, value, label, optional sub-count, and tap behavior.
- [x] **UI-146** Flag count inconsistencies visually only when they represent a real data-health issue; do not make ordinary summary counts look like warnings.

### Search and nine shortcut buttons

- [x] **UI-147** Keep Search Settings & Actions and the nine buttons as one compact, balanced control group.
- [x] **UI-148** Standardize the nine button widths, heights, icon sizes, label baselines, selected fill, border, and spacing.
- [x] **UI-149** Replace inconsistent emoji rendering with controlled icons or normalized emoji badges so Security, Alerts, Integrations, Appearance, Help, Books & Legal, Purchases, Data Trust, and Danger Zone feel related.
- [x] **UI-150** Insert the selected shortcut’s view immediately below the nine-button grid and above Account every time.
- [x] **UI-151** Automatically scroll the selected inline view into the visible area when a shortcut is pressed from a lower scroll position.
- [x] **UI-152** Animate only the inline panel change, not the entire Settings page; selected state and content change must be obvious together.
- [x] **UI-153** Preserve Profile, Connections, and Data Import as always-visible sections after the selected inline panel.
- [x] **UI-154** Make Data Trust follow the same inline-panel pattern or explicitly label it as a destination; it currently behaves differently from the other shortcuts.
- [x] **UI-155** Give Security a useful inline state/action even when a PIN is already enrolled; it must not become a no-op row.
- [x] **UI-156** Fix Danger Zone: the shortcut currently has no matching `Danger Zone` action group and can render no visible panel.
- [x] **UI-157** Keep Help and Integrations panels compact; the recording shows the correct placement but excessive surrounding card/chrome.
- [x] **UI-158** When search results replace the shortcuts, keep the result list directly under the search field and return to the same shortcut state when cleared.

### Account and loyalty

- [x] **UI-159** Reduce the Account/Profile section height while preserving User/Second User and Royal/Celebrity/Silversea switching.
- [x] **UI-160** Remove the heavy navy subheader bar or integrate it into the shared card anatomy without creating a second section title.
- [x] **UI-161** Rebuild the loyalty portion to match the supplied compact Pinnacle/Signature reference rather than basic text plus thin bars.
- [x] **UI-162** Keep status-retained copy, max status, current/target points, percent, ETA/reset, historical points, and nights in a balanced compact layout.
- [x] **UI-163** Use Crown & Anchor gold and Club Royale tier color only on their own progress elements; the current blue/purple bars do not fully match the agreed reference.
- [x] **UI-164** Make View All Profile Details and Edit Profile visually distinct, compact actions instead of two wide low-information bars.

### Connections, books/legal, data import and backup

- [x] **UI-165** Keep Connections immediately after Account and present sync providers as consistent compact rows with status, last sync, and action.
- [x] **UI-166** Keep admin-only Gmail, SeaPass, BookDrop, machine, log, and reset tools out of normal user Settings and under Quick Actions → Admin Only.
- [x] **UI-167** Reduce Books & Legal card height; retain real book covers but keep external actions aligned and consistent.
- [x] **UI-168** Move the long trademark notice to a readable legal detail screen instead of a primary workflow surface.
- [x] **UI-169** Recompose Data Import & Backup into clear Import, Export/Backup, Calendar Feed, and Restore groups with one heading each.
- [x] **UI-170** Replace the long plain list of rows with compact grouped actions that still expose counts and status.
- [x] **UI-171** Restyle Publish Feed; the bright full-width blue button breaks the otherwise restrained palette.
- [x] **UI-172** Keep explanatory paragraphs behind a help/detail disclosure so the action list remains scannable.
- [x] **UI-173** Use the same visual anatomy for Offers CSV, Booked CSV, Completed History, Crew Registry, Calendar ICS, assignment review, earlier-backup restore, full JSON backup, and certificate export.
- [x] **UI-174** Keep restore/import preview status directly below the action that initiated it.
- [x] **UI-175** Surface success, partial, conflict, duplicate, and failure results as compact inline summaries rather than visually unrelated alerts.
- [x] **UI-176** Keep Security below Connections and Data Import as requested, while retaining its shortcut above.

## I. Quick Actions and unshown nested screens

- [ ] **UI-177 — coverage** Open the seventh-tab plus menu and verify its sheet/card uses the same spacing, typography, grouping, and safe-area rules.
- [ ] **UI-178 — coverage** Verify normal-user Quick Actions include Browse Cruises, Add/Import Booking, Load Receipt, Enter Totals, Import/Restore, Calendar, Crew, Casino Session, Machine, Certificates, and Agent SEA.
- [ ] **UI-179 — coverage** Verify Load Receipt and Enter Totals expose a compact searchable voyage picker immediately below the selected action.
- [ ] **UI-180 — coverage** Verify Admin Only is a separate collapsed group containing Gmail, SeaPass, BookDrop, machine import/export, logs, and protected reset.
- [ ] **UI-181 — coverage** Open Offer Details and verify canonical offer facts, photorealistic identity, compact filters, and canonical eligible-sailing cards.
- [ ] **UI-182 — coverage** Open Cruise Details from Explore, My Voyages, Casino, and Calendar and verify the same record opens with the same field order and no “Cruise not found.”
- [ ] **UI-183 — coverage** Open Certificate Codes, Certificate Summary, Certificate Portfolio, and Certificate Lookup and verify one shared theme, bounded lists, and immediate filter results.
- [ ] **UI-184 — coverage** Open Agent SEA and verify its header, actions, filters, composer, answer cards, citations/evidence, keyboard avoidance, and loading/error states.
- [ ] **UI-185 — coverage** Open Data Trust Center and verify issue counts, downloadable lists, repairs, backup/restore, and action results use the unified visual system.
- [ ] **UI-186 — coverage** Open Gmail Import preview and verify classification, duplicate, discard, unresolved, invoice, cancellation, certificate, and cruise-statement rows are visually distinct and compact.
- [ ] **UI-187 — coverage** Open receipt/PDF import and manual totals from a booked cruise and verify actions are visible without scrolling past empty sections.
- [ ] **UI-188 — coverage** Open Slots/Machines from Casino and verify list, detail, add/edit, sessions, charts, and maps retain the same navigation identity.
- [ ] **UI-189 — coverage** Verify every modal and picker respects safe areas, keyboard, large text, dark mode, reduced motion, and dismissal gestures.

## J. Native visual acceptance gates

- [ ] **UI-190** Record a fresh full-height pass of all seven tabs at the same iPhone model and compare section-by-section against the reference images.
- [ ] **UI-191** Capture top, middle, bottom, selected-filter, expanded-detail, loading, empty, error, and large-data states for each primary tab.
- [ ] **UI-192** Confirm every Settings shortcut changes both selected appearance and the panel immediately below the grid in one screen recording.
- [ ] **UI-193** Confirm all filter groups change result count/order directly below the controls and Clear restores the previous full set.
- [ ] **UI-194** Confirm cruise-card field order and labels are identical across Explore, My Voyages, Offer Details, Casino Cruises, consecutive sets, and Calendar.
- [ ] **UI-195** Confirm lists larger than 20 remain bounded/virtualized and do not create an unreachable page.
- [ ] **UI-196** Confirm relevant images vary by record and no unrelated ship/destination cards share the same generic artwork.
- [ ] **UI-197** Confirm no page has duplicate weather, duplicate headings, duplicated itinerary wording, unexplained abbreviations, or malformed names.
- [ ] **UI-198** Confirm no control or metadata is obscured by the Dynamic Island, keyboard, modal, or seven-tab navigation.
- [ ] **UI-199** Confirm the app at default, large, and extra-large text sizes without truncating distinguishing data or shrinking tap targets.
- [ ] **UI-200** Do not mark this list complete from source inspection alone; completion requires a fresh native iOS recording and screen-by-screen visual sign-off.

## Priority order

1. **P0 interaction/structure:** UI-019–021, UI-044–045, UI-070–072, UI-084–091, UI-101–105, UI-110, UI-117, UI-150–158, UI-174–175.
2. **P1 canonical components:** UI-001–018, UI-031–039, UI-049–059, UI-073–083, UI-092–100, UI-121–124, UI-129–140, UI-147–164.
3. **P2 density/polish:** UI-023–030, UI-040–048, UI-060–067, UI-106–109, UI-111–120, UI-125–128, UI-141–146, UI-165–176.
4. **Coverage and final native acceptance:** UI-177–200.

## K. Gmail attachment inventory and data-truth acceptance

Source inventory: `/Users/rcg/.codex/attachments/df9097f6-2e1c-414a-832f-0bf39444928b/pasted-text.txt`  
Fixture archive: `tmp/pdfs/gmail-fixture/cruise_attachments_2026-01-01_to_2026-09-04`

- [x] **DATA-201** Inventory all 90 PDFs from the Gmail archive and retain exactly the four approved document types for processing.
- [x] **DATA-202** Classify exactly 70 PDFs as actionable: 61 Guest Offer/Guest Invoice, 6 Cruise Statement, and 3 Cancellation Invoice documents.
- [x] **DATA-203** Discard all 18 Guest Vacation Documents plus the Booking Change Notice and Balance Due Notice from this owner workflow.
- [x] **DATA-204** Parse all 61 approved offer/invoice PDF bodies and retain reservation, sail date, nights, cabin/category, guests, and financial values when present.
- [x] **DATA-205** Parse all 6 cruise statements and keep Club Royale Entertainment room-charge gambling separate from real onboard expenses.
- [x] **DATA-206** Parse all 3 cancellation invoices and use the full reservation total across guests, including the verified $2,077.74 Navigator cancellation refund.
- [x] **DATA-207** Do not create an active Legend booking from the Liberty/Legend identity conflict; keep Liberty attachment identity and surface the PDF mismatch in preview.
- [x] **DATA-208** Keep reservation 4897416 (`NC / ship not stated`) in explicit review instead of inventing a ship or sailing.
- [ ] **DATA-209** Complete an on-device Gmail preview of all 70 actionable documents and visually confirm every conflict/discard reason before Apply is enabled.
- [ ] **DATA-210** Apply the reviewed batch on-device and verify deduplication prevents any Gmail message or attachment from importing twice.
