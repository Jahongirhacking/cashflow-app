# Finance

Personal finance manager for Web and Android that turns your own Google Spreadsheet into a modern
financial dashboard. One TypeScript monorepo: an Expo client, a NestJS API and a shared domain package.

The full product specification lives in [docs/SPEC.md](docs/SPEC.md).

## Architecture

```
apps/mobile  (Expo + Expo Router, React Native Web)   ──HTTPS──▶  apps/api (NestJS)  ──▶  Google Sheets API  ──▶  user's spreadsheet
                 │                                                     │
                 └──────────────── packages/shared (domain types, Zod schemas, utils) ─┘
```

| Workspace         | Package           | Purpose                                                                                         |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `apps/mobile`     | `@finance/mobile` | Expo SDK 57 app. Web (desktop sidebar / mobile tabs) and Android from one codebase.             |
| `apps/api`        | `@finance/api`    | NestJS 12 REST API. Auth, spreadsheet access through a service account, analytics.              |
| `packages/shared` | `@finance/shared` | Transaction / investment / recurring / category / user models, Zod schemas, money & date utils. |
| `packages/config` | `@finance/config` | Shared `tsconfig` bases and ESLint rules.                                                       |

Key principles (see the spec): the spreadsheet is the data store, the API is the only thing that talks to
Google, amounts are always positive internally with the sign carried by `type`, and the client never sees
service-account credentials.

## Requirements

- Node 24 (`.nvmrc`, run `nvm use`). Node 20.19+, 22.12+ and 23.11+ also work; Node 23.0–23.10 does not (broken `require(esm)` cycles break the Nest CLI)
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- For Android: Android Studio / SDK, Java 17, an emulator or a device with USB debugging

## Install

```bash
pnpm install          # also builds packages/shared
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in `apps/api/.env` (at minimum `JWT_SECRET`, e.g. `openssl rand -base64 48`). Google OAuth and the
service account are only needed from Phase 2/3 onwards; the API boots without them.

## Run

```bash
pnpm dev:api          # NestJS with watch mode on http://localhost:3000
pnpm web              # Expo web dev server on http://localhost:8081
pnpm android          # build & launch the Android dev build (needs emulator/device)
pnpm --filter @finance/mobile android:go   # or open in Expo Go instead of a dev build
pnpm dev              # everything in parallel (shared watch + api + expo)
```

Android emulator note: `localhost` in `EXPO_PUBLIC_API_URL` is rewritten to `10.0.2.2` automatically. For a
physical device use your machine's LAN IP and add it to `CORS_ORIGINS` in the API env.

## Google setup

**OAuth (sign-in, Phase 2).** In Google Cloud Console → APIs & Services → Credentials, create an _OAuth client ID_
of type _Web application_ (the backend performs the code exchange for both web and Android):

- Authorized redirect URI: `http://localhost:3000/auth/google/callback` (and your production `API_PUBLIC_URL` + `/auth/google/callback`)
- Put the client ID/secret in `apps/api/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Only the `openid email profile` scopes are requested. Web sessions use an HTTP-only cookie; Android receives a
one-time code on the `finance://auth/callback` deep link and exchanges it for a bearer token stored in the
device keystore.

**Service account (spreadsheet access, Phase 3).** Create a service account, enable the Google Sheets API, download
its JSON key and set `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY`. Users share their spreadsheet with
that email (Editor) during the in-app setup wizard.

**No Google credentials yet?** Set `SHEETS_BACKEND=memory` in `apps/api/.env`. The API then serves a seeded
in-memory demo spreadsheet (legacy Uzbek layout); connect it in the wizard with
`https://docs.google.com/spreadsheets/d/1DemoFinanceSpreadsheetIdForLocalDevelopment00/edit`. Nothing is written to
Google and the switch is refused in production. Sign-in still needs OAuth credentials.

## Quality gates

