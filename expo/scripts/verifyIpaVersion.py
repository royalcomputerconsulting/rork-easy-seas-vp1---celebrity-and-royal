#!/usr/bin/env python3
"""Verify the actual built IPA contains the expected App Store version."""
import plistlib
import sys
import zipfile
from pathlib import Path

EXPECTED_VERSION = "13.0.74"
# EAS owns CFBundleVersion remotely. Build 410 is the minimum release identity
# for the complete Casino restoration; remote auto-increment may produce more.
EXPECTED_MIN_BUILD = 445

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

try:
    numeric_build = int(build)
except ValueError:
    numeric_build = -1

if version != EXPECTED_VERSION or numeric_build < EXPECTED_MIN_BUILD:
    print(f"FAIL: expected {EXPECTED_VERSION} with build >= {EXPECTED_MIN_BUILD}", file=sys.stderr)
    raise SystemExit(1)

print(f"PASS: IPA contains Easy Seas {EXPECTED_VERSION} ({build}); minimum build {EXPECTED_MIN_BUILD}")
