# Easy Seas 12.4.2 — App Store Version Hard-Lock QA

## Why this build exists

App Store Connect received an IPA whose embedded `CFBundleShortVersionString` was `9.17.1`, even though the source archive's static `app.json` said `12.4.1`. This proves a stale build-system/project value overrode the static source configuration before the IPA was created.

## Authoritative values

- Marketing version / `CFBundleShortVersionString`: **12.4.2**
- iOS build / `CFBundleVersion`: **311**
- Android versionCode: **120402**
- Bundle identifier: unchanged

## Three version safeguards

1. `app.json` and `package.json` contain 12.4.2.
2. `app.config.js` overwrites any incoming stale Rork/EAS value after spreading it.
3. `plugins/withForcedIOSVersion.js` writes 12.4.2 and 311 directly into Info.plist and Xcode build settings during native prebuild.

## Build-time verification

`package.json` defines:

```text
npm run verify:app-store-version
```

The same check is registered as `eas-build-post-install`. It simulates an incoming `9.17.1 / 309` config and proves the resolved config becomes `12.4.2 / 311`.

## Required upload check

Before uploading the IPA, inspect the built artifact and confirm:

```text
CFBundleShortVersionString = 12.4.2
CFBundleVersion = 311
```

Do not upload if the build dashboard or artifact still shows 9.17.1.

## Verify the actual IPA

After the iOS build finishes and before submission, run:

```text
python3 scripts/verifyIpaVersion.py /path/to/EasySeas.ipa
```

This inspects the IPA's real embedded `Info.plist`. It must report `12.4.2` and `311`. This is stronger than checking source configuration alone.
