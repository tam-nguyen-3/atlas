# Phase 4 local Postman review

Import `phase4.postman_collection.json` into Postman, then send its numbered requests in order. The collection has 34 requests with status, cache-header, and behavior assertions. Expected 400/401/403/404 responses are deliberate checks, so inspect the assertions rather than treating every non-200 response as a failure.

## Start the local API

From the repository root, use your existing `.env` from Phase 3. Confirm these local values:

```dotenv
DATABASE_URL=postgres://atlas:atlas@127.0.0.1:5432/atlas_dev
BETTER_AUTH_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:5173
PORT=3000
```

Keep your existing `BETTER_AUTH_SECRET`. If setting up from scratch, copy `.env.example` to `.env` and replace the secret placeholder with the output of `openssl rand -hex 32`.

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev:api
```

Leave the API terminal running. Use `mise exec -- pnpm ...` if your shell does not already use the project's Node/pnpm versions. With dependencies and the Postgres Docker image already installed, these API flows need no internet access, hosted services, or Google key. The frontend does not need to be running.

## Configure Postman

- Import the JSON collection file.
- Use its default variables: `baseUrl=http://localhost:3000` (without `/api`) and `origin=http://localhost:5173`. Match your `.env` if you changed either.
- Keep Postman's cookie jar enabled. The collection uses cookie-based authentication, not a bearer token. Sign-up/sign-in set cookies; sign-out switches accounts safely.
- Do not mix `localhost` and `127.0.0.1` across requests, since cookie hosts must match.
- Start with request 01. It generates unique author/reader emails. Create responses save `insightId` and `generalId` automatically. The password variable is a public, local-test-only value; use it only for these disposable local accounts.
- Send requests individually to inspect results, or run the whole collection in order with one iteration. Do not run only the cleanup requests before creation.

## What to inspect

| Requests | Expected behavior |
|---|---|
| 01–04 | Health works; author signs up; reference data includes Tokyo/Food and no General city object. |
| 05–06 | Create one Tokyo and one General insight; both return 201. Save ordered opaque place IDs without calling Google. |
| 07–10 | Tokyo browsing excludes General; searching `cafe` includes both `café` insights. General browsing is isolated. An out-of-range page has no items but retains the matching total. |
| 11–13 | Details expose author status without author email. PATCH preserves omitted body text, reorders places, clears optional fields, and makes the insight General. |
| 14–18 | Empty patches, trimmed duplicates, unknown cities, and malformed UUIDs return 400; wrong Origin returns 403. |
| 19–22 | Sign out; content now returns 401. Sign up the reader; the same detail response has `isAuthor: false`. |
| 23–26 | Repeating PUT vote stays at 1; repeating DELETE vote stays at 0. |
| 27–30 | Reader edits/deletes return 403. Sign out and sign back in as the author. |
| 31–34 | Delete both insights with 204; retrieving the deleted one returns 404; sign out. |

All API responses must include `Cache-Control: no-store`. Feed items contain `bodyPreview` and `placeCount`; details contain `body`, `sourceUrl`, ordered `places`, and `isAuthor`.

The final requests remove both insights. The two test accounts and reusable place records remain in `atlas_dev`, consistent with the API's deletion contract. Restarting at request 01 creates another pair of unique accounts. If you interrupt a run, finish its delete requests before restarting if you want to remove its insights.

If sign-up/sign-in returns 429, wait the response's `X-Retry-After` seconds, then resend that request. Those routes allow only three attempts per IP per ten-second window. Unexpected 403 usually means the Origin header differs from `.env`; unexpected 401 usually means a missing cookie, a changed API secret, or a hostname mismatch.

## Automated checks alongside manual review

```bash
pnpm test
pnpm smoke:api
```

Run these sequentially. Both use `atlas_test`; the full suite rebuilds its schema. Manual Postman testing uses `atlas_dev`, so it is separate. The automated suite covers concurrency and transaction rollback, which sequential Postman requests do not establish. `smoke:api` starts its own HTTP listener and cleans up its temporary accounts/content.

Postman documentation: [importing data](https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data) and [cookies](https://learning.postman.com/docs/use/send-requests/response-data/cookies).
