# Easy Seas v982 Slots Tab Crash Fix QA

## Build
- Version: 9.10.82
- Android versionCode: 91082
- iOS buildNumber: 9.10.82
- Engine marker: v9.8.2-slots-tab-crash-fix

## Issue
The Slots tab could crash immediately on open after the logo placement work because `app/(tabs)/machines.tsx` used `SHADOW.card` in the hero logo style but did not import `SHADOW` from the theme constants.

## Fix
- Added `SHADOW` to the theme import in `app/(tabs)/machines.tsx`.
- Verified no other TS/TSX files use `SHADOW` without importing it from the theme constants.

## QA Checklist
- Install v982.
- Export diagnostic and confirm version 9.10.82.
- Open Slots tab.
- Confirm the new Easy Seas artwork appears at the top.
- Scroll through the Slots tab.
- Tap a machine card and confirm machine detail opens.
- Open Slot Play Sessions and Machine Condition Log.
