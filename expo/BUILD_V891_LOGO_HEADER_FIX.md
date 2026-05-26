# EasySeas v891 — Logo Header Fix

Built from v890 full codebase.

## What changed

- Fixed the top Offers/Overview branding section shown above the player card.
- Removed the duplicated overlay text/signature treatment that was causing the image to appear as a cropped background.
- Replaced that section with a clean formatted logo card that displays the provided EasySeas Gauguin-style header image using `resizeMode="contain"`.
- Added a dark nautical gradient shell, rounded image frame, padding, and card shadow so the logo section looks intentional and does not crop or duplicate text.

## What was not changed

- Completed cruise sync was not changed.
- Sync Now logic from v890 was not changed.
- Data providers, storage, offer merge rules, and Royal/Celebrity sync files were not modified by this branding-only patch.

## Primary file changed

- `app/(tabs)/(overview)/index.tsx`
