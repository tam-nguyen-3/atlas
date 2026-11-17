## Summary

<!-- What does this change, and why? -->

Closes #

## Review map

<!-- For feature slices, link the review map in docs/design/*-verification.md instead of repeating it here. -->

| Key files | Core changes and what reviewers should check |
| --------- | -------------------------------------------- |
|           |                                              |

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:web:browser`
- [ ] `pnpm smoke:api` (API changes only)

Manual or visual checks:

<!-- What did you try in the running app? Add screenshots for UI changes. -->

## Checklist

- [ ] Specs updated if scope or contracts changed (`docs/product.md`, `docs/api.md`, `docs/schema.md`, `docs/architecture.md`)
- [ ] `docs/plan.md` boxes ticked, and the review map is linked from the Current state section of AGENTS.md (feature slices)
- [ ] Shared Zod schemas in `packages/shared` updated for API changes
- [ ] Migration generated with `pnpm db:generate` and committed (schema changes); production migration noted as a user step
- [ ] UI follows `DESIGN.md`, with screenshots attached
- [ ] No secrets committed, and no Google place names or addresses persisted
