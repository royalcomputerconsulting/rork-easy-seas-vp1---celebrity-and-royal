# v1068 Casino Stable Route Rebuild

## Why this build exists
The Casino tab continued closing the app because the route still loaded the large legacy analytics module and eagerly executed a large calculation/render graph. Diagnostic exports showed no usable Casino route stack trace; the only captured Casino events were value/economics console output and RevenueCat/App Store warnings, which means the crash was occurring before the route-level diagnostics could reliably identify a child card.

## Root QA findings
- The route was too large and fragile: one tab route imported or loaded the entire analytics module and its many card dependencies.
- Heavy cruise economics/value calculations were being executed immediately on Casino tab entry.
- Casino diagnostics were being drowned out by noisy console output from value calculations.
- RevenueCat entitlement calls were not needed for the Casino tab and created unrelated App Store errors in the crash window.
- The previous crash boundaries were inside or adjacent to the crash-prone module, so module-load/native import issues could still close the app before a useful fallback rendered.

## Fix strategy
Replace the Casino route with a stable, self-contained Casino screen that does not dynamically require the legacy heavy analytics component and does not call RevenueCat entitlement code. The route still shows the four Casino workflows and core calculations:

1. Portfolio
2. Value
3. Play
4. Forecast

## Preserved functionality
- Club Royale tier and point display
- Current coin-in estimate
- Historical casino points
- Cruise economics summary
- Offer code classification
- Offer attribution ledger
- True make-out ledger
- Certificate-created-by-play chain display
- Keep playing / stop playing decision
- Colorful progression bars
- Stable diagnostics

## Diagnostics added
- CASINO_STABLE_ROUTE_MOUNTED
- CASINO_STABLE_TAB_SELECTED
- CASINO_STABLE_BOOKED_BUILD_FAILED
- CASINO_STABLE_ECONOMICS_FAILED
- CASINO_STABLE_ATTRIBUTION_FAILED
- CASINO_STABLE_MANUAL_REFRESH

## Version
- package.json: 9.11.58
- app.json expo.version: 9.11.58
- iOS buildNumber: 9.11.58
- Android versionCode: 91158
