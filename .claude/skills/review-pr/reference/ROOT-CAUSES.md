# Root-cause checklist

Applies to a change that fixes a bug — from the ticket, the commit message, or a
diff that adds a guard, fallback or retry to existing code. Report under
**Potential Bugs**.

A fix should land where the problem starts, not where it shows up.

## What to look for

- **Symptom guards.** A new `?.`, `?? ''`, `if (!x) return`, `try`/`catch` that
  swallows, or a retry that makes a crash or error go away without explaining
  why the value was missing. Ask where the bad value comes from; the fix
  usually belongs there, often at a boundary (see `BOUNDARIES.md`).
- **Justifying comments.** A workaround that needs a paragraph to explain it
  usually means the code is wrong, not under-documented.
- **One instance of a pattern.** The fix repairs one call site while the same
  mistake exists elsewhere. Search for the pattern and say whether other
  instances exist.
- **No reproduction.** A bug fix with no test that failed before the change.
  Where `CLAUDE.md` calls for an integration test — hooks that enforce business
  logic — its absence is a finding.
- **Stale state.** For "fails after restart" or "only on some environments",
  check whether the fix addresses persisted state — a cache, a seeded row, a
  schema pushed by an earlier branch — rather than the code.

A guard is right when the value genuinely can be absent at that point — then it
belongs in the type (see `TYPESCRIPT.md`), not as a silent default.

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
