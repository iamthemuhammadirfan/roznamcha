#!/usr/bin/env bash
# Boot the Android emulator (AVD Pixel10 by default; override with AVD=<name>).
# Kept out of package.json "scripts": those are part of the runtime fingerprint, so
# adding one there stops over-the-air updates reaching the installed APK.
exec emulator -avd "${AVD:-Pixel10}" -no-snapshot-save -no-boot-anim
