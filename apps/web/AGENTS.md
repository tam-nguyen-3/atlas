# Web guidance

Follow the [root guide](../../AGENTS.md). Paths below are relative to `apps/web` unless stated otherwise.

## Navigation

| Area | Start with |
|---|---|
| App entry, routing, protected navigation, and shell | `src/main.tsx` and `src/router.tsx` |
| Auth forms and validation | `src/auth-screen.tsx` and `src/lib/auth-validation.ts` |
| Session/profile state and request lifecycle | `src/lib/session.ts` and `src/lib/request-scope.ts` |
| Atlas transport and Better Auth adapter | `src/lib/api.ts` and `src/lib/auth.ts` |
| Browse UI, URL filters, queries, and voting | `src/browse.tsx`, `src/lib/browse-state.ts`, and `src/lib/insights.ts` |
| Shared controls, insight views, and visual tokens | `src/components/` and `src/styles.css` |
| Fixture-only preview | `src/preview/` |
| Browser tests and configuration | `e2e/` and `playwright.config.ts` |

## Implementation

- Read [DESIGN.md](../../DESIGN.md) before UI changes; reuse the shared controls in `src/components/ui/`. The [product spec](../../docs/product.md) and [plan](../../docs/plan.md) own workflow scope.
- `/api/me` owns session/profile query state through `src/lib/session.ts`; do not introduce a competing session cache. Keep private cache cleanup in the existing session lifecycle.
- Atlas requests use the typed client in `src/lib/api.ts` and shared Zod contracts from the repository's `packages/shared/src/`. Better Auth uses its separate adapter; both use same-origin cookie requests.
- Keep browse filters in validated URL state and feed/detail queries and vote synchronization in the existing helpers.
- `src/preview/` contains fixtures and is excluded from development and production runtime imports. Keep the live app connected to real APIs.

## Verification

Run commands from the repository root:

- `pnpm dev:api` and `pnpm dev:web` start local development in separate terminals.
- `pnpm test --project web` runs colocated unit and component tests.
- Install Chromium once with `pnpm --filter @atlas/web exec playwright install chromium`.
- With Postgres running (`pnpm db:up`), run `pnpm test` followed by `pnpm test:web:browser`. The browser runner builds and checks both development and production-preview modes with isolated test servers.
- Use `pnpm lint`, `pnpm typecheck`, and `pnpm build` for implementation changes. Check changed UI behavior at desktop and mobile sizes, including keyboard/focus and loading/error states.

API and browser tests both rebuild `atlas_test`; never run them or `pnpm smoke:api` concurrently. The browser runner generates test credentials without editing `.env`. See the [README](../../README.md#browser-tests) for setup and artifacts.
