const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const { AUTH_DETECTION_SCRIPT } = loadTs('lib/royalCaribbean/authDetection.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const settings = read('app/(tabs)/settings.tsx');
const loyaltyProvider = read('state/LoyaltyProvider.tsx');
const confirmedCruises = read('constants/confirmedBookedCruises.ts');

// The before-content network bridge must compile as browser JavaScript and capture only
// reusable Royal request headers without logging or posting their values to React Native.
new Function(AUTH_DETECTION_SCRIPT);
assert(AUTH_DETECTION_SCRIPT.includes('function captureRoyalAuthenticatedHeaders'), 'Royal authenticated request-header capture helper is missing.');
assert(AUTH_DETECTION_SCRIPT.includes('window.__easySeasRoyalRequestHeaders'), 'Captured Royal request headers must be retained in page memory.');
assert(AUTH_DETECTION_SCRIPT.includes("'authorization', 'account-id', 'appkey', 'x-api-key'"), 'Expected Royal authentication header allow-list is missing.');
assert(AUTH_DETECTION_SCRIPT.includes('captureRoyalAuthenticatedHeaders(requestUrlBeforeFetch'), 'Fetch requests must be inspected before the original request runs.');
assert(AUTH_DETECTION_SCRIPT.includes('XMLHttpRequest.prototype.setRequestHeader = function(name, value)'), 'XHR setRequestHeader interception is missing.');
assert(AUTH_DETECTION_SCRIPT.includes("captureRoyalAuthenticatedHeaders(this._url || '', this._easySeasRequestHeaders || {})"), 'XHR request headers must be captured before send.');
assert(!AUTH_DETECTION_SCRIPT.includes("postMessage(JSON.stringify({ type: 'royal_request_headers'"), 'Authentication header values must never be bridged to native logs/state.');

// Isolate and compile the dedicated C&A browser script after resolving its only outer
// template interpolation. This catches the escaped-regex and injected-script defects that
// previously passed TypeScript but failed at WebView runtime.
const requiredMarker = provider.indexOf('function capturedPayloadHasRequiredLoyalty');
assert(requiredMarker >= 0, 'Dedicated Crown & Anchor capture script is missing.');
const scriptOpen = provider.lastIndexOf('webViewRef.current.injectJavaScript(`', requiredMarker);
const scriptStart = scriptOpen + 'webViewRef.current.injectJavaScript(`'.length;
const scriptEnd = provider.indexOf('\n          `);', requiredMarker);
assert(scriptOpen >= 0 && scriptEnd > scriptStart, 'Could not isolate the dedicated Crown & Anchor injected script.');
const loyaltyScript = provider.slice(scriptStart, scriptEnd)
  .replace(/\$\{[^}]+\}/g, 'https://example.invalid/loyalty');
new Function(loyaltyScript);

assert(loyaltyScript.includes('window.__easySeasRoyalRequestHeaders'), 'Dedicated C&A request must reuse headers captured from real authenticated Royal traffic.');
assert(loyaltyScript.includes("return names.length ? names.join(', ') : 'cookie session only'"), 'Cookie-authenticated sessions must be attempted even when no readable bearer token exists.');
assert(loyaltyScript.includes("credentials: 'include'"), 'Dedicated C&A requests must include the authenticated cookie session.');
assert(loyaltyScript.includes('easySeasLoyaltyProbe=1'), 'The hidden same-origin loyalty primer is missing.');
assert(loyaltyScript.includes("'https://www.royalcaribbean.com/api/guestAccounts/loyalty/info'"), 'Same-origin C&A fallback endpoint is missing.');
assert(loyaltyScript.includes("'https://www.royalcaribbean.com/api/account/loyalty'"), 'Alternate authenticated account loyalty endpoint is missing.');
assert(loyaltyScript.includes("'https://www.royalcaribbean.com/api/profile/loyalty'"), 'Alternate authenticated profile loyalty endpoint is missing.');
assert(loyaltyScript.includes('return hasCrownAnchorTier && hasCrownAnchorPoints'), 'C&A lane must not close until both tier and points are authoritative.');
assert(!loyaltyScript.includes('if (!headers) return'), 'Cookie-only C&A sessions must not be blocked by a null-header guard.');
assert(!loyaltyScript.includes('window.location.href = next'), 'C&A retries must remain alive in the current page context.');

// The primary Settings card must render the values committed by LoyaltyProvider after its
// storage/profile readback, not one-render-old UserProvider profile values.
assert(settings.includes('isPrimaryProfileSelected ? loyaltyClubRoyalePoints'), 'Primary Settings Club Royale points must come from verified LoyaltyProvider state.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyClubRoyaleTier'), 'Primary Settings Club Royale tier must come from verified LoyaltyProvider state.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyCrownAnchorPoints'), 'Primary Settings C&A points must come from verified LoyaltyProvider state.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyCrownAnchorLevel'), 'Primary Settings C&A tier must come from verified LoyaltyProvider state.');

// Exact tiers returned by Royal outrank calculated tiers, while stored profile values remain
// the safe fallback when a current lane is incomplete.
assert(loyaltyProvider.includes('const tierFromApi = extendedLoyalty?.clubRoyaleTierFromApi;'), 'Club Royale API tier source is missing.');
assert(loyaltyProvider.includes('const tierFromProfile = currentUser?.clubRoyaleTier;'), 'Club Royale persisted-tier fallback is missing.');
assert(loyaltyProvider.includes('const crownAnchorTierFromApi = extendedLoyalty?.crownAndAnchorTier'), 'C&A API tier source is missing.');
assert(loyaltyProvider.includes('const crownAnchorTierFromProfile = currentUser?.crownAnchorLevel'), 'C&A persisted-tier fallback is missing.');
assert(!confirmedCruises.includes('crownAndAnchorNumber:'), 'Booked-cruise manifests must never inject a loyalty identity into the selected profile.');

console.log('PASS testV1242Build314RoyalLoyaltyHeaderReplayAndPopulation');
