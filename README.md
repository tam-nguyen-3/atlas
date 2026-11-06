# Minerva Atlas

A knowledge-sharing platform that helps Minerva University students find practical information about their rotation cities.

The database, authentication API, and profile API are in place. Core content routes and the web app arrive in later phases of [docs/plan.md](docs/plan.md).

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

The frontend arrives in Phase 5. For now, use a cookie jar and the configured Origin header. These requests create a real account in your local development database; choose an unused allowed email for each sign-up. The example password is for local testing only.

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

## Scripts

Run these from the repo root.

| Script              | What it does                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`         | Lint with ESLint                                                                                                 |
| `pnpm format`       | Format with Prettier                                                                                             |
| `pnpm format:check` | Check formatting without changing files                                                                          |
| `pnpm typecheck`    | Type check all packages and tests                                                                                |
| `pnpm test`         | Run all tests with Vitest (needs Postgres running)                                                               |
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
