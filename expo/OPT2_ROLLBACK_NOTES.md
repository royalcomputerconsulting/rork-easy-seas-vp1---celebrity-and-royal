# OPT-2 Rollback Notes

To roll back OPT-2, restore `OPT1_CANONICAL_PERSONAL_CASINO_HISTORY.zip`.

OPT-2 adds only the isolated `lib/optimization/value/` domain, its tests, and checkpoint documentation. It does not modify any current UI route, provider, storage transaction, package file, Expo/React Native configuration, or recommendation authority. All optimizer feature flags remain disabled and `legacy-static` remains active.
