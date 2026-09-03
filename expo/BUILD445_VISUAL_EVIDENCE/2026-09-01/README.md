# Build 445 Visual Evidence — September 1, 2026

All captures use the same authenticated web preview and an iPhone-proportioned viewport. They are review evidence for layout, theme, section hierarchy, and responsive behavior; native-only document picker, share sheet, biometric, Maps handoff, and low-memory behavior remain device checks.

## Seven tabs

- `offers-top.jpg`
- `cruises-top.jpg`
- `booked-top.jpg`
- `calendar-top.jpg`
- `casino-top.jpg`
- `slots-top.jpg`
- `settings-top.jpg`

## Critical nested screens

- `agent-sea-top.jpg`
- `day-agenda-top.jpg`
- `certificate-codes-final-top.jpg`
- `certificate-summary-final-top.jpg`
- `data-trust-top.jpg`
- `relationship-explorer-top.jpg`

## Shared visual-system fixtures

- `fixture-light.jpg`
- `fixture-dark.jpg`
- `fixture-high-contrast.jpg`
- `fixture-large-text.jpg`
- `fixture-simplified-reduced-motion.jpg`

## State coverage

- Empty-state behavior is visible on the authenticated Offers/Cruises captures and uses explicit “No records” language rather than fabricated zeroes.
- Error/unavailable behavior is visible in Data Trust on web, where native SQLite diagnostics are explicitly identified as unavailable without discarding saved information.
- Populated large-data behavior is covered by the supplied-file runtime acceptance and scale tests referenced in `BUILD445_REPRESENTATIVE_DATA.md` and `BUILD445_PERFORMANCE_BASELINE.md`.
- Determinate loading, partial success, retry, and cancellation behavior is protected by the operation-state and import/export regression tests. Native screenshot capture remains part of the device acceptance pass.

## Section-title rule

Every visual section has one section title. A section may contain labels, metrics, card titles, or evidence captions, but must not contain a second competing section heading. Root Expo Router headers are suppressed on designed nested screens so a native route name cannot appear above the page title.
