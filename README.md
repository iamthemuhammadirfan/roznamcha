# روزنامچہ · Roznamcha

An offline-first Urdu Android app that records construction wages and advances. It is built with Expo SDK 57, PowerSync and Supabase. The full product spec is in [SPEC.md](SPEC.md).

The core rule is that **nobody types a balance.** The app works out every balance from attendance and an append-only ledger (`src/lib/balance.ts`). A wrong entry is cancelled by a correction entry and is never edited. Postgres RLS enforces this, not only the app.

## What's built (week one of the spec)

| # | Item | Where |
|---|---|---|
| 1 | Expo app with forced RTL, Naskh/Nastaliq fonts, expo-updates, fingerprint runtime | `app.json`, `src/app/_layout.tsx` |
| 2 | Supabase schema: UUID keys, business + membership, RLS, attendance audit trigger, append-only ledger guard, app_config | `supabase/migrations/` |
| 3 | PowerSync schema (from Drizzle), Supabase connector, "not saved" list for rejected uploads, sync badge | `src/db/`, `powersync/sync-config.yaml` |
| 4 | Projects CRUD + picker; the project code is always in the header | `projects.tsx`, `project-form.tsx` |
| 5 | Worker directory with duplicate check (same phone, or same name + father's name), assignment with a rate | `directory.tsx`, `worker-form.tsx`, `assign.tsx` |
| 6 | Advance/payment entry, per-project ledger, grand total, owner-only corrections, rate change | `entry.tsx`, `worker/[id].tsx` |
| 7 | Parchi: the receipt is rendered as a view, captured to PNG, cached, shared through the share sheet, and `receipt_sent_at` is stamped. There is also a WhatsApp text fallback | `ui/parchi.tsx`, `receipt/[id].tsx` |

Some week-two items are also in: the sync status badge, the rejected-uploads list, the app_config minimum-version gate, and the restart-for-update banner. The balance logic already counts attendance, so the only remaining attendance work is the screen that marks it.

**Not built yet:** calendar attendance, hafta settlement, PIN lock, CSV export and Sentry.

## Run it

```bash
bun install
bun run test        # balance / money / date logic
bun run typecheck
```

PowerSync uses a native SQLite module, so **Expo Go will not work** and you need a dev build:

```bash
bunx eas-cli login
bunx eas-cli init                    # writes extra.eas.projectId into app.json. Commit it.
bunx eas-cli update:configure        # writes updates.url into app.json
bun run build:dev                    # dev-client APK. Install it on a real Android phone.
bun start                            # then open the dev build and connect
```

If `.env.local` is missing, the app runs in **local-only test mode**. There is no sign-in and no sync, and the data stays on that phone, so you can try the Urdu UI on day one. Clear the app's data before you point the phone at the real backend.

## Backend setup (once)

Create the Supabase, PowerSync and Expo accounts under an email your friend controls, and add yourself as a member.

1. **Supabase** (Mumbai region). Link the project and push the migration:
   ```bash
   bunx supabase login && bunx supabase link --project-ref <ref>
   bunx supabase db push
   ```
   Turn off public sign-ups (Authentication → Providers → Email). Create the owner and munshi users, then run `supabase/seed-business.sql` with their emails filled in.
2. **PowerSync** (India region). Follow PowerSync's Supabase guide to create its replication role (the migration already creates the `powersync` publication), connect the instance to the database, and turn on Supabase Auth. Paste `powersync/sync-config.yaml` into Sync Streams, then validate and deploy.
3. Copy `.env.example` to `.env.local` and fill in the three URLs and keys. For EAS builds, add the same values as EAS environment variables.
4. Test offline sync: turn on airplane mode, record an advance, go back online, and check that the row is in Postgres.

## Ship an APK

```bash
bun run build:apk    # production profile, buildType apk, versionCode auto-incremented
```

After the first build, back up the keystore with `bunx eas-cli credentials` and store it somewhere that outlives your laptop. Most JS fixes after that can go out over the air:

```bash
bunx eas-cli update --channel preview --message "..."
bunx eas-cli update --channel production --message "..."
```

## Layout

```
src/
  strings.ur.ts        every user-facing string (have the owner read them aloud)
  lib/                 pure logic: balance, money (paisa), dates (YYYY-MM-DD), ref codes, and tests
  db/                  Drizzle tables → PowerSync schema, live-query hooks, mutations, Supabase connector
  state/               session (auth + membership), active project
  ui/                  theme, Urdu text + LTR number runs, controls, balance chip, parchi, sync badge
  app/                 expo-router screens
supabase/migrations/   the book of record: schema, RLS, triggers
powersync/             Sync Streams config
```

## RTL notes for anyone editing the UI

- Use `start`/`end` or `flexDirection: 'row'`, which already flips. Don't also reverse arrays.
- Don't set `textAlign: 'left'|'right'`. Under forced RTL, Android mirrors them. The default (start) already puts text on the right.
- Put digits in their own `<Num>`. Show money with `<Money>`, which prints "5,000 روپے": never ₨ and never a minus sign.
- PowerSync does not enforce unique indexes on the phone. Uniqueness checks live in `db/mutations.ts`, and Postgres checks again when the data uploads.
