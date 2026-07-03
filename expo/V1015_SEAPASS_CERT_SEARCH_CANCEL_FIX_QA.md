# V1015 SeaPass Certificate Search Cancel Fix QA

- SeaPass dynamic date and ship-code overlays reduced in size/weight so they no longer appear heavier than the original field typography.
- Certificate modal close/X now cancels the active scrape run, aborts device fetches, clears loading state, and ignores late backend/device results.
- Certificate search/filter now operates on grouped unique sailings rather than raw duplicate certificate rows.
- Unique sailing results include a level count and best visible certificate code.
- Downloaded certificate PDF chips now use high-contrast black/dark text on white backgrounds.
