#!/usr/bin/env bash
# Run the Maestro flows in .maestro/; output and screenshots go to .maestro/out/.
# Not a package.json script: see scripts/emulator.sh.
exec maestro test .maestro --test-output-dir=.maestro/out "$@"
