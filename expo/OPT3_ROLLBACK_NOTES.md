# OPT-3 Rollback Notes

To roll back OPT-3, restore `OPT2_PERSONAL_CERTIFICATE_VALUE_MODEL.zip`.

OPT-3 adds only the isolated `lib/optimization/models/` layer, its tests, and checkpoint evidence. It does not modify current UI, storage providers, package files, or production recommendation authority. All optimizer feature flags remain disabled.