```bash
pnpm typecheck        # tsc in every workspace
pnpm lint             # eslint in every workspace
pnpm test             # shared (node:test) + api (jest unit)
pnpm --filter @finance/api test:e2e
pnpm format           # prettier
```

## Build

```bash
pnpm build:shared                              # packages/shared → dist
pnpm build:api                                 # apps/api → dist (run with `pnpm --filter @finance/api start`)
pnpm build:web                                 # apps/mobile/dist (SPA; host must fall back to index.html)
pnpm --filter @finance/mobile android:prebuild # regenerate android/ from app.json
cd apps/mobile/android && ./gradlew assembleRelease   # APK, or bundleRelease for AAB (needs a signing config)
```

## Environment variables

Backend (`apps/api/.env`):

| Variable                       | Required | Notes                                                         |
| ------------------------------ | -------- | ------------------------------------------------------------- |
| `PORT`                         | no       | default 3000                                                  |
| `API_PUBLIC_URL`               | no       | used for the OAuth callback URL                               |
| `APP_WEB_URL`                  | no       | web origin; default CORS origin and post-login redirect       |
| `CORS_ORIGINS`                 | no       | extra origins, comma separated                                |
| `JWT_SECRET`                   | **yes**  | ≥ 32 chars                                                    |
| `JWT_EXPIRES_IN`               | no       | default `30d`                                                 |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Phase 2  | Google OAuth (identity only)                                  |
| `GOOGLE_OAUTH_REDIRECT_URI`    | no       | default `${API_PUBLIC_URL}/auth/google/callback`              |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Phase 3  | email users share their sheet with                            |
| `GOOGLE_PRIVATE_KEY`           | Phase 3  | service-account private key (`\n` escapes accepted)           |
| `GOOGLE_SPREADSHEET_ID`        | no       | app-owned registry sheet for user records; JSON file fallback |
| `DATA_DIR`                     | no       | local data directory for the dev user store                   |
| `THROTTLE_TTL_SECONDS/LIMIT`   | no       | rate limiting                                                 |

Frontend (`apps/mobile/.env`):

| Variable              | Notes                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | API base URL. Empty in development → derived from the Expo dev host. |

## Project layout

```
apps/api/src
  config/        env schema (Zod) + typed AppConfigService
  common/        AppException, global HttpExceptionFilter, ZodValidationPipe
  modules/       feature modules (health, auth, spreadsheets, transactions, …)
apps/mobile/src
  app/           Expo Router routes; (app)/ is the authenticated shell
  components/    ui primitives, navigation (Sidebar, tab config), feedback states
  features/      feature folders: api hooks + components
  lib/           api client, env, query client & keys
  theme/         design tokens + ThemeProvider (light/dark/system)
packages/shared/src
  domain/        models + Zod schemas     api/  error envelope, health     utils/  money, date, id
```

## Status

- Phase 1 (foundation): monorepo, Expo app with adaptive navigation and theming, NestJS API with validated
  config and structured errors, shared domain package, lint/type/test gates, web export and Android prebuild. ✓
- Phase 2 (auth): Google OAuth code flow for web (cookie) and native (deep-link exchange code), JWT sessions,
  protected routes, login/callback/sign-out screens, rate limiting and security headers. ✓ (verified with a mocked
  Google in e2e tests and a browser-driven smoke test; the live Google round-trip needs real credentials)
- Phase 3 (spreadsheet): service-account Sheets client (REST, no `googleapis` bundle), 4-step setup wizard,
  idempotent initialisation that reuses a legacy Uzbek transaction sheet and adds a "Finance ID" column block in
  the first empty columns (summary cells untouched), Settings → Spreadsheet card, lost-access recovery screen,
  transactions read/write adapter with CRUD endpoints, registry-sheet or file-backed user store. ✓ (e2e against an
  in-memory Sheets double; wizard verified in a browser with `SHEETS_BACKEND=memory`)
- Later phases: transactions UI and dashboard, analytics, recurring expenses, investments, Uzbek voice entry.
