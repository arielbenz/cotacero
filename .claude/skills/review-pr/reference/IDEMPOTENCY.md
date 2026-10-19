# Idempotency checklist

Applies to operations that change state and can be retried or interrupted:
`apps/cms/src/migrations/`, `src/scripts/` (seeds and one-off jobs), hooks with
side effects — `afterChange` cascades, writes to other collections, calls to
external services — and endpoints that write. Report under **Potential Bugs**.

Every state-changing operation should converge on the same end state however
many times it runs and wherever a previous run stopped.

## Questions to ask of the diff

1. What happens if this runs twice in a row? A seed that inserts without
   checking for existing rows duplicates them; a hook that appends on every
   save grows without bound.
2. What happens if the previous run crashed halfway? A migration's `up` that
   fails after the first statement, or a cascade that updated half the
   children.
3. Does re-running converge? If the answer is "it depends on what was left
   behind", the operation needs a reconciliation step — look up then create or
   update, compare by content rather than by creation order, or do the work in
   one transaction.

## Payload specifics

- A hook that writes through the Local API passes `req`, so its write joins the
  caller's transaction and rolls back with it.
- A hook that writes to its own collection guards against re-triggering
  itself.
- A migration's `down` undoes its `up`, and `up` doesn't assume data a partial
  earlier run may have changed.
- Calls to external services from a hook either tolerate a retry — an
  idempotency key or an upsert — or happen after the transaction commits.

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
