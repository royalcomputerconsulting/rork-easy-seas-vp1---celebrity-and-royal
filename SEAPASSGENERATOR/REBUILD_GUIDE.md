# Rebuild Guide

## 1. Restore the core files
Copy these files back into the app if the feature needs to be rebuilt:
- `code/expo/app/seapass-generator.tsx` -> `expo/app/seapass-generator.tsx`
- `code/expo/components/seapass/SeaPassWebPass.tsx` -> `expo/components/seapass/SeaPassWebPass.tsx`
- `code/expo/lib/seaPassWebPass.ts` -> `expo/lib/seaPassWebPass.ts`
- `code/expo/lib/seapassExport.ts` -> `expo/lib/seapassExport.ts`
- `code/expo/lib/seapassExport.web.ts` -> `expo/lib/seapassExport.web.ts`
- `code/expo/components/ErrorBoundary.tsx` -> `expo/components/ErrorBoundary.tsx`
- `code/expo/constants/theme.ts` -> `expo/constants/theme.ts`

## 2. Reconnect routing
Use the snippets in `snippets/route-integration.md`.

Required pieces:
- Register the screen in `expo/app/_layout.tsx` as `name="seapass-generator"`.
- Add the settings/admin entry that pushes `'/seapass-generator'`.

## 3. Reconnect admin gating
The screen expects:
- `useAuth()`
- `useAuth().isAdmin`

The current project already provides this through `expo/state/AuthProvider.tsx`.
If rebuilding elsewhere, provide a hook with this shape:

```ts
function useAuth(): { isAdmin: boolean }
```

If `isAdmin` is false, the screen shows an admin-only gate instead of the generator.

## 4. Reconnect the approved shell proxy
Use `snippets/backend-seapass-proxy.ts`.

Why it exists:
- Keeps a stable URL for the approved shell artwork.
- Helps exact web export workflows that fetch and embed the image.

## 5. Confirm environment setup
Required runtime variable:
- `EXPO_PUBLIC_RORK_API_BASE_URL`

Behavior:
- If the base URL ends with `/api`, the feature requests `${baseUrl}/seapass-approved-shell`.
- Otherwise it requests `${baseUrl}/api/seapass-approved-shell`.
- If the env var is missing, it falls back to the direct R2 image URL.

## 6. Confirm packages exist
At minimum, keep these installed:
- `expo-router`
- `lucide-react-native`
- `react-native-svg`
- `expo-print`
- `expo-sharing`
- `react-native-view-shot`

## 7. How the feature functions
- `seaPassWebPass.ts` is the engine.
- It defines the data model, defaults, overlay coordinates, barcode generation, SVG composition, print HTML, and web PNG export.
- `SeaPassWebPass.tsx` renders the SVG in React Native using `SvgXml`.
- `seapass-generator.tsx` provides the admin UI, preview surface, edit form, reset button, and export actions.
- `seapassExport.ts` handles native PNG/PDF export.
- `seapassExport.web.ts` handles web PNG/PDF export.

## 8. Export flow details
### Native PNG
- Captures the hidden full-resolution pass with `captureRef`.
- Shares the PNG if sharing is available.

### Native PDF
- Generates exact HTML from the SVG.
- Creates a PDF with `expo-print`.
- Shares the file or opens printing.

### Web PNG
- Converts the approved shell image to a data URL.
- Builds final SVG markup.
- Draws it into a canvas.
- Downloads a PNG.

### Web PDF
- Opens a new window.
- Writes print HTML.
- Calls `print()`.

## 9. Visual rules to preserve
- Keep the approved shell image as the base layer.
- Only overlay changed values in their mapped mask areas.
- Preserve the top-right time/date paired rendering behavior.
- Keep the barcode caption format as `reservation-stateroom`.
- Preserve `SEA_PASS_VIEWBOX` at `1024 x 1536` for export fidelity.

## 10. Recommended validation after rebuild
- Open `/seapass-generator` as an admin.
- Change every field and verify the overlay updates.
- Reset to defaults.
- Export PNG on web and native.
- Export/print PDF on web and native.
- Verify the approved shell image loads from proxy or fallback.
