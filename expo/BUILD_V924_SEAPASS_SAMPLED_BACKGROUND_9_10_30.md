# Easy Seas v924 / 9.10.30 — SeaPass Port Exact Sampled Background

## Scope
- SeaPass generator background correction only.
- Sync Now, completed-cruise sync, logo assets, and data logic unchanged from v923.

## Fix
- Removed the hard-coded visible port-mask look by adding sampled-source mask support.
- The port mask now samples a clean blank patch from the same approved SeaPass card shell, to the right of the port value line, and stretches that exact artwork/background over the old baked-in port value.
- This avoids guessing a neutral off-white color while also avoiding sampling the old baked-in port text that previously bled into the legal paragraph.

## Version
- expo.version: 9.10.30
- ios.buildNumber: 9.10.30
- android.versionCode: 9130
