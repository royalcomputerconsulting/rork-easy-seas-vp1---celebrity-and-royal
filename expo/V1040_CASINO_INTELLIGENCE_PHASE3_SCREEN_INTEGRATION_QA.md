# V1040 — Casino Intelligence Phase 3 Screen Integration QA

**App version:** 9.11.31

## Scope

Implemented Phase 3 screen integration for the Casino Intelligence upgrade.

## Integrated features

- Best Play Today card added to Overview.
- Certificate Expiration Badge added to the certificate manager list.
- Certificates in the manager sort by urgency while expired certificates remain visible.
- Casino Opportunity Badge added to Overview offer cards, Offer Details cruise rows, and standalone available-cruise cards.
- Casino Opportunity Badge added to Scheduling cruise cards.
- Casino Opportunity Badge added to Booked cruise cards and timeline cards.
- Casino Opportunity Badge/detail section added to Cruise Detail.
- Host View card added to Analytics → Intelligence.

## Guardrails

No intentional changes were made to:

- SeaPass rendering/export
- SeaPass Key rendering
- Royal/Celebrity offer sync
- Chrome extension scraping
- Certificate PDF scraping
- Maritime Weather
- Backup/restore
- Existing itinerary trust guard

## QA performed

- TSX syntax transpile check passed for all changed screen/component files.
- Phase 3 engine integration harness file added: `scripts/testPhase3Integration.ts`.
- Star of the Seas hard-map remains represented in engine test fixture.
- Certificate expiration badge uses the Phase 1 expiration engine rather than duplicating logic.
- Best Play Today uses the Phase 1 engine rather than calculating directly in Overview.
- Host View uses the Phase 1 host-view engine rather than calculating directly in Analytics UI.
- Casino Opportunity display uses the Phase 1 opportunity engine rather than custom JSX scoring logic.

## Acceptance criteria covered

- Overview loads with Best Play Today data/fallback.
- Certificate cards can display status, urgency, and expiration messaging.
- Offer, Offer Details, booked, scheduling, and cruise-detail screens can display casino opportunity score or estimated/unknown warnings.
- Analytics Intelligence can display Host View and return copy-summary content through the existing card callback.

## Not included

- AgentX context integration. That remains Phase 4.
- New certificate move-risk logic. This remains intentionally out of scope.
- Any SeaPass behavior change.
