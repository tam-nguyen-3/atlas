# API and authentication verification

The Phase 5 API/authentication slice connects the existing Atlas foundation to the
real API. This is agent verification; the user's visual review remains unchecked.

## Implementation

- Cookie-based same-origin Atlas client validates `/me`, cities, and categories
  with shared Zod contracts. Better Auth's dedicated browser adapter is pinned to
  1.7.16, matching the backend. Version-specific behavior was checked in the
  installed client configuration/proxy and credential route sources; the official
  client reference supplied setup context. The public documentation currently
  advertises a newer patch, so the installed source/types governed the adapter.
- `/api/me` owns session/profile state. Protected route entry, focus, and reconnect
  revalidate it. Credential success is followed by session verification; retrying
  unavailable verification does not repeat the credential request.
- Only protected 401s establish session loss. Sign-out waits for server success.
  Reset advances a request generation, aborts pending requests, clears private
  query/mutation/route caches, and retains the city preference. The observed `/me`
  query object survives reset so mounted consumers immediately see null.
- Custom forms reuse existing primitives/tokens, preserve values in memory, focus
  errors after inputs are re-enabled, and support password visibility, password
  managers, paste, and IME-safe submission. Error/retry/countdown feedback is inline.
- Both runtime modes use real reference data and client-only General. The earlier
  fixture module is retained as source history but is not imported into the app.
  Browse, Discover, Agent, and profile editing clearly show their current scope.
- The browser runner rebuilds/migrates/seeds only the verified `atlas_test` database,
  generates temporary credentials/secrets, and uses dedicated ports (3100/5174).
  Development and production-preview suites run sequentially, with no reused
  servers, test-only HTTP endpoints, or changes to the user's `.env`.

## Verification

- `pnpm test`: all 209 tests passed across 17 files, including 42 frontend tests.
- `pnpm test:web:browser`: 46 browser checks passed, 23 against the development
  server and 23 against the production bundle. Each suite used a freshly prepared
  test database and real form sign-in.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and
  `git diff --check` passed.
- Browser scenarios cover sign-up/domain/confirmation validation, duplicate
  accounts and first-field focus, invalid credentials, the real 429 limiter and
  recovery, accepted-credential/session-verification recovery, network/server
  errors, safe return destinations, refresh, revocation, protected 401s, sign-out
  failure/success, delayed responses across account switches, focus/reconnect,
  and no competing Better Auth session requests.
- Shell checks preserve city URL/storage precedence, General, history, page reset,
  blocked storage, keyboard/typeahead selection, popup geometry, mobile navigation
  focus trap/restoration, and production fixture-byte exclusion. No insight
  requests are made by this slice.
- Axe checks report no violations on auth at 375/1440 CSS pixels and the shell at
  375/768/1440. Reduced motion and 720×500 zoom-equivalent reflow were exercised.
  Production screenshots were visually inspected at 375 and 1440 pixels, along
  with the 768-pixel desktop-navigation layout.
- Screenshots are regenerated under `apps/web/test-results/development` and
  `apps/web/test-results/production`; they are intentionally ignored by git.

## Design checks and limits

The existing palette, fonts, responsive breakpoint, and token-to-runtime mapping
are unchanged. The canonical behavior owners are documented in `DESIGN.md`.
Screenshots of sign-up and the shell were inspected at narrow and desktop/tablet
widths. This adds the auth forms, shared password/retry controls, and identity
placement without a rebrand. Earlier development-preview screenshots remain
historical evidence in `foundation-verification.md`.

The strict premium audit still reports the same three scanner false positives as
the foundation slice: the busy-button fixture and the Radix navigation-sheet
Trigger/Close actions provided through `asChild`. These are covered by component
and browser tests; no product action is disconnected. The audit is **not** reported
as passing. Its JSON is written to `/tmp/atlas-auth-premium-audit.json` locally.

`DESIGN.md` lint returns zero errors and nine token-reference warnings because
runtime CSS owns the tokens and the document's frontmatter defines only the button
component mapping. This does not substitute for browser accessibility checks.

The production build succeeds with Vite's advisory warning for an approximately
635 kB JavaScript chunk (203 kB gzip). No production deployment was performed.
Physical-device/virtual-keyboard and native screen-reader testing remain user
review work; automated browser checks use Chromium.

## Logo return-destination regression

The home logo no longer copies the auth-only `returnTo` parameter into Browse.
Destination validation also removes nested `returnTo` query parameters while
preserving legitimate filters and hashes. This repairs previously accumulated
URLs when navigating or completing authentication.

Verification: 43 frontend tests and 48 browser checks passed (24 each in
development and production preview), including repeated logo clicks from both
sign-in and sign-up starting with a nested return destination. Formatting, lint,
type checks, build, and `git diff --check` passed. The existing build/design
advisories above are unchanged.
