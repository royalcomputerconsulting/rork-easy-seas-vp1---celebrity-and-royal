# Build v949 — Large Import Performance + Casino Availability Label Fix

Version: 9.10.49

Changes:
- Preserves v948 Royal/Celebrity brand-separated sync work.
- Preserves confirmed SeaPass Generator text-rendering fix.
- Optimizes large imported offer CSV handling after 1,000+ cruise rows are loaded.
- Replaces the Smart Import Review modal's ScrollView row rendering with a virtualized FlatList so 1,078 imported rows do not mount all at once.
- Reduces heavy dashboard work by keeping Casino History focused on booked/completed cruises instead of also mapping every imported offer row.
- Samples/scales aggregate offer-value calculations inside CasinoOfferCard instead of recalculating every imported sailing row on every render.
- Removes noisy per-card value/name console logging that becomes expensive with large offer imports.
- Adds a custom CruiseCard memo comparator so booked cruise cards do not re-render just because a parent tab rebuilt callback functions.
- Updates booked cruise card copy from “Casino Opp 84” to “Casino Availability Score 84”.
- Updates sea/port day text to “4 sea days • 2 port days”.
- Makes the full casino availability score + sea/port day text green.

QA notes:
- app.json parses.
- package.json parses.
- Build should retain the v948 sync separation and v944 dependency cleanup.
