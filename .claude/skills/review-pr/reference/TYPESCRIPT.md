# TypeScript and type-system checklist

Applies to every changed `*.ts` and `*.tsx` file. Report findings under
**Potential Bugs** when a loose type lets a real bad state through, and under
**Code Quality** otherwise.

The type checker is a proof assistant: a case the types let a caller ignore
becomes a runtime failure the compiler could have stopped. A finding needs a
concrete bad state or crash the change allows — "could be typed more tightly"
is not a finding on its own.

## Rules

| Rule                           | What to look for                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Illegal states unrepresentable | Variants modelled as a bag of optional fields or booleans where contradictory combinations compile. Prefer a discriminated union on one literal discriminant.                                                                                                                    |
| Constructive modelling         | An invariant held by a comment or a runtime check that a shape could hold instead — `[T, ...T[]]` for non-empty, `start` plus `durationMs` for a range.                                                                                                                          |
| Simplest total type            | Strengthen a type only where the loose one forces `!`, an index cast, or a "should never happen" throw. Precision for its own sake is not a finding.                                                                                                                             |
| `unknown` over `any`           | External data typed `any`. It is `unknown` until narrowed or parsed.                                                                                                                                                                                                             |
| No `as` casts                  | Every `as` is a claim the compiler did not check. Accept it only after validation, or for a fact the types cannot express.                                                                                                                                                       |
| `satisfies` over `as`          | `as Config` on an object literal widens and hides typos; `satisfies Config` checks without widening.                                                                                                                                                                             |
| Narrowing order                | Discriminant switch, then `in`, then `typeof`/`instanceof`, then a type guard, then `as`.                                                                                                                                                                                        |
| Honest type guards             | An `isX`/`hasX` guard that does not verify everything its return type claims is worse than `as`.                                                                                                                                                                                 |
| Exhaustiveness                 | A `switch` over a union with no `const _exhaustive: never = x` default arm, so a new variant compiles silently.                                                                                                                                                                  |
| Derive, don't redeclare        | A hand-written interface duplicating a shape another file owns. Here that means `@sse/types` — the generated Payload types, or `contracts/` when a hook or virtual field reshapes the response. Reach for `Pick`, `Omit`, `Parameters`, `ReturnType`, `Awaited`, `typeof` first. |
| Validation library             | The repo has no runtime schema library. Don't ask for one to be added for a single guard; a guard or Payload field validation is the right tool.                                                                                                                                 |
| Object args                    | Several positional arguments of the same primitive type that a caller can swap and still compile. Pass an object. Skip on hot paths.                                                                                                                                             |
| Brand only when it pays        | Two arguments share a primitive but mean different things and the change actually mixes them up. Branding is not a repo convention — don't ask for it by reflex.                                                                                                                 |
| Logging                        | `console.log` left in shipped code. In `apps/cms`, use `req.payload.logger` with enough context to debug from an id.                                                                                                                                                             |

## Questions to ask of the diff

- Could a comment explain when this combination of fields is valid? Then the
  type is too loose.
- Where did this `any`, `as`, or `!` come from? Trace it to the boundary where
  the data came in (see `BOUNDARIES.md`) and validate there.
- If someone adds a variant next month, will the compiler show them every place
  that needs a case?
- Is this type duplicating a shape another file owns?

## Examples

Optional-field bag versus union:

```ts
// Contradictory states compile
type LoadState = { loading: boolean; page?: Page; error?: string }

// Only valid states exist
type LoadState =
  { kind: 'loading' } | { kind: 'ready'; page: Page } | { kind: 'error'; error: string }
```

Strengthen the input instead of asserting:

```ts
type NonEmpty<T> = [T, ...T[]]

// Partiality smuggled past the compiler
const newest = (versions: Version[]): Version => versions.at(0)!

// The assertion disappears
const newest = (versions: NonEmpty<Version>): Version => versions[0]
```

Returning `Version | undefined` is the other honest signature.

Exhaustive switch:

```ts
function label(s: Status): string {
  switch (s.kind) {
    case 'draft':
      return 'Draft'
    case 'published':
      return 'Published'
    default: {
      const _exhaustive: never = s
      return _exhaustive
    }
  }
}
```

Derived instead of redeclared:

```ts
// Drifts when the collection changes
type PageCard = { id: number; title: string; slug: string }

// Follows the collection
import type { Page } from '@sse/types'
type PageCard = Pick<Page, 'id' | 'title' | 'slug'>
```

When a cast can't be removed, name why TypeScript can't infer the type: a
missing discriminant, a source type that is too wide, an untyped boundary, or a
fact the types genuinely cannot express. The first three have a fix; only the
last justifies the cast.

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
