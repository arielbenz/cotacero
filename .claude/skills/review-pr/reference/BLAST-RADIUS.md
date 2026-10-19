# Blast-radius checklist

Applies when the change alters something other code depends on: an export from
`packages/*`, a collection, global or field shape, a hook's side effects, an API
response, a design token, or a shared helper in `apps/web/src/lib/`. Report
breakage under **Potential Bugs**, and leftover compatibility paths under
**Architectural Patterns**.

Listing the callers is not the job — grep does that. The job is the breakage
grep won't show.

## Steps

1. **Say what changed**, including what the diff doesn't spell out: a default
   that moved, a hook that now fires on update as well as create, a field that
   became required, a token whose value changed under the same name.
2. **Find the one fact it's safe because of.** Most risky-looking changes are
   safe because of a single fact, such as "only drafts reach this branch". If
   it holds, most risks clear at once. Spend the effort there.
3. **Look where grep stops.** The JSON a REST or GraphQL response returns and
   who reads it in `apps/web`; the database column behind a field; a
   `where` query or `depth` that assumed the old shape; a
   `packages/types/src/contracts/` type that no longer matches what a hook
   returns; the source of the Payload or Next API the change calls, at the
   version the lockfile pins.
4. **Weigh each risk honestly** — how likely it is and what it costs. Keep the
   ones that hold; list the ones you checked and cleared separately. Cite a real
   `file:line`. A search that finds nothing is an answer; never invent a caller.

## How sure are you

For the safety fact, get as far down this list as the review allows, and say
where it stopped:

1. Asserted. Worthless on its own.
2. Pointed at — a real `file:line`, or the library's own source.
3. Walked — the failure traced step by step and shown not to reach.
4. Run — an existing check from Step 3 that exercises the path.

Don't write or run new code to prove it: the review writes nothing to the repo,
the installed packages or the dev database, and in git-only mode the code is
untrusted. If it stops at level 1, write **unproven** and name the cheapest
test that would prove it.

## Replacing an internal API

When the change introduces a new internal API while the old one still has
callers:

- Old callers are migrated and the old API deleted in the same change, not kept
  "for compatibility". Nothing outside this monorepo consumes `packages/*`.
- A temporary adapter is time-boxed and says what removes it.
- Tests assert the new contract; tests that only protected the old
  implementation are deleted.

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
