# OPT-4 Rollback Notes

To roll back OPT-4, restore `OPT3_PERSONAL_PROBABILITY_LOSS_AND_TARGET_MODELS.zip`.

OPT-4 adds only the isolated `lib/optimization/engine/` decision layer, its tests, and checkpoint evidence. The existing `buildCertificateChaseRecommendation()` implementation, cards, routes, providers, packages, and configuration remain unchanged. Feature flags still default to disabled and `legacy-static` remains production authority.
