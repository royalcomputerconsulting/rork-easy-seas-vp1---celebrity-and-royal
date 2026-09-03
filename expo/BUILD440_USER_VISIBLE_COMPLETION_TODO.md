# Easy Seas Build 440 — User-Visible Completion Todo

> Consolidated into `BUILD440_AUTHORITATIVE_DEFICIENCY_TODO.md` on August 30, 2026. Use the authoritative list for status and execution order.

Build 439 remains the rollback baseline. A checkbox closes only when the live consuming screen works, the result is persisted/owner-scoped where applicable, focused regression coverage passes, and the production bundle resolves every import.

## A. Agent SEA — real conversational assistant

- [ ] Open directly into a ready chat; remove the separate “tap AI to connect” activation step.
- [ ] Stop certificate/slot/index bulk loading from blocking the Agent SEA screen or navigation.
- [ ] Replace broad keyword dumps with intent routing plus owner-scoped calculation/data tools.
- [ ] Make “What is my ADT?” answer the ADT first, with the correct earning period, formula, confidence, and supporting cruise records.
- [ ] Send typed questions on the first tap; prevent duplicate sends while still allowing a new question to replace a slow request.
- [ ] Use a true iOS Messages-style conversation layout with readable user/assistant bubbles and a compact status/title bar.
- [ ] Keep the composer pinned above the iOS keyboard; the keyboard must never cover the conversation or Send control.
- [ ] Provide working top actions for Close, New Chat, Conversations, Filters, Save/Export, Print, and AI Settings.
- [ ] Provide working bottom actions for voice/accessories, text input, and Send.
- [ ] Automatically save every conversation under the active owner and restore it later.
- [ ] Export a readable saved conversation plus the diagnostic JSON log; support native iOS printing.
- [ ] Keep source/provenance evidence expandable instead of dumping it into the primary answer.
- [ ] Keep primary/secondary private records isolated while shared offers/sailings remain shared.
- [ ] Use OpenAI reasoning automatically when an account key or approved proxy is available; retain a concise deterministic answer when offline.

## B. Day Agenda navigation

- [ ] Add small previous/next-day arrows at the top without replacing the existing Back and Refresh actions.
- [ ] Preserve selected date through route params and refresh agenda/weather for the newly selected day.
- [ ] Add accessibility labels, 44-point hit targets, and regression coverage for both arrows.

## C. Booked cruise casino intelligence

- [ ] Stop showing zero sea days, port days, and casino score when itinerary records are present.
- [ ] Read itinerary, itineraryRaw, ports, portsAndTimes, and explicit sea/port fields using deterministic precedence.
- [ ] Exclude disembarkation from opportunity counts and treat embarkation separately.
- [ ] Show “missing itinerary” rather than fabricated zero when evidence truly is absent.
- [ ] Verify the card and casino calculations consume the same cruise record and formulas.

## D. Visible app-wide design system

- [ ] Preserve the existing Easy Seas logo, signature, seven-tab count, and tab order.
- [ ] Give Offers a visibly distinct offer/certificate identity using navy, gold, and certificate accents.
- [ ] Give Cruises a visibly distinct discovery/search identity using ocean/sky blues and teal.
- [ ] Give Booked a visibly distinct personal-voyage identity using deep blue, emerald, and itinerary/status accents.
- [ ] Give Calendar a visibly distinct planning identity using teal, sky, and readable event-category colors.
- [ ] Give Casino a visibly distinct Club Royale/Blue Chip intelligence identity using the supplied tier palettes.
- [ ] Give Slots a visibly distinct machine/advantage-play identity using charcoal, gold, and restrained neon accents.
- [ ] Give Settings a visibly distinct neutral control/data-health identity using slate, navy, and status colors.
- [ ] Apply shared typography, spacing, card, button, modal, loading, empty, error, estimated, and success components—not token declarations alone.
- [ ] Preserve every existing action while moving controls only where the destination tab remains semantically correct.
- [ ] Support light, dark, high-contrast, larger text, reduced motion, and color-blind-safe charts.
- [ ] Add progressive disclosure so conclusions appear before formulas/evidence on dense screens.
- [ ] Keep relationship maps, voyage artwork, and micro-interactions bounded and nonblocking.
- [ ] Capture and inspect fresh screenshots of every principal tab/theme; source-text assertions alone do not count.

## E. Data trust and release gates

- [ ] Preserve provenance through Agent SEA answers, import/export, database migration, Save All/Load All, and encrypted backup.
- [ ] Verify all newly visible buttons invoke their actual action and expose progress/success/error states.
- [ ] Run focused Agent SEA, Day Agenda, booked-card, owner-isolation, persistence, accessibility, and visual regressions.
- [ ] Run the maintained legacy suite so no existing functionality regresses.
- [ ] Run TypeScript, Expo Doctor, App Store identity checks, and a fresh iOS production bundle.
- [ ] Release as a new version/build while retaining Build 439 unchanged for rollback.
