# Easy Seas v926 / 9.10.32 — iOS export syntax fix

Fixed the iOS `expo export:embed` failure from v925.

Root cause:
- `STEP1_OFFERS_SCRIPT` is stored as a TypeScript template literal via `String.raw`.
- The embedded JavaScript contained regex literals with the sequence `${}` inside a character class: `/[.*+?^${}()|[\]\\]/g`.
- Even inside a regex literal embedded in a template string, `${` starts TypeScript/JavaScript template interpolation, which can break bundling/export.

Fix:
- Rewrote those regex character classes to avoid the `${` sequence while keeping the same escape behavior:
  - `/[.*+?^$()|[\]\\{}]/g`
- Re-ran `node --check` on the extracted injected Step 1 JavaScript successfully.

Version:
- expo.version: 9.10.32
- ios.buildNumber: 9.10.32
- android.versionCode: 9132

No functional Sync Now logic changes beyond the syntax/export fix.
