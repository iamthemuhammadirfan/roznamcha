This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Roznamcha rules (read SPEC.md for the why)

- Balances are derived (`src/lib/balance.ts`), never stored or typed. The ledger is append-only: fix mistakes with a `correction` entry, never an update/delete.
- Money is integer paisa; calendar days are `YYYY-MM-DD` strings.
- Every user-facing string goes in `src/strings.ur.ts` **and** `src/strings.en.ts` (typecheck fails if English is missing). Screens use `t` from `@/i18n`; the parchi and its WhatsApp text always use `ur`.
- Urdu is RTL, English LTR; the language is fixed per launch (`@/i18n` reads `I18nManager.isRTL`) and switching restarts the app. Never use `left`/`right` or explicit `textAlign` left/right; digits go in `<Num>`, money in `<Money>`.
- Urdu text uses Jameel Noori Nastaleeq with ~2× line height (see `src/ui/text.tsx`); don't put Urdu text in fixed-height boxes.
- PowerSync does not enforce unique indexes locally — enforce them in `src/db/mutations.ts`. Server rules live in `supabase/migrations/`; add a new migration rather than editing an applied one.
- Run `bun run test`, `bun run typecheck`, `bun run lint` before calling a change done.

## Local database (playground)

There is one live Supabase project and one PowerSync instance; the client (beconHQ) works on them. Try anything server-side locally first.

- `./scripts/local-db.sh up` starts a local Supabase (`supabase/config.toml`, ports 553xx, so it runs beside other local stacks) and a self-hosted PowerSync (`powersync/local/config.yaml`, port 55380, same `powersync/sync-config.yaml` as production). Then it points the dev app at them. It's built from `supabase/migrations` plus `supabase/seed.sql` (a copy of the live "Roznamcha Test"). Logins: `admin@yopmail.com` / `munshi@yopmail.com`, password `roznamcha-local`.
- `live` / `local` switch the dev app; `reset` rebuilds the database from migrations + seed; `seed` refreshes the seed from live "Roznamcha Test" (never a customer's business); `down` stops everything.
- Switching writes or removes only `.env.development.local`. Expo never reads it in a production export, so `eas update` always uses `.env.local` / the EAS production env (live). Dev builds clear their synced copy when the backend changes, so let sync go green first.
- Dev builds show a ribbon: green "local database" on the laptop, red "LIVE DATA" when signed in to a live business other than Roznamcha Test (don't save anything there). Release builds never show it.
- Order for server changes: migration or Edge Function → `local-db.sh reset` and test on the emulator → back up the live data and snapshot row counts → apply live → compare counts.

## Device testing (Android emulator + Maestro)

- These helpers live in `scripts/`, not `package.json` "scripts", and Maestro's ignore rule lives in `.maestro/.gitignore`, not the root `.gitignore`: both root files are part of the runtime fingerprint, and changing them stops OTA updates reaching installed APKs. Before an `eas update`, check `bunx eas-cli fingerprint:compare <production runtime>` matches.
- `./scripts/emulator.sh` boots the AVD (`Pixel10` by default, override with `AVD=<name>`). Then use `bun run start` for the dev client, or `bun run android` to build and install it.
- The `maestro` MCP server in `.mcp.json` lets agents tap, type, read the view hierarchy and take screenshots on the running emulator. Prefer it over raw `adb` for UI checks.
- `./scripts/logs.sh` streams the running app's JS logs (`ReactNativeJS`), crashes and warnings. When testing a scenario, run `adb logcat -c` first, then read logs afterwards with `adb logcat -d ReactNativeJS:V AndroidRuntime:E *:S`. Filter by tag, not `--pid`: a crash or relaunch changes the process id, so the crash would be filtered out.
- Flows live in `.maestro/*.yaml` and run with `./scripts/e2e.sh`. Output and screenshots go to `.maestro/out/`, which is gitignored. App id: `io.github.iamthemuhammadirfan.roznamcha`.
- Use Maestro selectors that match the visible Urdu/English text or a `testID`. Don't rely on screen coordinates, because the layout is RTL in Urdu.
- Install Maestro with `curl -fsSL https://get.maestro.mobile.dev | bash`. It needs Java 17+ and `~/.maestro/bin` on PATH.
