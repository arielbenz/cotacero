# Tests checklist

Applies to every added or changed `*.spec.ts`, `*.test.ts` and `*.test.tsx`
file, and to a change that adds behaviour without a test where `CLAUDE.md`
requires one. Report under **Code Quality**.

A test calls the code the way its users do and asserts what they observe
against a literal expected value. The check for every test in the diff: **would
it still pass if every function it imports returned `undefined`?** If yes, it
cannot fail for a defect — it should be rewritten or deleted.

## Shapes that pass with every import returning `undefined`

- **Weak or no assertion.** No `expect`, or only `toBeDefined`, `toBeTruthy`,
  `not.toThrow`, `toBeInstanceOf`, `toBeGreaterThan(0)`.
- **Generic rejection.** `rejects.toThrow()` on a Payload `ValidationError`
  passes for any validation failure, including the wrong one. Assert the
  per-field message with the `fieldErrorMessages` helper the integration specs
  use.
- **Mock or absence only.** Only `toHaveBeenCalled`, `not.toHaveBeenCalled`,
  `toBeUndefined`, `toEqual([])`, `toHaveLength(0)`, `not.toBe(wrongValue)`.
- **Self-referential.** The expected value comes from the code under test:
  `expect(buildSlug(x)).toBe(buildSlug(x))`.
- **Constant pin.** The assertion restates a constant, config default or table
  row the code contains.
- **Fixture asserts fixture.** The assertion reads data the test built in
  `beforeAll`/`beforeEach`, and the subject never runs in the test body.

## What good looks like

- One concrete input, a literal expected output or observable effect:
  `expect(slugify('Hello, World!')).toBe('hello-world')`.
- An absence is asserted next to the matching presence in the same test.
- A mock's received payload, or the state after the call, is asserted — not
  just that it was called.
- Real over mocked: CMS integration tests hit a real Payload local API, per
  `CLAUDE.md`. Mocking something that can run locally is a finding.
- Tests that check a relation across rows (a parent that exists, a key present
  in two tables) and compile-time `*.test-d.ts` checks are fine as they are.

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
