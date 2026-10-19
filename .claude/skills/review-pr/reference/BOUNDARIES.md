# Boundaries checklist

Applies to code where data enters or leaves the system: `apps/cms/src/endpoints/`,
`services/`, hooks that read `req` or call external APIs, `src/scripts/`, and
`apps/web/src/lib/` helpers that wrap `@sse/api-client` or the Payload SDK, or read the
environment.
Report missing validation of user-controlled input under **Security**, and
misplaced or leaking layers under **Architectural Patterns**.

Validate, narrow and handle errors at the boundary. Trust typed data inside.
Keep business logic in functions that do not need the framework to run.

## At the boundary

- Request bodies, query params, route params, headers, env vars, external API
  responses, and `JSON.parse` output are parsed into a named type before use.
  `Record<string, unknown>` stops at that parse.
- Errors are turned into a response or a logged failure here, not swallowed.
- Env vars are read and checked once — for the web app, in its `env` helper —
  not with `process.env.X!` scattered through the code.

## Inside the system

- No re-validation or defensive `?.` / `?? ''` deep in a call chain on data the
  boundary already validated. That hides where the guarantee comes from and
  masks real bugs (see `ROOT-CAUSES.md`).
- Business rules — scoring, slug building, tree walking, price maths — live in
  plain functions a unit test can call without booting Payload or Next.

## Across the boundary

- The public surface exposes domain concepts, not the wire or storage shape. An
  `apps/web` component shouldn't depend on the raw REST response when a
  `src/lib/` helper can return the shape it needs.
- Transport, ORM or framework types aren't re-exported through `packages/*`.
- General mechanism sits inside; special-case policy sits at the edge.

## Questions to ask of the diff

- Is this data crossing a boundary right here? If not, the extra validation is
  noise.
- Can this logic be a plain function the endpoint or hook just calls?
- If the external API returns something unexpected, where does it fail, and does
  it fail loudly?

---

Adapted from `pstack` by Lauren Tan, MIT licence — see `LICENSE` in this folder.
