# Browse and details verification

Phase 5 Browse and details replaces the authenticated placeholder with the real
feed, shareable detail dialogs, and voting. This is agent verification; user
visual review remains pending.

## Behavior and ownership

- The existing same-origin client now validates feed/detail/vote responses using
  shared contracts. All requests participate in session cancellation and protected
  401 handling. No server, database, or public API contract changed.
- Browse URLs own city, committed query, one category, sort, page, and an optional
  insight UUID. Invalid values are normalized after reference data loads; page
  size is fixed at 20. Query text is literal URL text, including numeric terms,
  boolean-looking words, and quoted phrases; duplicate filters are invalid.
- City precedence/storage behavior is preserved. Search is server-side and follows
  the city-versus-General scope; tagged place names are not searched. Pagination
  resets after filter changes and corrects pages beyond the matching total.
- The search control debounces 300 ms, cancels timers on navigation/unmount,
  supports IME composition, and commits Enter/clear immediately. TanStack Query
  supplies abort signals to superseded requests. Normalization follows the current
  destination rather than the previous route match during pending navigation.
- `/browse?...&insight=<uuid>` keeps the underlying feed and filters. Feed-opened
  dialogs push history; close uses Back, including after refresh. Direct entry
  closes by replacement. Modified clicks use real links. Focus returns to the
  originating row, or the Browse heading if that row is unavailable.
- Radix supplies dialog focus trapping, background isolation, scroll locking, and
  Escape. Details render full plain text with preserved line breaks, optional
  source links using HTTP(S), metadata, vote controls, and place counts. Mobile
  dialogs fill the viewport. Place lookups/cards remain in Phase 6.
- Voting is pessimistic and idempotent: a per-viewer/per-insight mutation key
  blocks overlapping feed/detail submissions, server results patch both caches,
  and list/detail invalidation refreshes ranking and other-user changes. A session
  change prevents old mutation callbacks from repopulating private caches.
- The account dropdown is non-modal so active browse controls are not hidden from
  assistive technology while remaining focusable. The mobile navigation sheet
  retains modality; menu arrow-key, Escape, and focus restoration are verified.
- Creation, editing, deletion, profile, and my-insights UI remain in the following
  slice. Create insight remains disabled with an explanation.

## Design reconciliation

| Existing convention | Result |
| --- | --- |
| Gold accent, white surfaces, Manrope/Source Sans 3 | Preserved; no token or font changes |
| Flat, divided feed rows and document scrolling | Reused for live content |
| Shared controls and inline recovery | Reused; no screen-local select or toast system |
| Accessible overlays and mobile layout | Existing Radix dependency/layer tokens extended for details |

`DESIGN.md` records the new behavior owners and removes the completed browse
placeholder description. Written specs retain precedence over wireframe-only
replies, downvotes, and place cards.

## Verification

- `pnpm test`: all 233 tests passed across 19 files, including 66 frontend tests.
- `pnpm test:web:browser`: all 68 checks passed, 34 in development and 34 against
  the production bundle. API tests finished before browser testing; each browser
  mode rebuilt/migrated/seeded the isolated test database and used normal form
  sign-in. Setup/cleanup content used the authenticated HTTP API, with no added
  test endpoints or production fixtures.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, the `pnpm build` included in
  the browser command, and `git diff --check` passed.
- Focused tests cover URL normalization/duplicates/literal text, pagination bounds,
  search timing/Enter/clear/IME/history, and transport validation/cancellation.
  Browser scenarios cover asymmetric city/General search, category/sort, numbered
  pages, out-of-range correction, scrolled modal Back/focus restoration, refresh,
  direct links, source links, vote failure/retry/shared pending state/counts/top
  ranking, stale responses, feed/detail outages, missing insights, and revocation.
- Axe reports no violations in the feed/details at 375/1440 CSS pixels, alongside
  the existing auth/shell/navigation checks at 375/768/1440. Reduced motion,
  long multilingual content, untitled insights, place counts, and zoom-equivalent
  reflow were exercised. Development and production screenshots were inspected
  for desktop/mobile feed and detail layouts.
- Screenshots regenerate under `apps/web/test-results/development` and
  `apps/web/test-results/production`; these generated artifacts are git-ignored.
- The production build retains Vite's advisory about a large JavaScript chunk:
  approximately 664 kB minified, 212 kB gzip. No deployment was performed.

## Design audit limits

The strict premium scanner reports four existing false positives: the account
menu Trigger, navigation-sheet Trigger/Close (Radix actions supplied through
`asChild`), and the intentionally busy-button test fixture. These controls are
covered by browser/component checks. The strict audit is not reported as passing;
its local JSON is `/tmp/atlas-browse-premium-audit.json`.

`DESIGN.md` lint reports zero errors and nine existing orphan-token warnings;
runtime CSS remains canonical. Automated checks use Chromium. Physical-device,
virtual-keyboard, and native screen-reader review remain outside this evidence.
