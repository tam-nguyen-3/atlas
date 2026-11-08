# Contribution and profile verification

Phase 5 adds contribution and profile management to the live authenticated app.
This is agent verification; user visual review remains pending.

## Review map

Start with the editor/mutation flow, then profile state, then the shared insight
surfaces. Existing product/API contracts remain authoritative.

| Key files | Core changes and review priorities |
| --- | --- |
| [contribution.tsx](../../apps/web/src/components/contribution.tsx) | Shared create/edit dialog, delete orchestration, cache updates, and success destinations. Check place-field omission, optional clearing, duplicate prevention, session checks, and originating-list restoration. |
| [profile.tsx](../../apps/web/src/profile.tsx) | Display-name/cohort form and all-city My insights below it. Check authoritative /api/me updates, author-metadata refresh, URL paging/details, and last-page correction. |
| [insight-menu.tsx](../../apps/web/src/components/insight-menu.tsx) | Copy link for everyone, author-only Edit/Delete, and clipboard feedback/fallback. Check action order, row isolation, nested-dialog keyboard behavior, and trigger focus restoration. |
| [insight-list.tsx](../../apps/web/src/components/insight-list.tsx) and [insight-dialog.tsx](../../apps/web/src/components/insight-dialog.tsx) | Shared rows/pagination and detail menus across Browse and My insights. Check preserved filters, history, focus, and existing vote behavior. |
| [api.ts](../../apps/web/src/lib/api.ts) and [contribution-validation.ts](../../apps/web/src/lib/contribution-validation.ts) | Typed writes, empty-204 deletion, and form adapters over shared schemas. Check JSON bodies, cancellation, protected 401 handling, null clearing, and no automatic write retries. |
| [unsaved-changes.tsx](../../apps/web/src/components/ui/unsaved-changes.tsx) and [confirm-dialog.tsx](../../apps/web/src/components/ui/confirm-dialog.tsx) | Shared discard/navigation guards and permanent-delete confirmation. Check dirty versus pristine navigation, pending-state protection, initial Cancel focus, and failure recovery. |
| [contribution.spec.ts](../../apps/web/e2e/contribution.spec.ts) | Real-API regression coverage for the complete slice, including ownership, clipboard/sign-in, CRUD, profile recovery, pagination, accessibility, and session expiry. Unit coverage lives in `src/lib/contribution-validation.test.ts` and `src/lib/clients.test.ts`. |

Supporting integration lives in `apps/web/src/browse.tsx` and `router.tsx`;
shared controls and overlay tokens live in `components/ui/` and `styles.css`.
The shared busy button now preserves its accessible label; wordmark decoration
and vote labels were corrected for label-in-name accessibility. See
[DESIGN.md](../../DESIGN.md) for the component and token conventions.

## Behavior and ownership

- The existing same-origin client supports POST/PATCH insight writes, empty-204
  deletion, and PATCH profile updates with shared response contracts. Requests
  retain session cancellation and protected-401 handling; writes never retry
  automatically. No API contract or database changes were needed.
- One shadcn/Radix insight menu appears in Browse rows, details, and My insights.
  Everyone sees Copy link; authors also see Edit and Delete, in that order.
  The popup supports keyboard/Escape/focus restoration without opening a row.
  Copies use an absolute Browse detail URL and retain sign-in requirements.
  Success waits for the clipboard; failure exposes a selectable link.
- One responsive React Hook Form editor handles creation and editing. It validates
  through the shared Zod contracts, requires body/categories, supports multiple
  categories/cities, and clears optional title/source fields to null. Cities and
  source URL live under More details; no cities means General. Editing omits the
  places field, preserving saved place IDs and ordering. No Google requests or
  key are involved.
- Creation preserves feed filters, refreshes results, and exposes View insight.
  Editing returns to the saved detail view. Permanent deletion confirms the
  consequence with Cancel initially focused, retains failures for retry, removes
  stale detail data, and refreshes/corrects the originating list's pagination.
  An already-missing deletion is reconciled as removed.
