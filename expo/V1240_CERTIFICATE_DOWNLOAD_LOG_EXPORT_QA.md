# EasySeas v12.4.0 — Certificate Download Live Log + Export

## Baseline

Built directly from the v12.3.9 certificate batch/compact offer build.

## Version

- App version: `12.4.0`
- iOS build number: `12.4.0`
- Android version code: `120400`
- Runtime marker: `v12.4.0-certificate-download-live-log-export`

## Added functionality

1. Added a dedicated certificate download logger shared by Certificate Codes and Certificate Lookup.
2. Added a live status blurb that states which A/C certificate code or batch is currently downloading.
3. Added timestamped informational, success, warning, and error entries.
4. Added per-code success entries with the number of eligible sailing groups found.
5. Added explicit batch-failure and individual-retry entries.
6. Added a collapsible Certificate Log panel to both certificate screens.
7. Added native share/export and web download of a `.log` troubleshooting file.
8. Added a Clear Log control that is disabled during an active download.
9. Download All starts a fresh log session; individual certificate downloads append to the active/history log.
10. The exported log includes engine version, export time, session start, current status, certificate codes, timestamps, and severity.

## Files added

- `lib/certificates/certificateDownloadLogger.ts`
- `components/certificates/CertificateDownloadLogPanel.tsx`
- `scripts/testV1240CertificateDownloadLog.js`
- `V1240_CERTIFICATE_DOWNLOAD_LOG_EXPORT_QA.md`

## Files updated

- `lib/certificates/certificateBatchDownload.ts`
- `app/certificate-codes.tsx`
- `app/certificate-lookup.tsx`
- `app.json`
- `package.json`

## Verification

Run:

```bash
node scripts/testV1240CertificateDownloadLog.js
```

Expected:

```text
PASS testV1240CertificateDownloadLog
```
