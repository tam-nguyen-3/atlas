# Walkthrough seed

## Run locally

The local walkthrough uses the existing `tam-test@uni.minerva.edu` account. Sign in with its existing password; this seed does not create or change login credentials.

```bash
DEMO_OWNER_EMAIL=tam-test@uni.minerva.edu pnpm db:seed:demo
```

The command reads `DATABASE_URL` from the root `.env`. It accepts only a loopback PostgreSQL URL targeting `atlas_dev`, without URL query overrides, and verifies the connected database name. The owner must already exist. It creates missing city/category rows, without changing existing reference rows. No migrations are required for an already migrated local database.

The dataset contains 60 fictional student-style insights: San Francisco 24, Tokyo 16, Buenos Aires 12, and General 8. Twelve fictional profiles have reserved `.invalid` email addresses and no auth accounts. Eight insights belong to the selected existing owner, two in each city and General. All eight categories are represented, with varied titles, lengths, category combinations, dates in the previous eight weeks, and votes from fictional profiles. There are no Places tags or Google calls.

Fixed IDs make reruns additive. Existing demo insights, author profiles, associations, timestamps, and votes are preserved, including edits made during filming. Deleted demo insights are recreated on the next run. Changing `DEMO_OWNER_EMAIL` does not transfer existing demo insights to another owner. Votes and counts are inserted atomically with the content. Your account starts with no seed-created votes.

## Filming route

1. Sign in as `tam-test@uni.minerva.edu` and select San Francisco. Scroll the feed and show the second page; switch between newest and top sorting.
2. Select Food to demonstrate category filtering, then clear it.
3. Search `groceries`. Results include San Francisco advice and General advice such as “A shared groceries list that people use.” Also try `packing` and `study spots`.
4. Open an insight by a different author. Show its content, categories, author, and vote count; upvote it and remove the vote. Copy its link from the menu if useful.
5. Open My profile and scroll to My insights. Eight seeded contributions span all three cities and General, alongside any existing contributions. Edit one, then return to browsing.
6. Create a short contribution during filming, open it, and delete it through the confirmation dialog. This keeps the curated dataset intact for another take.
7. Briefly switch to Tokyo, Buenos Aires, and General to show their distinct feeds.

Sample advice is fictional walkthrough content rather than verified local guidance. It avoids specific prices and university policies. The optional source links point to the SF library and transit operator; content does not depend on fetching them.

## Review map

| Starting point | Core change | Review priorities |
| --- | --- | --- |
| `apps/api/src/db/seed-demo.ts` | Local-only entry point and transactional insert-missing seed | Target checks before writes, existing-owner lookup, no credential changes, preservation on rerun, real vote rows and counts |
| `apps/api/src/db/demo-content.ts` | 60 curated insights and 12 fictional profiles with stable IDs | Distribution, natural content, owner allocation, categories, date/vote variety, no Places data |
| `apps/api/src/db/seed-demo.test.ts` | Dataset, guard, rollback, preservation, and authenticated API tests | Search scope, pagination, ownership, top sorting, unrelated data preservation |

Root/API package scripts expose `db:seed:demo`; README and the plan tracker link this guide. Schema, public API contracts, frontend code, and normal reference/test seeds are unchanged by this slice.

## Verification

- API suite: 110 tests passed across 10 files, including six new demo-seed tests. Tests used `atlas_test`, separately from local walkthrough data.
- Lint passed.
- Typecheck, production build, and repository formatting check passed. Build retains Vite's existing large-chunk advisory.
- On 2026-11-08, ran the command against local `atlas_dev`: 60 inserted, then 0 inserted / 60 preserved on rerun. All three original insight rows, all three original user profiles, existing credential-account rows, and existing votes were preserved.
- Local total: 63 insights. Actual feeds include existing content: San Francisco 24, Tokyo 17, Buenos Aires 12, General 10. San Francisco page two has four insights; My insights for `tam-test@uni.minerva.edu` has nine (eight demo, one existing).
- Authenticated local API checks passed for feed totals, SF pagination, top ordering, `groceries` search across SF and General (four results), owned detail, and My insights. No demo votes were added for the owner; no vote-count mismatches were found.
- Verification used a temporary session for the owner through Fastify injection, then deleted it. Existing passwords and sessions were not changed. Browser visual review remains the user's existing pending task.
