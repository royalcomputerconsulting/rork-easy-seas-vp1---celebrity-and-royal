# V1030 SeaPass Key Render and PNG Capture Fix QA

## Scope
Targeted SeaPass Generator fix only. No sync, offers, booked cruise, weather, storage, or itinerary booklet logic was changed.

## Problem
The Key overlay in v1028/v1029 was drawn by first painting a solid purple rectangle over the key zone and then drawing the key glyph. This made the preview/export show a visible purple box, and the key glyph looked inaccurate. If the shell already contained a key, the added overlay could also appear doubled or misaligned.

The native PNG export could also capture the dynamic SVG text overlays without the approved SeaPass shell image. The hidden export view was only mounted after tapping Export PNG, then captured after a very short delay, before the shell image was reliably available as an embedded data URL.

## Fix
- Replaced the solid purple key erase rectangle with a clean-patch technique.
- The renderer now copies a nearby clean patch of the photographed purple header into the key zone, preserving texture/gradient instead of creating a visible box.
- Then it draws exactly one white Key glyph on top.
- The hidden native PNG export stage is now mounted continuously on native so the SeaPass shell has time to load before export.
- The native export delay was increased to allow the hidden export SVG/image state to settle before capture.
- The approved shell data URL loader now tries all shell candidates instead of only the direct source URL.

## Expected result
- Live preview shows the white Key symbol directly on the purple header, without a purple rectangle.
- PNG export includes the full SeaPass shell, not just overlays.
- If a shell already contains a key, the clean-patch step removes it before drawing the single final key.
- ST/date/port overlays continue to work.
