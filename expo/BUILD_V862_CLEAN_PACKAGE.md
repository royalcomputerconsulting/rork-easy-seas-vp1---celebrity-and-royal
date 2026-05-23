# Easy Seas v862 Clean Expo Package

Built from uploaded `easyseas_build_v861_sync_separation_qa_patch(4).zip`.

Packaging fix applied:
- Repacked ONLY the Expo project contents from `easyseas_oldsync_restored/expo/`.
- Removed the bad parent wrapper/root structure.
- The ZIP opens directly to `package.json`, `app.json`, `app/`, `components/`, `lib/`, `state/`, etc.
- No `easyseas_oldsync_restored/` wrapper is included.
- No parent Library/home-directory files are included.

Sync changes present in this build:
- Royal Caribbean sync page includes separate completed-cruises sync flow.
- Provider includes completed-cruises sync in-flight guard.
- Royal Caribbean config uses `https://www.royalcaribbean.com/myaccount` for the updated account/upcoming/completed cruise page path.
- Completed cruise rows are converted from Royal loyalty sailing history when captured.

Created: 2026-05-21
