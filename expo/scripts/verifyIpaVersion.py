#!/usr/bin/env python3
"""Verify the actual built IPA contains the expected App Store version."""
import plistlib
import sys
import zipfile
from pathlib import Path

EXPECTED_VERSION = "12.4.2"
EXPECTED_BUILD = "314"

if len(sys.argv) != 2:
    print("Usage: python3 scripts/verifyIpaVersion.py /path/to/EasySeas.ipa", file=sys.stderr)
    raise SystemExit(2)

ipa = Path(sys.argv[1])
if not ipa.is_file():
    print(f"IPA not found: {ipa}", file=sys.stderr)
    raise SystemExit(2)

with zipfile.ZipFile(ipa) as zf:
    candidates = [n for n in zf.namelist() if n.startswith("Payload/") and n.endswith(".app/Info.plist")]
    if len(candidates) != 1:
        print(f"Expected one app Info.plist, found {len(candidates)}: {candidates}", file=sys.stderr)
        raise SystemExit(1)
    info = plistlib.loads(zf.read(candidates[0]))

version = str(info.get("CFBundleShortVersionString", ""))
build = str(info.get("CFBundleVersion", ""))
print(f"IPA CFBundleShortVersionString={version}")
print(f"IPA CFBundleVersion={build}")

if version != EXPECTED_VERSION or build != EXPECTED_BUILD:
    print(f"FAIL: expected {EXPECTED_VERSION} ({EXPECTED_BUILD})", file=sys.stderr)
    raise SystemExit(1)

print(f"PASS: IPA contains Easy Seas {EXPECTED_VERSION} ({EXPECTED_BUILD})")
