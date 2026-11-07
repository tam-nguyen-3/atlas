# API guidance

Follow the [root guide](../../AGENTS.md). Paths below are relative to `apps/api` unless stated otherwise.

## Navigation

| Area | Start with |
|---|---|
| App factory, HTTP hooks, auth bridge, and route registration | `src/app.ts` |
| Startup, configuration, and shutdown | `src/index.ts` and `src/config.ts` |
| Better Auth configuration | `src/auth.ts` |
| Insight, profile, and reference-data features | `src/insights/`, `src/profile/`, and `src/reference/` |
| Schema, database client, migrations, and seeds | `src/db/` and `drizzle/` |
| Database test setup and HTTP smoke test | `src/test/` |

## Implementation

- Keep HTTP handling in `routes.ts`, domain behavior in `service.ts`, and database access in `repository.ts` within each feature directory.
- Shared Zod contracts live in the repository's `packages/shared/src/`. Read the [API contract](../../docs/api.md) before changing request or response behavior.
- `src/app.ts` creates the app without listening; `src/index.ts` owns the running server. Preserve dependency injection for tests.
- Read the [schema spec](../../docs/schema.md) and [README migration workflow](../../README.md#changing-the-schema) for database changes. Schema definitions live in `src/db/schema.ts`; migration SQL and metadata live in `drizzle/`.
- See the [architecture](../../docs/architecture.md) for auth, search, and transaction details; repository-wide invariants remain in the root guide.

## Verification

Run commands from the repository root:

- `pnpm db:up` starts local Postgres.
- `pnpm test --project api` runs API tests against real Postgres; tests are colocated with source.
- `pnpm smoke:api` verifies the two-user HTTP flow and cleans up its content.
- For shared-contract changes, also run `pnpm test --project shared`.
- Use `pnpm lint`, `pnpm typecheck`, and `pnpm build` for implementation changes.

API and browser tests both rebuild `atlas_test`. Run API tests, the smoke test, and `pnpm test:web:browser` sequentially; never overlap them. Test setup in `src/test/global-setup.ts` applies real migrations, and API test files run one at a time. See the [README](../../README.md#browser-tests) for browser setup.
