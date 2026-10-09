# Deploying the My Cashify API

The API (`apps/api`, NestJS) is the only service that needs a container. The web app (`apps/mobile`, Expo) is a
static export served by any static host, and Android is an APK/AAB. There is **no database**: the user's Google
Spreadsheet is the data store, and the list of signed-in users lives either in the registry spreadsheet
(`GOOGLE_SPREADSHEET_ID`) or in a JSON file under `DATA_DIR` (needs a persistent volume).

## Image

`Dockerfile` (repo root) builds a multi-stage image:

1. installs the workspace dependencies for `@finance/api` and `@finance/shared` with the lockfile,
2. compiles `packages/shared` then `apps/api` (`nest build`),
3. reinstalls production dependencies only,
4. `pnpm deploy` prunes a production-only tree for the API (~100 MB, image ≈ 240 MB) and copies it into a
   `node:24-alpine` runtime that runs as the `node`
   user, listens on `0.0.0.0:$PORT` (default 3000), stores the user file under `/data`, and exposes
   `GET /health` as the health check.

No `.env` file is copied into the image (`.dockerignore` excludes every `.env*` except the examples); all
configuration comes from environment variables at run time.

## Local: build, run, inspect

```bash
# build
docker build -t my-cashify-api:local .

# run with your real config (copy apps/api/.env.example → apps/api/.env first)
docker run --rm -p 3000:3000 --env-file apps/api/.env -v my-cashify-data:/data my-cashify-api:local

# or with compose (same thing, plus restart policy and the named volume)
docker compose up --build -d
docker compose logs -f api
docker compose ps
docker compose down            # add -v to also drop the api-data volume

# smoke check
curl -s http://localhost:3000/health

# try without Google credentials (in-memory demo spreadsheet; refused when NODE_ENV=production)
docker run --rm -p 3000:3000 -e NODE_ENV=development -e SHEETS_BACKEND=memory \
  -e JWT_SECRET=$(openssl rand -base64 48) -e APP_WEB_URL=http://localhost:8081 my-cashify-api:local

# inspect the image
docker image inspect my-cashify-api:local --format '{{.Size}} bytes, user={{.Config.User}}, cmd={{.Config.Cmd}}'
docker run --rm -it --entrypoint sh my-cashify-api:local    # look around (apps/api/dist, node_modules)
```

`docker run` and `docker compose` both bind to `0.0.0.0` inside the container; map a different host port with
`-p 8080:3000` if 3000 is taken (the dev API also uses 3000).

## Environment variables

Required in production:

| Variable                                             | Value                                                                                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                           | `production` (set by the image)                                                                                                                                            |
| `PORT`                                               | injected by Northflank; the image default is 3000                                                                                                                          |
| `API_PUBLIC_URL`                                     | public HTTPS URL of this service, e.g. `https://api.example.com` (builds the OAuth callback); a bare host such as `api-xyz.northflank.app` is accepted and gets `https://` |
| `APP_WEB_URL`                                        | public URL of the web app; also the CORS origin and post-login redirect                                                                                                    |
| `JWT_SECRET`                                         | long random secret (`openssl rand -base64 48`) — store as a secret                                                                                                         |
| `COOKIE_SAME_SITE`                                   | `none` when the web app and API are on different hosts (cookie is then `Secure`)                                                                                           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`           | OAuth client; add `${API_PUBLIC_URL}/auth/google/callback` to its redirect URIs                                                                                            |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | service account that users share their spreadsheet with (`\n` in the key is expanded)                                                                                      |

Optional: `GOOGLE_SPREADSHEET_ID` (registry spreadsheet for users; recommended in production so no volume is
needed), `DATA_DIR` (default `/data`), `CORS_ORIGINS`, `COOKIE_DOMAIN`, `JWT_EXPIRES_IN`, `AUTH_NATIVE_SCHEME`
(`finance`, must match `apps/mobile/app.json`), `THROTTLE_*`. Full list with comments: `apps/api/.env.example`.

## Northflank

1. **Create a service** → _Deployment_ → _Build from repository_: pick this repo and the `main` branch,
   build type **Dockerfile**, context `/`, Dockerfile path `/Dockerfile`. Northflank builds the image itself;
   nothing is pushed from a laptop.
2. **Networking**: add an HTTP port `3000`, public, and attach your domain. Northflank sets `PORT`; the image
   already listens on it on all interfaces. Health check: HTTP `GET /health`, port 3000.
3. **Environment**: add the variables above. Put `JWT_SECRET`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_PRIVATE_KEY`
   in a _Secret group_ and link it; paste the private key as a single line with `\n` separators (the API expands
   them) or as the raw multi-line value — both work.
4. **Persistent data**: either set `GOOGLE_SPREADSHEET_ID` (users stored in your registry spreadsheet, no
   volume needed) or add a _Volume_ mounted at `/data` so the JSON user store survives redeploys. Without one
   of these, every redeploy signs everyone out.
5. **Resources**: 0.25 vCPU / 512 MB is enough; the API keeps the sheet table cached in memory for a minute.
6. **Google console**: add `${API_PUBLIC_URL}/auth/google/callback` to the OAuth client's authorised redirect
   URIs and enable the Google Sheets API for the service-account project (`pnpm --filter @finance/api
check:sheets <sheet-url>` verifies this).
7. **Web app**: export it with the API origin baked in and host the `dist` folder (Northflank static site,
   Netlify, etc.):
   `EXPO_PUBLIC_API_URL=https://api.example.com pnpm --filter @finance/mobile exec expo export --platform web`.
   Then set `APP_WEB_URL` on the API to that site's URL.

Redeploys: push to `main` (or trigger a build in Northflank). Logs: the service's _Logs_ tab, or
`northflank logs service --project <p> --service <s>` with the CLI. The image writes structured Nest logs to
stdout only.

## Migrations

Not applicable: there is no SQL database and no Prisma. Spreadsheet layout changes are applied idempotently by
the API on first access (`SpreadsheetService` adds missing sheets/columns and never deletes data).
