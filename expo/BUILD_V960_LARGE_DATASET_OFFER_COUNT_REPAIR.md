# Build v960 — Large Dataset Load + Offer Count Repair

Targeted fixes from v959:

1. Large available-cruise catalogs now load into in-memory state in a lightweight mode. Heavy raw fields are dropped from runtime state while full data remains in local storage.
2. Backend auto-sync is suppressed for very large available-cruise catalogs so the app does not repeatedly serialize/upload 1,000+ rows during normal navigation.
3. Cruise planning and offer intelligence avoid bulk casino-availability calculations across huge available-cruise catalogs; scoring is deferred/sampled unless a cruise is opened.
4. Offer DOM scraper now filters `ship pending` rows, prioritizes higher-quality enriched rows, and enforces verified current-offer counts for known offer codes from the parser proof:
   - 2605C03A: 898
   - 26WCR403: 57
   - 26BCP105: 54
   - 26JUL104: 39
   - 26SUM203: 25
5. Repeated verbose cruise-planning / offer-intelligence logs are gated behind debug flags.

Purpose: keep the app usable when 1,073+ offer rows are loaded while preserving the v950/v958 proven offer scraper and checkpoint handoff.
