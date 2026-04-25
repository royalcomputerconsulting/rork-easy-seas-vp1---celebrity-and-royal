# Architecture

## Top-level feature structure
The SeaPass Generator is split into 4 layers:

1. Screen/UI layer
   - `code/expo/app/seapass-generator.tsx`
2. Render component layer
   - `code/expo/components/seapass/SeaPassWebPass.tsx`
3. Rendering/export engine layer
   - `code/expo/lib/seaPassWebPass.ts`
   - `code/expo/lib/seapassExport.ts`
   - `code/expo/lib/seapassExport.web.ts`
4. Integration layer
   - auth gate via `code/expo/state/AuthProvider.tsx`
   - backend proxy via `code/expo/backend/hono.ts`
   - route/settings snippets in `snippets/`

## Runtime flow
### Screen boot
- `seapass-generator.tsx` mounts.
- It prefetches the approved shell image using `Image.prefetch(...)`.
- It initializes form state from `SEA_PASS_DEFAULTS`.

### Editing
- Admin edits one of 7 fields.
- `handleFieldChange` normalizes uppercase for `ship` and `muster`.
- Screen state updates.
- Preview re-renders immediately.

### Preview rendering
- `SeaPassWebPass.tsx` calls `getSeaPassData(...)`.
- It then calls `buildSeaPassSvgMarkup(...)`.
- The SVG string is rendered with `SvgXml`.

### Overlay logic
- Base visual = approved shell image.
- Dynamic values are placed only into masked overlay areas.
- Default values are treated as already baked into the shell image.
- Overlays render only when values differ from defaults.
- Special case: `time` and `date` behave as a pair. If either changes, both overlays render.

### Barcode logic
- Caption text is generated as:
  - `reservation-stateroom`
- A deterministic pseudo-barcode pattern is generated from character codes.
- Export layout uses the generated caption and bar data to preserve the expected card output.

## Export architecture
### Native
Handled by `code/expo/lib/seapassExport.ts`.

#### PNG
- Captures a hidden full-size pass render target.
- Uses `react-native-view-shot`.
- Shares the resulting file if sharing is available.

#### PDF
- Builds print HTML from the exact SVG.
- Uses `expo-print` to create the PDF.
- Uses `expo-sharing` or print fallback.

### Web
Handled by `code/expo/lib/seapassExport.web.ts` and helper logic in `seaPassWebPass.ts`.

#### PNG
- Fetches the approved shell image.
- Converts it to a data URL.
- Builds final SVG markup.
- Draws the SVG onto a canvas.
- Downloads the canvas as PNG.

#### PDF
- Opens a popup window.
- Writes the generated print HTML.
- Calls browser print.

## Admin access model
- The route can be linked from settings admin UI.
- The screen also self-protects with `useAuth().isAdmin`.
- Non-admins see a gated fallback screen.

## Backend role
The backend provides a stable proxy endpoint for the approved shell image:
- `GET /seapass-approved-shell`

This is used when `EXPO_PUBLIC_RORK_API_BASE_URL` is available.

## Files that matter most in a rebuild
If only the essentials are restored, start with:
- `code/expo/lib/seaPassWebPass.ts`
- `code/expo/components/seapass/SeaPassWebPass.tsx`
- `code/expo/app/seapass-generator.tsx`
- `code/expo/lib/seapassExport.ts`
- `code/expo/lib/seapassExport.web.ts`
- `snippets/backend-seapass-proxy.ts`
- `snippets/root-layout-seapass-screen.tsx`
- `snippets/settings-admin-entry.tsx`
