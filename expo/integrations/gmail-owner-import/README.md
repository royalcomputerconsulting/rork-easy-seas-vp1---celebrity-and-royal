# Easy Seas owner Gmail importer

This integration is intentionally restricted to `scott.merlis1@gmail.com`.

## What it does

- Creates Gmail labels `Easy Seas Import`, `Easy Seas Processed`, and `Easy Seas Import Error`.
- Every five minutes, reads only threads carrying `Easy Seas Import`; immutable Gmail message IDs prevent repeats while still allowing a new reply in an already-processed thread to be discovered.
- Deduplicates by immutable Gmail message ID and SHA-256 attachment content, so forwarded copies are not imported twice.
- Saves supported attachments only in the private Google Drive folder `Easy Seas Mail Imports`. Apps Script's built-in Drive service requires Google's standard Drive scope even though this integration does not inspect, change, or delete unrelated Drive files.
- Classifies each message as a booking, change, cancellation, invoice, or manual-review item.
- Expands ZIP attachments with strict 100-file/50-MB safety limits and creates one review item per supported attachment.
- Runs an immediate mailbox scan when the owner taps **Sync Gmail**, in addition to the five-minute background trigger.
- Makes pending evidence available to the Easy Seas app through a random 256-bit connection token and retains its queue in the private Drive folder instead of Apps Script's small property store.
- Never deletes email and never changes a booked cruise without Easy Seas review/reconciliation.

## Google authorization

1. Open <https://script.google.com/home/projects/create> while signed in as `scott.merlis1@gmail.com`.
2. Name the project `Easy Seas Gmail Import`.
3. Replace `Code.gs` with the repository `Code.gs` file and add the repository `appsscript.json` as the manifest.
4. Run `authorizeAndInstall` once and approve Gmail, Drive, and trigger access.
5. Copy the `connectionToken` from the execution result. If authorization is already installed, run `showConnectionToken` to display the same copyable value without reading Gmail.
6. Deploy as a Web app. Execute as yourself. Access must be `Anyone`; the 256-bit token gates every response.
7. Paste the deployment URL and connection token into the owner-only Easy Seas Gmail Import screen.

Apply `Easy Seas Import` to mail that Easy Seas should review. Existing mail can be labeled in bulk. New mail can be labeled manually or by a Gmail filter.

## Privacy and safety

The deployment URL alone cannot read queued mail; every call also requires the generated token. Rotate access by deleting the `EASY_SEAS_CONNECTION_TOKEN_V1` Script Property and rerunning `authorizeAndInstall`. Disable monitoring with `uninstallEasySeasTrigger`.
