# Android Distribution & Cross-Platform Monetization Specifications

## Overview
Update the existing EasySeas Expo/React Native app to be fully ready for Android distribution on Google Play Store, including subscriptions via Google Play Billing using RevenueCat. Do NOT remove existing functionality. Keep the same monetization tiers and gating behavior already implemented for iOS, but ensure Android purchase flow works correctly and passes Play policy expectations.

## 1) Android App Identity + Build Config
- Ensure Android is configured with a stable applicationId (package name) and versioning:
  - android.package (Expo) or applicationId (native) must be consistent and production-ready
  - Ensure versionCode increments properly for Android builds and versionName matches marketing version
  - Add/update Android adaptive icons and splash to meet Play requirements
  - Verify permissions are minimal and justified

## 2) Google Play Billing + RevenueCat (Android)
- Configure RevenueCat for Android:
  - Use the Android public SDK key (do NOT hardcode; read from env/config)
  - Use the same entitlement names:
    - basic (maps to easyseas_basic_monthly)
    - pro (maps to easyseas_pro_monthly + easyseas_pro_annual)
- Ensure Android purchase flows and restore flows work:
  - Purchase product
  - Handle pending purchases
  - Restore purchases (query existing purchases / customerInfo refresh)
- Ensure the app gracefully handles:
  - Offline state
  - Billing not available / user not signed into Play
  - Subscription purchase canceled
  - Subscription already owned

## 3) Products (Android Play Console Parity)
Ensure the Android products match the iOS product IDs exactly (same strings):
- easyseas_basic_monthly ($9.99/mo)
- easyseas_pro_monthly ($14.99/mo)
- easyseas_pro_annual ($79/yr)

