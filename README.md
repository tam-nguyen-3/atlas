# Minerva Atlas

A knowledge-sharing platform that helps Minerva University students find practical information about their rotation cities.

The project is at the repo foundation stage: the packages are stubs, and the API and web app arrive in later phases of [docs/plan.md](docs/plan.md).

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

Nothing reads `.env` yet. Tests use `TEST_DATABASE_URL` from the environment if it's set, and otherwise the local `atlas_test` database.

## Scripts

Run these from the repo root.

| Script              | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `pnpm lint`         | Lint with ESLint                                   |
| `pnpm format`       | Format with Prettier                               |
| `pnpm format:check` | Check formatting without changing files            |
| `pnpm typecheck`    | Type check all packages and tests                  |
| `pnpm test`         | Run all tests with Vitest (needs Postgres running) |
| `pnpm build`        | Build all packages                                 |
| `pnpm db:up`        | Start local Postgres                               |
| `pnpm db:down`      | Stop local Postgres and keep its data              |

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
| `apps/api`        | `@atlas/api`    | REST API (Fastify, from Phase 3)          |
| `packages/shared` | `@atlas/shared` | Schemas shared by the web app and the API |

## CI

[GitHub Actions](.github/workflows/ci.yml) runs lint, format check, type checks, tests against a Postgres service container, and the build on every pull request and every push to `main`.

## Docs

- [Product](docs/product.md): scope, user flows, and browsing rules
- [Architecture](docs/architecture.md): tech stack, auth, search, Places, and deployment
- [API](docs/api.md): REST contract
- [Schema](docs/schema.md): tables and seed data
- [Plan](docs/plan.md): work tracker