- Dirty forms guard dismissal and in-app navigation using an app-owned dialog;
  actual document unload uses the browser warning. Pristine contribution overlays
  close when navigating to another URL. Failed writes retain entered values and
  pending controls prevent duplicate submissions. Session loss clears private
  forms and late requests cannot restore old-session data. No drafts persist.
- My profile edits display name and optional cohort; email is read-only. Blank
  cohort clears it. Successful saves update the existing authoritative /api/me
  query and invalidate viewer-scoped author metadata in feeds/details.
- My insights sits below the profile form, across all cities and General, newest
  first. It uses author=me, 20 results per page, validated page/detail URL state,
  and the same rows, pagination, details, voting, and menus as Browse.

## Design reconciliation

| Existing convention | Result |
| --- | --- |
| Gold accent, typography, flat feed rows | Preserved; profile heading follows the established size scale |
| Shared controls and inline feedback | Extended through shared dropdown, textarea, selection, confirmation, and discard owners |
| Modal layering and narrow layouts | Added named editor/confirmation layer tokens; mobile editor uses existing full-height geometry |
| Accessible busy controls | Shared button preserves its label through loading using opacity rather than visibility |
| Accessible wordmark/voting | Decorative wordmark glyphs use CSS; vote names include their visible count |

## Verification

- `pnpm test`: all 241 tests passed across 20 files. New focused tests cover
  form normalization/validation, optional clearing, multi-selections, profile rules,
  JSON writes, empty DELETE responses, ownership failures, place-field omission,
  manual-only write retry, and cancellation across session resets.
- `pnpm test:web:browser`: all 94 checks passed, 47 in development and 47 against
  the production bundle. The full API/unit suite finished before browser tests;
  each browser mode rebuilt/migrated/seeded atlas_test and signed in through the
  normal form. Fixture content uses the authenticated API, without test endpoints
  or runtime sample data.
- Thirteen new scenarios per mode cover create/edit/delete, validation/focus,
  General/multiple cities, optional clearing and ordered place preservation,
  success destinations, duplicate prevention, retained values after failure,
  dirty/pristine Back behavior, profile/cohort changes and recovery, all-city
  My insights, last-page deletion correction, clipboard success/fallback,
  copied-link authentication, authors/non-authors, nested menus, delete retry,
  and session expiry. Existing authentication, browse/search, voting, URL state,
  modal refresh/history, unavailable-server, and cache-isolation checks also pass.
- Axe reports zero violations on the contribution dialog and profile page at
  375/1440 CSS pixels, including the label-in-name checks. Keyboard menu/Escape,
  nested discard confirmations, initial Cancel focus, creation-trigger focus
  restoration, and long multilingual content were exercised. Existing shell
  checks include 768px, reduced motion, and zoom-equivalent reflow.
- Development and production screenshots of the editor and profile at desktop
  and mobile sizes were inspected. Artifacts regenerate under
  `apps/web/test-results/{development,production}/`; these are git-ignored.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` (also included
  in the browser runner), and `git diff --check` passed.
- The strict premium audit and DESIGN.md lint were run; their limitations are
  documented below rather than counted as clean passes.

## Design audit limits

The strict premium scanner reports five actionless-button false positives: the
existing account Trigger, navigation-sheet Trigger/Close, busy-button test fixture,
and the new insight-menu Trigger. Radix supplies the trigger actions through
asChild; runtime keyboard/focus and browser coverage exercise those controls.
The audit is not reported as passing. JSON evidence is
`/tmp/atlas-contribution-premium-audit.json`.

DESIGN.md lint reports zero errors and nine existing orphan-token warnings.
Runtime CSS remains canonical. Automated browser checks use Chromium; physical
mobile devices, virtual keyboards, and native screen-reader review remain outside
this evidence. Vite retains its advisory about the application JavaScript chunk
(approximately 690 kB minified, 219 kB gzip). No deployment was performed.
