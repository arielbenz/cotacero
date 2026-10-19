# Maintainability checklist

Applies to every changed module. Report under **Code Quality**, usually at MINOR
— raise it only when the shape will visibly cost the next change.

Maintainability is the work a reader must do to understand the code. Measure it
on two axes: **layers to trace** between a question and its answer, and **state
to hold** in your head while reading. The test: can a new reader answer "where
does X come from?" and "what can change X?" in under a minute?

## Layers

- A wrapper with one caller, an adapter with no second implementation, or
  indirection added "for later". Inline it.
- A layer that passes the same arguments through to the next one without
  changing the abstraction.
- A broad interface that hides little. Callers end up learning both the surface
  and the implementation.
- A new signal threaded through several types, props or hooks when a more
  direct path exists.

## State

- Mutation where a return value would do; module state or globals where a
  local would do.
- Two values that must be kept in sync by hand when one could be derived from
  the other.
- An invariant re-checked in every consumer instead of named once at the
  boundary.

## Size of the change

- Removals before additions: dead code, unused exports, stale references and
  redundant validators the change leaves behind.
- The same decision made in several places instead of one source of truth.
- Boilerplate where fewer, plainer lines would do.

## Model the domain

Applies especially to Payload hooks, access rules and stateful UI.

- A feature that grows an existing `if`/`else` chain by one more branch, or
  adds a second boolean that must stay in sync with the first. A lookup table,
  discriminated union or small state machine would delete the branches.
- The same shape assumption repeated across files instead of one typed model.
- Modules split by phase (load, validate, transform, save) that each repeat the
  same domain rules.

Don't ask for an abstraction when the current shape is clear, local and unlikely
to grow. Be sceptical of one that adds indirection without removing branches,
duplicated rules, invalid states or lifecycle risk.

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
