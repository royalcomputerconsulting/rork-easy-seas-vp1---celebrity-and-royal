# OPT-5 Rollback Notes

To roll back OPT-5, restore `OPT4_MARGINAL_EV_AND_OPTIMAL_STOPPING_ENGINE.zip`.

OPT-5 adds the isolated `lib/optimization/live/` layer, a saved-snapshot viewer route, tests, and checkpoint evidence. It does not change package/config/native files or enable the optimizer. Any saved live-state keys use the `easyseas:personal-optimizer:live:` namespace and can be safely ignored or removed after rollback.
