# Build v959 — All Offers Discovery + MyAccount Sync Route + CasinoAvailability Performance Repair

Base: v958 / v950 proven crawler branch.

Purpose:
- Preserve the v950/v958 working detail crawler that successfully scraped real rows for offer 26BCP105.
- Fix the remaining failure where only the first visible offer was discovered and Step 1 completed early.
- Keep the ACK/checkpoint handoff that proved rows are no longer lost after scraping.
- Route upcoming/bookings/loyalty through current /myaccount paths instead of stale /account paths.
- Reduce large-list slowdown caused by CasinoAvailability repeatedly failing MM-DD-YYYY date parsing and logging thousands of warnings.

Changes:
1. Offer discovery now runs multiple hydration/scroll passes and reads the expected All Offers/My Offers count.
2. Step 1 refuses partial offer discovery when the page advertises more offers than were discovered.
3. Offer discovery also collects offer detail anchors, not just visible View Sailings buttons.
4. If an offer link exists but no visible button is mounted, the crawler can direct-open the discovered detail URL.
5. Royal/Celebrity account capture routes now use /myaccount and /myaccount/my-trips paths.
6. CasinoAvailability now parses MM-DD-YYYY and MM/DD/YYYY dates directly and throttles repeated warnings.
7. Verbose CasinoAvailability per-cruise analysis logs are gated behind __EASYSEAS_VERBOSE_CASINO_AVAILABILITY.

Expected next test log:
- Offer discovery pass N: 5 offer(s), 5 View Sailings button(s), expected 5
- Opening offer 1/5 ... ACK checkpoint rows
- Opening offer 2/5 ... ACK checkpoint rows
- Upcoming / My Trips captures bookings from /myaccount/my-trips
- Loyalty captures from /myaccount/loyalty-programs
- CasinoAvailability no longer floods the log with Invalid sailDate MM-DD-YYYY warnings.
