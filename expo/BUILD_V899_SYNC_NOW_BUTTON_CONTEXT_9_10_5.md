# Easy Seas v8.9.9 / App 9.10.5 Sync Now Button Context Repair

Fixed the v8.9.8 failure where real coded offer buttons were skipped because the nearest ancestor text included page chrome or the READY TO PLAY banner elsewhere on the page.

Changes:
- Incremented app.json to 9.10.5 / iOS 9.10.5 / Android 9105.
- Tightened banner filtering so coded offers are never rejected as READY TO PLAY banners.
- Only skips compact explicit READY TO PLAY / casino-credit controls.
- Keeps v861 button-driven offer logic and v863 multi-date expansion.
- Completed-cruise sync remains untouched.
