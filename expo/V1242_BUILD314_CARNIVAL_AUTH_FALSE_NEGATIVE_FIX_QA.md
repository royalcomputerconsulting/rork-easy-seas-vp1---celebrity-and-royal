# Easy Seas 12.4.2 Build 314 — Carnival Authentication False-Negative Repair

## Failure reproduced from the supplied sync log

The supplied Carnival sync log showed two preflight failures:

- `Carnival authentication verification failed before the sync lock was acquired.`

Between those failures, the same WebView successfully received authenticated data from:

- `/profilemanagement/api/v1.0/Profiles`

and captured the Carnival Panorama booking. This proved that the Carnival session was valid while the old verifier was incorrectly reporting `login_expired`.

## Root cause

The old preflight verifier required all of the following:

1. a Carnival profile URL;
2. no visible login/password form; and
3. either a JavaScript-readable `user` cookie or member text already rendered in the page body.

Carnival commonly keeps identity cookies HttpOnly, so JavaScript cannot read them. Its profile pages are also SPA/API-driven, so the protected profile request can succeed before VIFP/member text appears in the DOM. The old verifier therefore rejected a valid session.

A second race existed after manual verification: the recurring DOM-only authentication detector could emit a weaker `not logged in` result and overwrite the valid status.

## Repair implemented

### Protected profile API is now the primary authority

`injectCarnivalAuthenticationProbe()` now performs an authenticated same-origin GET against:

`/profilemanagement/api/v1.0/Profiles`

The request uses the WebView cookie jar with `credentials: 'include'` and `cache: 'no-store'`.

A successful 2xx JSON response from the protected endpoint verifies the login. HTTP 401/403, a redirect to a login/security route, or an authentication-error payload correctly reports an expired session.

### Safe fallback behavior

- Explicit login/password pages always override stale evidence.
- A short two-minute protected-API fallback covers a transient probe network error.
- The recurring authentication detector remembers successful protected-profile responses for five minutes.
- A weaker DOM-only false-negative can no longer overwrite a recent protected-API verification.
- A protected API rejection clears the retained evidence immediately.

### Authentication probe isolated from data extraction

The verification request is tagged internally as an authentication probe. The network monitor still records its authentication success but does not treat that request as the real booking extraction step. This prevents misleading pre-sync booking capture messages and duplicate data processing.

## Files intentionally changed

- `lib/carnival/carnivalSafeSync.ts`
- `lib/royalCaribbean/authDetection.ts`
- `state/RoyalCaribbeanSyncProvider.tsx`
- `scripts/testV1242Build314CarnivalAuthFalseNegativeFix.js`
- this QA document and its test/manifest outputs

## Files and configuration intentionally untouched

The following original Build 314 files remain byte-for-byte unchanged:

- `app.json`
- `app.config.js`
- `package.json`
- `node-version`

No npm, Bun, or Yarn lockfile was added or changed. No `.github/workflows` directory was added or changed. The marketing version remains `12.4.2`, iOS build number remains `314`, and Android version code remains `120405`.

## Validation completed

- TypeScript syntax/transpile validation passed for every modified TypeScript/TSX file.
- Generated WebView authentication scripts compile as JavaScript.
- Simulated protected profile API HTTP 200 returns authenticated.
- Simulated HTTP 401 returns login expired.
- Simulated visible Carnival login page returns login expired.
- All 22 project test scripts passed, including all prior Carnival Priority 0–8 tests.

## Remaining real-device validation

Static, simulated, and project regression tests are complete. A live authenticated iOS/Android run is still required because Carnival controls the production WebView/API behavior. The corrected live log should now show:

1. `Carnival login verified against the protected Carnival profile API.`
2. `Carnival authentication preflight passed via the protected profile API.`
3. the exclusive Carnival sync lock being acquired;
4. Step 1 offer discovery beginning instead of returning `login_expired`.
