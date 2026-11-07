# Minerva Atlas

A knowledge-sharing platform that helps Minerva University students find practical information about their rotation cities.

The database, authentication, profile, and core content APIs are in place, including insight CRUD, city/category feeds, full-text search, ordered place IDs, and upvotes. The frontend includes email/password authentication, protected navigation, live feed browsing/search, shareable insight dialogs, and upvotes. Contribution and profile editing are the next frontend slice in [docs/plan.md](docs/plan.md).

## Prerequisites

- Node 24 (24.20.0 or newer) and pnpm 12, installed however you prefer, such as with [mise](https://mise.jdx.dev/)
- Docker, for local Postgres

## Setup

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm db:up
```

`pnpm db:up` starts Postgres 17 on `127.0.0.1:5432` and waits until it's ready. It creates two databases, `atlas_dev` for development and `atlas_test` for tests.

Then create the tables and seed the cities and categories in `atlas_dev`:

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

The `db:*` scripts read `.env` from the repo root. Tests use `TEST_DATABASE_URL` from the environment if it's set, and otherwise the local `atlas_test` database. Each API test run drops and rebuilds that database's schema, and requires the connected database to be named `atlas_test`.

## Changing the schema

1. Edit [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts).
2. Run `pnpm db:generate` to write a migration to `apps/api/drizzle/`, and review the SQL.
3. Run `pnpm db:migrate` to apply it to `atlas_dev`.

`drizzle-kit` can't model extensions or text search configurations, so those go in hand-written migrations (`pnpm db:generate --custom --name=<name>`).

## Running the API

Set `BETTER_AUTH_SECRET` in `.env` to a fresh value from `openssl rand -hex 32`. Startup rejects missing, short, or placeholder secrets. Keep the local `BETTER_AUTH_URL=http://localhost:3000` and `WEB_ORIGIN=http://localhost:5173` values without trailing slashes.

Apply migrations, including the auth rate-limit table, then start the server:

```bash
pnpm db:migrate
pnpm dev:api
```

For a compiled run, use `pnpm build`, then `pnpm start:api`. The API listens on port 3000 by default; Ctrl-C closes the server and database pool. It does not run migrations automatically.

### Local auth smoke test

For a direct API check, use a cookie jar and the configured Origin header. These requests create a real account in your local development database; choose an unused allowed email for each sign-up. The example password is for local testing only.

```bash
curl -i http://localhost:3000/api/health

curl -i -c /tmp/atlas-cookies.txt \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@minerva.edu","password":"local-test-password"}' \
  http://localhost:3000/api/auth/sign-up/email

curl -i -b /tmp/atlas-cookies.txt -c /tmp/atlas-cookies.txt \
  http://localhost:3000/api/me

curl -i -X PATCH -b /tmp/atlas-cookies.txt -c /tmp/atlas-cookies.txt \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"displayName":"Ada Lovelace","cohort":"M27"}' \
  http://localhost:3000/api/me

curl -i -X POST -b /tmp/atlas-cookies.txt -c /tmp/atlas-cookies.txt \
  -H 'Origin: http://localhost:5173' \
  http://localhost:3000/api/auth/sign-out

curl -i -c /tmp/atlas-cookies.txt \
  -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"email":"ada@minerva.edu","password":"local-test-password"}' \
  http://localhost:3000/api/auth/sign-in/email

curl -i -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"name":"Rejected","email":"ada@gmail.com","password":"local-test-password"}' \
  http://localhost:3000/api/auth/sign-up/email
```

Expect 200 from health and valid auth/profile requests; Gmail sign-up returns 403 with `EMAIL_DOMAIN_NOT_ALLOWED`. Requests to `/api/me` without a valid cookie return 401. After sign-out, the old cookie no longer works. Repeat with `uni.minerva.edu` to check the second allowed domain. Delete the temporary cookie jar when finished.

Sign-up and sign-in each allow three attempts per IP per ten seconds, including invalid input. If a request returns 429, wait the `X-Retry-After` seconds before retrying. All writes require the exact Origin header, including curl requests. Auth routes keep Better Auth's native errors; other endpoints use `{ error: { code, message, details? } }`.

### Local core API smoke test

With local Postgres running, run:

```bash
pnpm smoke:api
```

The script starts a real HTTP listener on an available loopback port and uses `TEST_DATABASE_URL` (default: local `atlas_test`). It refuses any database not named `atlas_test`, applies existing migrations and reference seeds, and creates two temporary users through normal sign-up. It does not read `.env` or use `DATABASE_URL`. Run it separately from the test suite, which rebuilds the same database.

The sequence checks health and profiles, fetches cities/categories, creates a Tokyo insight with a place ID, browses and searches for it with `cafe` matching `café`, reads details as the second user, edits the insight into General, adds an idempotent upvote and removes it, rejects the second user's edit/delete with 403, and deletes the insight as its author. Creation must return 201, deletion 204, and retrieval after deletion 404; successful reads, edits, and votes return 200. Every response must use `Cache-Control: no-store`.

A successful run prints `HTTP smoke passed`. The script closes its listener and removes its temporary users, insights, and places even after an assertion failure; reference seeds and normal auth rate-limit counters remain. Existing local rate limits may briefly delay sign-up. This sequence passed locally on 2026-11-06, alongside all 168 tests and formatting, lint, type checks, and build.

## Scripts

Run these from the repo root.

| Script              | What it does                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`         | Lint with ESLint                                                                                                 |
| `pnpm format`       | Format with Prettier                                                                                             |
| `pnpm format:check` | Check formatting without changing files                                                                          |
| `pnpm typecheck`    | Type check all packages and tests                                                                                |
| `pnpm test`         | Run all tests with Vitest (needs Postgres running)                                                               |
| `pnpm smoke:api`    | Run the two-user HTTP smoke sequence against `atlas_test`, then clean up its temporary content                   |
| `pnpm build`        | Build all packages                                                                                               |
| `pnpm dev:api`      | Build shared contracts and start the API with file watching                                                      |
| `pnpm start:api`    | Run the compiled API (run `pnpm build` first)                                                                    |
| `pnpm db:up`        | Start local Postgres                                                                                             |
| `pnpm db:down`      | Stop local Postgres and keep its data                                                                            |
| `pnpm db:generate`  | Generate a migration from the schema                                                                             |
| `pnpm db:migrate`   | Apply migrations to `DATABASE_URL`                                                                               |
| `pnpm db:seed`      | Seed cities and categories in `DATABASE_URL`; safe to re-run                                                     |
| `pnpm db:seed:test` | Seed the test user in `TEST_DATABASE_URL`; requires `NODE_ENV=test`, `atlas_test`, and explicit test credentials |

To run one project or one test file:

```bash
pnpm test --project api
```

```bash
pnpm test apps/api/src/database.test.ts
```

To delete local data and recreate both databases:

```bash
docker compose down -v && pnpm db:up
```

## Workspace

| Path              | Package         | Purpose                                   |
| ----------------- | --------------- | ----------------------------------------- |
| `apps/web`        | `@atlas/web`    | Web app (React and Vite, from Phase 5)    |
| `apps/api`        | `@atlas/api`    | REST API (Fastify and Better Auth)        |
| `packages/shared` | `@atlas/shared` | Schemas shared by the web app and the API |

## CI

[GitHub Actions](.github/workflows/ci.yml) runs lint, format check, type checks, tests against a Postgres service container, and the build on every pull request and every push to `main`.

## Docs

- [Product](docs/product.md): scope, user flows, and browsing rules
- [Architecture](docs/architecture.md): tech stack, auth, search, Places, and deployment
- [API](docs/api.md): REST contract
- [Schema](docs/schema.md): tables and seed data
- [Plan](docs/plan.md): work tracker

## Running the web app

Start the API and web app in separate terminals:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

Open http://localhost:5173 and create an account with a `minerva.edu` or
`uni.minerva.edu` address, or sign in to an existing local account. Sign-up
creates a session immediately. The MVP sends no verification email and has no
password-reset flow. Local development uses `atlas_dev`; the automated test
user is confined to `atlas_test`.

Vite proxies `/api` to localhost:3000 without rewriting the browser Origin.
Keep `WEB_ORIGIN=http://localhost:5173`; the strict port prevents silent origin
changes. The web app does not load repository-root secrets into its browser
configuration. Better Auth's browser client uses same-origin `/api/auth`, and
Atlas requests use `/api/me`, reference-data routes, and insight/vote routes with cookies.
There is no browser API-origin variable or token in localStorage.

The authenticated shell loads real cities and categories. General is a local
option, not a city record. A valid URL city wins over the remembered city;
only explicit city selections change the preference. Browse supports search,
category filtering, sorting, and numbered pagination (20 insights per page).
Feed filters stay in the URL; adding `insight=<uuid>` opens a shareable detail
dialog while preserving the feed. Upvotes stay synchronized between both views.
Google lookups remain in Phase 6; this slice shows place counts only. Contributions
remain unavailable; Discover, Agent, and profile editing remain placeholders.
The earlier fixture feed is not imported into development or production.

`pnpm build` produces the web bundle in `apps/web/dist` and declarations in
`apps/web/.types`. `pnpm preview:web` serves the production bundle on
http://localhost:4173. To authenticate there, restart the local API with
`WEB_ORIGIN=http://localhost:4173 pnpm dev:api` so its mutation Origin check
matches the preview. Restart with the normal origin when returning to development.
Deployment and the Vercel-to-Render rewrite remain Phase 7.

Visual tokens and shared interaction conventions live in [DESIGN.md](DESIGN.md).

## Browser tests

Install Chromium once:

```bash
pnpm --filter @atlas/web exec playwright install chromium
```

With local Postgres running, run API tests first, then browser tests:

```bash
pnpm test
pnpm test:web:browser
```

Do not run these commands concurrently: both rebuild the shared `atlas_test`
database. CI preserves this ordering. Browser tests run a freshly migrated and
seeded database for each of the development and production-preview suites,
sequentially with one worker. They generate temporary credentials and an auth
secret in memory, sign in through the normal form, and require no changes to
`.env` or `TEST_USER_PASSWORD`.

The isolated API uses localhost:3100 and the test web origin is
http://localhost:5174. Existing servers are never reused. The runner overrides the
API database/auth configuration, verifies the actual database name before
resetting it, and uses test-only process commands to reset rate-limit counters
between scenarios and revoke sessions. No test-only HTTP endpoints are added.
Server processes shut down after the suites. For a non-default test database,
export `TEST_DATABASE_URL` before running; its database name must be `atlas_test`.
The browser workflow follows the API tests' environment convention rather than
loading the repository-root `.env`.

Screenshots and failure traces are written under `apps/web/test-results/`.
Coverage includes auth validation and recovery, rate limits, revocation,
redirect safety, session isolation, city preference/history, keyboard/focus,
responsive layout, accessibility, and production fixture exclusion.
