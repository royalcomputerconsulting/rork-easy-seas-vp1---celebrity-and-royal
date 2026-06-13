# V976 Logo Placement Fix QA

Version: 9.10.76
Engine marker: v9.7.6-logo-placement-fix

## Fixes

- Replaced the Offers tab top header/logo area with the supplied full Easy Seas / Scott Astin nautical artwork.
- Removed the older stacked Offers header treatment that could still show the old compass/book logo plus the green Easy Seas/signature card.
- Replaced the Slots tab top Easy Seas/signature card with the same supplied full Easy Seas / Scott Astin nautical artwork.
- Added test IDs:
  - `offers-brand-logo-card`
  - `offers-title-logo-card-image`
  - `slots-brand-logo-card`
  - `slots-brand-logo-image`

## Manual QA

1. Install build 9.10.76.
2. Open Offers tab.
3. Confirm the first large top image is the supplied full-color tropical Easy Seas / Scott Astin artwork, not the old compass/book-only logo or the green text/signature card.
4. Open Slots tab.
5. Confirm the first large top image is the supplied full-color tropical Easy Seas / Scott Astin artwork.
6. Export diagnostic logs and confirm version 9.10.76.