In app, make sure the paywall fetches Offerings from RevenueCat and displays prices from the store dynamically (don't hardcode currency strings).

## 4) Trial and View-Only Behavior (Android)
Keep the exact existing tier resolver logic:
- tier = 'trial' | 'view' | 'basic' | 'pro'
- Trial is 30 days from first launch, stored securely
- After trial ends with no entitlement → view-only mode

**Important Android-specific note:**
- Users can reinstall more easily; store trial dates in secure storage and also (if user accounts exist) persist server-side to reduce abuse. If no backend, keep secure storage as-is.

## 5) Android Navigation Gating (Same Behavior)
Retain:
- SLOTS tab blocked unless tier === 'pro' (intercept tap and show paywall)
- Analytics / Agent X / Alerts gated to Pro
- Offer Optimizer NOT gated
- View-only disables sync/add/edit/run actions but allows browsing

## 6) Play Store Compliance / UX
- Add clear "Subscriptions" explanation on paywall:
  - billing period
  - auto-renew
  - cancel anytime in Play Store
- Add "Restore purchases" button on the universal paywall
- Ensure the subscription management link or instructions are shown on Android (ex: "Manage in Google Play")

## 7) Build Output Requirements (Android)
- Produce a Google Play–ready build artifact:
  - Prefer AAB (Android App Bundle) for Play Store
  - Ensure build scripts and config are correct for Expo/EAS:
    - Include eas.json config for Android production builds if applicable
    - Set correct gradle settings if native

## 8) Testing Support
Add a developer/test screen or debug logging (minimal) to confirm:
- Current tier
- trialEnd date
- active entitlements
- current offerings loaded

This should be hidden behind a dev flag or only enabled in debug builds.

## 9) Acceptance Tests (Android)
1. Install on Android device signed into Google Play
2. Paywall loads offerings with correct prices
3. Purchases work:
   - Basic monthly enables basic tier
   - Pro monthly enables pro tier
   - Pro annual enables pro tier
4. Restore purchases re-enables entitlements after reinstall
5. SLOTS tab is blocked unless Pro
6. View-only disables sync/add/edit/run actions after trial expiry

## Unified Cross-Platform Monetization Requirements

### App Model
- Paid app ($9.99) with 30-day BASIC trial starting on first launch

### RevenueCat Products (Identical on iOS and Android)
- easyseas_basic_monthly ($9.99/month) → entitlement "basic"
- easyseas_pro_monthly ($14.99/month) → entitlement "pro"
- easyseas_pro_annual ($79/year) → entitlement "pro"

### Tier Precedence
pro > basic > trial > view-only

### Global Tier Resolver
tier = "trial" | "view" | "basic" | "pro"

**Rules:**
- If pro entitlement is active, tier = "pro"
- Else if basic entitlement is active, tier = "basic"
- Else if current time is before trialEnd, tier = "trial"
- Else tier = "view"

### Trial System
- Implement in-app (paid apps don't support store trials)
- On first launch, store trialStart and trialEnd (trialStart + 30 days) in secure storage (Keychain/Keystore)
- Do not reset these values if they already exist
- Optionally persist to backend user profile if available

### RevenueCat Configuration
- Configure using environment/config values (no hardcoded keys)
- On app startup:
  - Configure Purchases
  - Fetch customerInfo
  - Listen for entitlement changes
  - Update tier state reactively
- Implement Restore Purchases
- Handle gracefully:
  - Offline state
  - Canceled purchases
  - Pending purchases on Android
  - Already-owned subscriptions
  - Billing-unavailable scenarios

### Feature Gating Rules
- **Analytics**: PRO only
- **Agent X**: PRO only
- **Alerts**: PRO only
- **Offer Optimizer**: NOT gated (always accessible)
- **SLOTS tab/page**: Inaccessible unless tier === "pro"
  - Don't limit individual machines
  - Non-PRO user taps SLOTS tab → block navigation and show paywall modal
  - Deep link to SLOTS and user not PRO → redirect to paywall

### View-Only Mode (Trial Expired, No Entitlement)
**Can do:**
- Browse all existing data

**Cannot do:**
- Sync
- Import new data
- Add/edit data
- Start sessions
- Track activity
- Create alerts
- Run Agent X

These actions must be disabled/greyed out. Tapping any disabled action must open a view-only paywall modal.

### Paywalls

#### Universal Paywall
Create a dedicated screen/route that displays:
- BASIC $9.99/month
- PRO $14.99/month
- PRO Annual $79/year (highlight as Best Value and Save $100+ vs monthly)
- Basic vs Pro feature comparison
- Subscribe buttons and Restore Purchases
- Current status (trial days remaining, view-only, basic, or pro)
- Load prices dynamically from RevenueCat offerings (don't hardcode currency)

#### Contextual Paywalls
- Locked features (Analytics, Agent X, Alerts, SLOTS): Show modal with feature-specific message and CTA "Upgrade to Pro", highlighting $79 annual plan
- View-only users attempt blocked actions: Show "View-only mode — Reactivate with Basic or Pro to sync/add new data" with CTA to universal paywall

#### Upgrade to Pro Button
- Add small unobtrusive "Upgrade to Pro" button next to Club Royale tier/points display (e.g., near "SIGNATURE" or "DIAMOND PLUS")
- Navigate to universal paywall
- Visible for trial, view, and basic users
- Hidden or replaced with "PRO Active" for pro users

### Android-Specific Requirements
- Stable applicationId/android.package
- Proper versionCode and versionName
- Adaptive icons
- Splash screen
- Minimal justified permissions
- RevenueCat Android SDK key from config
- Google Play Billing support:
  - Pending purchases
  - Restore flows
  - Offline handling
  - Cancellation
- Display subscription management instructions for Android ("Manage in Google Play")
- Produce Play-ready AAB builds using proper EAS/Gradle configuration

### Build Output
- Support iOS and Android simultaneously
- Identical product IDs and entitlements

### Debug Logging
- Minimal debug logging in debug builds only
- Show:
  - Current tier
  - trialEnd
  - Active entitlements
  - Offerings loaded

### Acceptance Tests
1. Fresh install → tier=trial for 30 days
2. Trial and basic users:
   - Can use offer optimizer
   - Cannot access analytics, Agent X, alerts, or SLOTS
3. After trial with no subscription:
   - tier=view
   - Browsing allowed
   - Actions blocked with paywall
4. Basic subscription:
   - Removes view-only restrictions
   - Keeps Pro-only locks
5. Pro subscription:
   - Unlocks analytics, Agent X, alerts, and SLOTS
6. Restore purchases works after reinstall
7. Android purchases, pending handling, and AAB builds pass Play Console checks

## Deliverables
- Working cross-platform build
- Centralized access control
- Unified purchase service
- Paywall system implemented
- Minimal logging
- No regressions
- Platform-agnostic RevenueCat service (if currently iOS-only)
