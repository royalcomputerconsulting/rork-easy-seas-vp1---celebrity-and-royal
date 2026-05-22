# Easy Seas Old Sync Restore Patch

This build restores the full Royal Caribbean sync code from `Archive(10).zip` into `expo/lib/royalCaribbean/`.

Only Royal Caribbean endpoint/navigation changes were made:

- `https://www.royalcaribbean.com/account/upcoming-cruises` -> `https://www.royalcaribbean.com/myaccount`
- Royal account-home capture now uses `/myaccount` instead of the old `/account` landing page.
- Existing old working login/auth detection was preserved.
- Network capture was extended to recognize `/myaccount` as the bookings/account page.

Celebrity and Carnival URLs were left unchanged.
