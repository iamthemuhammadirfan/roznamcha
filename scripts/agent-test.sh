#!/usr/bin/env bash
# Run the Maestro flows in .maestro/ with agent-device (about 3x faster than Maestro on
# Android). Runs from .maestro/out/ so screenshots and artifacts land there (gitignored).
# Close any open interactive session first (`agent-device close`): it holds the device.
# Not a package.json script: see scripts/emulator.sh.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/.maestro/out"
cd "$root/.maestro/out"
if [ "$#" -eq 0 ]; then set -- ../*.yaml; fi
exec agent-device test "$@" --maestro --platform android --artifacts-dir .
