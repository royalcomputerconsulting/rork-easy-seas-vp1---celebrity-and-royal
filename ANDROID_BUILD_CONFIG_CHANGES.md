# Android Build Configuration Changes Required

## app.json Changes

You need to manually update `app.json` with the following changes:

### 1. Add Runtime Version
```json
"runtimeVersion": "4.3.0",
```

### 2. Update Android Configuration
Replace the `android` section with:
```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "package": "app.rork.easyseas",
  "versionCode": 43,
  "permissions": [
    "INTERNET",
    "android.permission.VIBRATE"
  ]
}
```

**Changes explained:**
- Simplified package name to `app.rork.easyseas` (stable, production-ready)
- Added `versionCode: 43` (Android build number, increment for each release)
- Removed unnecessary permissions (READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE)
- Kept only minimal justified permissions (INTERNET for syncing, VIBRATE for haptics)

## RevenueCat Configuration

### Product IDs to Configure in RevenueCat Dashboard

**iOS & Android (identical):**
- `easyseas_basic_monthly` - $9.99/month → entitlement "basic"
- `easyseas_pro_monthly` - $14.99/month → entitlement "pro"  
- `easyseas_pro_annual` - $79/year → entitlement "pro"

### Entitlements to Create
1. **basic** - Maps to easyseas_basic_monthly
2. **pro** - Maps to easyseas_pro_monthly AND easyseas_pro_annual

### Environment Variables
Ensure these are set:
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` - iOS public SDK key
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` - Android public SDK key

## Next Steps After app.json Update

1. Build Android AAB: `eas build --platform android --profile production`
2. Test on Android device with Google Play account
3. Verify purchases, restore, and subscription management work
4. Submit to Google Play Console
