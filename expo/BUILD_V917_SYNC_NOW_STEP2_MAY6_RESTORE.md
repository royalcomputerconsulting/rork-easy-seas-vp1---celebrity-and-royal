# Easy Seas v917 / 9.10.23

This build is based on v916 and is intended to remove the Step 2 loop by using the May 6 working passive network-capture flow.

## Key points
- App version: 9.10.23 / Android 9123.
- Sync Now Step 1 remains the v861/v882 + provider-fill path that produces 5 offers / 1,145 available cruises.
- Step 2 does **not** inject the DOM upcoming-cruise extractor during Sync Now.
- Step 2 visits the same account trigger pages as the working May 6 build and waits for XHR/fetch capture: Upcoming Cruises, Courtesy Holds, Loyalty Programs, Account Home.
- Existing booked/completed cruises are preserved if no booking payload is captured.
- Completed-cruise sync, SeaPass generator, and logo assets were not changed.

## Expected marker
`Sync Now Step 2 capture engine v9.1.7 active`

You should no longer see repeated:
`Injecting Royal My Account upcoming-cruise extractor on hydrated page`
`Step 2 completed with 0 items`
