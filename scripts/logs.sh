#!/usr/bin/env bash
# Stream the running app's JS logs, crashes and warnings.
# Not a package.json script: see scripts/emulator.sh.
exec adb logcat --pid="$(adb shell pidof -s io.github.iamthemuhammadirfan.roznamcha)" ReactNativeJS:V AndroidRuntime:E '*:W'
