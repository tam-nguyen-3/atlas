# Minerva Atlas

Minerva Atlas helps Minerva University students share practical knowledge about their rotation cities. It brings student experiences, recommendations, and everyday tips into one searchable place, so useful advice can carry from one cohort to the next.

## What you can do

- **Explore by city:** browse insights for San Francisco, Tokyo, or Buenos Aires, or choose General for advice that applies across cities.
- **Find useful advice:** search by keyword, filter by category, and sort results.
- **Share your experience:** create insights with categories, optional titles and source links, and tags for one or more cities.
- **Manage your contributions:** edit or delete your insights and find them together under My insights.
- **Help others discover useful content:** upvote insights and copy links to share them with other signed-in students.
- **Make your profile yours:** update your display name and cohort.

All content requires sign-in. Account creation is limited to `minerva.edu` and `uni.minerva.edu` email addresses; shared insight links also require sign-in.

## Project status

Atlas is in development. Authentication, browsing and search, insight creation and management, upvotes, and profile editing are implemented. Google Places integration and production deployment are still pending. Discover and Agent are placeholders for future features.

The current version uses email and password authentication. It does not send verification emails or offer password reset.

## Built with

Atlas is a TypeScript pnpm workspace with a React frontend, a Fastify API, and PostgreSQL. Better Auth handles authentication, Drizzle manages database access and migrations, and shared Zod schemas define request and response contracts.

| Directory         | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `apps/web`        | React and Vite web app                    |
| `apps/api`        | Fastify API, authentication, and database |
| `packages/shared` | Zod contracts shared by the web and API   |

## Run locally

### Prerequisites

- Node.js 24, version 24.20.0 or newer within the 24.x release line
- pnpm 12.5.1, as specified in `package.json`
- Docker with Docker Compose for local PostgreSQL

Run all commands from the repository root.

### Set up the environment

```bash
pnpm install
cp .env.example .env
openssl rand -hex 32
```

Copy the generated value into `BETTER_AUTH_SECRET` in `.env`. Keep the default local database URLs and these origins:

```dotenv
BETTER_AUTH_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:5173
```

The Google Maps key and test-user credentials are not needed to run the current app locally. Keep real secrets out of version control.

### Prepare the database

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

This starts PostgreSQL 17 on `127.0.0.1:5432`, creates the development and test databases, and applies migrations and reference data to `atlas_dev`. The reference seed adds cities and categories; create an account and contribute your own insights to populate the feed. For an optional walkthrough dataset, see the [local demo seed guide](docs/design/walkthrough-seed-verification.md).

### Start the app

Start the API in one terminal:

```bash
pnpm dev:api
```

Start the web app in another:

```bash
pnpm dev:web
```

Open [localhost:5173](http://localhost:5173) and create an account with an allowed university email address. The API runs on port 3000, and Vite proxies `/api` requests to it. Sign-up signs you in immediately.

## Development commands

| Command                 | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `pnpm dev:api`          | Start the API with file watching                               |
| `pnpm dev:web`          | Start the Vite development server                              |
| `pnpm db:up`            | Start local PostgreSQL and wait until ready                    |
| `pnpm db:down`          | Stop local PostgreSQL while keeping its data                   |
| `pnpm db:generate`      | Generate a migration after changing the database schema        |
| `pnpm db:migrate`       | Apply migrations to `DATABASE_URL`                             |
| `pnpm db:seed`          | Seed cities and categories; safe to rerun                      |
| `pnpm lint`             | Run type-aware ESLint checks                                   |
| `pnpm format:check`     | Check formatting                                               |
| `pnpm typecheck`        | Type-check packages and tests                                  |
| `pnpm test`             | Run Vitest tests, including database-backed API tests          |
| `pnpm smoke:api`        | Run the two-user HTTP API smoke check                          |
| `pnpm test:web:browser` | Build and run development and production-preview browser tests |
| `pnpm build`            | Build all packages                                             |

Review generated migration SQL before applying it. Migrations are an explicit step; starting the API does not run them.

### Testing

With local PostgreSQL running, install the browser-test dependency once:

```bash
pnpm --filter @atlas/web exec playwright install chromium
```

Run these checks sequentially:

```bash
pnpm test
pnpm smoke:api
pnpm test:web:browser
```

API tests, smoke checks, and browser tests share `atlas_test`. The test suites rebuild its schema, so do not run these commands concurrently. They use `TEST_DATABASE_URL` when exported, otherwise the default local test database; its name must be `atlas_test`. Test commands do not load the root `.env`.

[GitHub Actions](.github/workflows/ci.yml) runs lint, formatting, type checks, Vitest tests, the build, and browser tests on pull requests and pushes to `main`.

## Documentation

- [Product](docs/product.md): scope, user flows, and browsing rules
- [Architecture](docs/architecture.md): stack, authentication, search, and planned deployment
- [API](docs/api.md): REST endpoints and contracts
- [Database schema](docs/schema.md): tables, relationships, and reference data
- [Design](DESIGN.md): visual tokens, shared components, and interaction conventions
- [Development plan](docs/plan.md): completed work and upcoming phases
